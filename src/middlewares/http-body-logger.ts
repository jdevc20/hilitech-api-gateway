import type { NextFunction, Request, Response } from "express";

type RequestUser = Record<string, unknown>;

type RequestWithUser = Request & {
  user?: RequestUser | null;
};

type CapturedBinaryBody = {
  encoding: "base64";
  contentEncoding?: string;
  data: string;
};

function normalizeUserId(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  return null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");

    if (!payload) {
      return null;
    }

    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(decoded);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractUserId(req: RequestWithUser): string | null {
  const user = req.user;

  if (user && typeof user === "object") {
    const contextUserId =
      normalizeUserId(user.id) ??
      normalizeUserId(user.userId) ??
      normalizeUserId(user.user_id) ??
      normalizeUserId(user.sub);

    if (contextUserId) {
      return contextUserId;
    }
  }

  const headerUserId = normalizeUserId(req.header("x-user-id"));

  if (headerUserId) {
    return headerUserId;
  }

  const authorization = req.header("authorization");
  const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!bearerMatch) {
    return null;
  }

  // Decoding here is only for logging context. Authentication/authorization
  // must still be handled by middleware that verifies the JWT signature.
  const payload = decodeJwtPayload(bearerMatch[1]);

  if (!payload) {
    return null;
  }

  return (
    normalizeUserId(payload.id) ??
    normalizeUserId(payload.userId) ??
    normalizeUserId(payload.user_id) ??
    normalizeUserId(payload.sub)
  );
}

function isTextContentType(contentType: string): boolean {
  return (
    contentType.startsWith("text/") ||
    contentType.includes("application/json") ||
    contentType.includes("+json") ||
    contentType.includes("application/xml") ||
    contentType.includes("application/javascript") ||
    contentType.includes("application/x-www-form-urlencoded")
  );
}

function parseTextBody(value: string, contentType: string): unknown {
  if (
    contentType.includes("application/json") ||
    contentType.includes("+json")
  ) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function formatCapturedBody(
  body: unknown,
  contentType: string,
  contentEncoding?: string
): unknown {
  if (body === undefined || body === null) {
    return null;
  }

  if (!Buffer.isBuffer(body) && !(body instanceof Uint8Array)) {
    if (typeof body === "string") {
      return parseTextBody(body, contentType);
    }

    return body;
  }

  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);

  if (contentEncoding && contentEncoding !== "identity") {
    const binaryBody: CapturedBinaryBody = {
      encoding: "base64",
      contentEncoding,
      data: buffer.toString("base64"),
    };

    return binaryBody;
  }

  if (isTextContentType(contentType)) {
    return parseTextBody(buffer.toString("utf8"), contentType);
  }

  const binaryBody: CapturedBinaryBody = {
    encoding: "base64",
    data: buffer.toString("base64"),
  };

  return binaryBody;
}

function snapshotRequestBody(body: unknown): unknown {
  if (body === undefined) {
    return null;
  }

  try {
    return structuredClone(body);
  } catch {
    return body;
  }
}

/**
 * Logs one structured object per completed HTTP response.
 *
 * Express handlers normally send through res.send/res.json. Proxied responses,
 * however, can write directly to the underlying ServerResponse, so this
 * middleware also observes res.write/res.end. The original methods are always
 * called with the same arguments and return values.
 */
export function httpBodyLogger(
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): void {
  const startedAt = Date.now();
  const requestBody = snapshotRequestBody(req.body);

  let sendBodyCaptured = false;
  let sendBody: unknown;
  const responseChunks: Buffer[] = [];

  const originalSend = res.send;
  const originalWrite = res.write;
  const originalEnd = res.end;

  res.send = function (this: Response, body?: unknown) {
    sendBodyCaptured = true;
    sendBody = body;

    return originalSend.call(this, body);
  } as typeof res.send;

  const captureChunk = (chunk: unknown, encoding?: BufferEncoding): void => {
    if (sendBodyCaptured || chunk === undefined || chunk === null) {
      return;
    }

    if (Buffer.isBuffer(chunk)) {
      responseChunks.push(Buffer.from(chunk));
      return;
    }

    if (chunk instanceof Uint8Array) {
      responseChunks.push(Buffer.from(chunk));
      return;
    }

    if (typeof chunk === "string") {
      responseChunks.push(Buffer.from(chunk, encoding));
    }
  };

  res.write = function (
    this: Response,
    chunk: unknown,
    ...args: unknown[]
  ): boolean {
    const encoding = typeof args[0] === "string" ? (args[0] as BufferEncoding) : undefined;

    captureChunk(chunk, encoding);

    return (originalWrite as Function).call(this, chunk, ...args);
  } as typeof res.write;

  res.end = function (
    this: Response,
    chunk?: unknown,
    ...args: unknown[]
  ): Response {
    const encoding = typeof args[0] === "string" ? (args[0] as BufferEncoding) : undefined;

    captureChunk(chunk, encoding);

    return (originalEnd as Function).call(this, chunk, ...args);
  } as typeof res.end;

  res.once("finish", () => {
    const contentType = String(res.getHeader("content-type") ?? "");
    const contentEncodingHeader = res.getHeader("content-encoding");
    const contentEncoding =
      typeof contentEncodingHeader === "string"
        ? contentEncodingHeader
        : Array.isArray(contentEncodingHeader)
          ? contentEncodingHeader.join(",")
          : undefined;

    const capturedResponseBody = sendBodyCaptured
      ? sendBody
      : responseChunks.length > 0
        ? Buffer.concat(responseChunks)
        : null;

    const logEntry = {
      type: "http_request_response",
      timestamp: new Date().toISOString(),
      userId: extractUserId(req),
      request: {
        method: req.method,
        path: req.originalUrl,
        body: requestBody,
      },
      response: {
        statusCode: res.statusCode,
        body: formatCapturedBody(
          capturedResponseBody,
          contentType,
          contentEncoding
        ),
      },
      durationMs: Date.now() - startedAt,
    };

    console.log(JSON.stringify(logEntry));
  });

  next();
}
