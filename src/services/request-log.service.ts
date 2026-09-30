import { pool } from "../database/pool.js";

export type RequestLogRecord = {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ipAddress: string | null;
  userAgent: string | null;
  requestBody: unknown;
  responseBody: unknown;
  completed: boolean;
};

export async function saveRequestLog(record: RequestLogRecord): Promise<void> {
  await pool.query(
    `INSERT INTO api_gateway_requests (
      request_id,
      method,
      path,
      status_code,
      duration_ms,
      ip_address,
      user_agent,
      request_body,
      response_body,
      completed
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)`,
    [
      record.requestId,
      record.method,
      record.path,
      record.statusCode,
      record.durationMs,
      record.ipAddress,
      record.userAgent,
      JSON.stringify(record.requestBody ?? null),
      JSON.stringify(record.responseBody ?? null),
      record.completed,
    ]
  );
}
