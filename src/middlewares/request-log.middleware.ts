import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { env } from "../configurations/env.js";
import { saveRequestLog } from "../services/request-log.service.js";

const SENSITIVE_KEY =
  /^(authorization|cookie|set-cookie|password|passcode|secret|token|accessToken|refreshToken|idToken|code|codeVerifier|codeChallenge)$/i;

type StoredBody =
  | null
  | boolean
  | number
  | string
  | StoredBody[]
  | { [key: string]: StoredBody };

function redact(value: unknown, seen = new WeakSet<object>()): StoredBody {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry, seen));
  }

  const result: { [key: string]: StoredBody } = {};

  for (const [key, entry] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(entry, seen);
  }

  return result;
}

function enforceSizeLimit(value: StoredBody): StoredBody {
  const serialized = JSON.stringify(value);
  const bytes = Buffer.byteLength(serialized);

  if (bytes <= env.requestLogMaxBodyBytes) {
    return value;
  }

  return {
    _truncated: true,
    originalBytes: bytes,
    preview: Buffer.from(serialized)
      .subarray(0, env.requestLogMaxBodyBytes)
      .toString("utf8"),
  };
}

function responseBody(
  contentType: string | undefined,
  contentEncoding: string | undefined,
  body: Buffer
): StoredBody {
  if (body.length === 0) {
    return null;
  }

  const type = contentType?.toLowerCase() ?? "";

  if (contentEncoding && contentEncoding.toLowerCase() !== "identity") {
    return { _omitted: "compressed response", bytes: body.length };
  }

  if (!type.includes("json") && !type.startsWith("text/")) {
    return { _omitted: "binary response", bytes: body.length };
  }

  const text = body.toString("utf8");

  if (type.includes("json")) {
    try {
      return enforceSizeLimit(redact(JSON.parse(text)));
    } catch {
      // Preserve invalid JSON as text so upstream formatting problems are diagnosable.
    }
  }

  return enforceSizeLimit(redact(text));
}

export function requestLogMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = randomUUID();
  const startedAt = process.hrtime.bigint();
  const chunks: Buffer[] = [];
  let capturedBytes = 0;
  let totalResponseBytes = 0;
  let saved = false;

  res.setHeader("x-request-id", requestId);

  const capture = (chunk: unknown, encoding?: unknown): void => {
    if (chunk === undefined || chunk === null) {
      return;
    }

    let buffer: Buffer;

    if (Buffer.isBuffer(chunk)) {
      buffer = chunk;
    } else if (chunk instanceof Uint8Array) {
      buffer = Buffer.from(chunk);
    } else {
      buffer = Buffer.from(
        String(chunk),
        typeof encoding === "string" ? encoding as BufferEncoding : "utf8"
      );
    }

    totalResponseBytes += buffer.length;

    const remaining = env.requestLogMaxBodyBytes - capturedBytes;
    if (remaining > 0) {
      const captured = buffer.subarray(0, remaining);
      chunks.push(captured);
      capturedBytes += captured.length;
    }
  };

  const originalWrite = res.write;
  res.write = function (
    this: Response,
    ...args: Parameters<typeof res.write>
  ): boolean {
    capture(args[0], args[1]);
    return originalWrite.apply(this, args);
  } as typeof res.write;

  const originalEnd = res.end;
  res.end = function (
    this: Response,
    ...args: Parameters<typeof res.end>
  ): Response {
    capture(args[0], args[1]);
    return originalEnd.apply(this, args);
  } as typeof res.end;

  const persist = (completed: boolean): void => {
    if (saved) {
      return;
    }
    saved = true;

    let storedResponseBody = responseBody(
      res.getHeader("content-type")?.toString(),
      res.getHeader("content-encoding")?.toString(),
      Buffer.concat(chunks)
    );

    if (capturedBytes < totalResponseBytes) {
      storedResponseBody = {
        _truncated: true,
        originalBytes: totalResponseBytes,
        preview: "[OMITTED: response exceeded the configured storage limit]",
      };
    }

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    void saveRequestLog({
      requestId,
      method: req.method,
      path: req.originalUrl.split("?")[0] ?? "/",
      statusCode: completed ? res.statusCode : 499,
      durationMs: Math.round(durationMs * 100) / 100,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
      requestBody: enforceSizeLimit(redact(req.body ?? null)),
      responseBody: storedResponseBody,
      completed,
    }).catch((error: unknown) => {
      console.error(`[Gateway] Failed to save request log ${requestId}:`, error);
    });
  };

  res.once("finish", () => persist(true));
  res.once("close", () => persist(res.writableEnded));

  next();
}
