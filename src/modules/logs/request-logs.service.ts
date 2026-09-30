import { pool } from "../../database/pool.js";

export type RequestLogSort = "asc" | "desc";

export type RequestLogFilters = {
  page: number;
  limit: number;
  sort: RequestLogSort;
  method?: string;
  path?: string;
  statusCode?: number;
  from?: Date;
  to?: Date;
  completed?: boolean;
  requestId?: string;
  ipAddress?: string;
};

export class RequestLogQueryError extends Error {}

function singleValue(query: Record<string, unknown>, key: string): string | undefined {
  const value = query[key];

  if (value === undefined || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new RequestLogQueryError(`${key} must be a single value.`);
  }

  return value.trim();
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) {
    return fallback;
  }

  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new RequestLogQueryError(`${name} must be a positive integer.`);
  }

  return Number(value);
}

function dateValue(value: string | undefined, name: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new RequestLogQueryError(`${name} must be a valid ISO date.`);
  }

  return parsed;
}

export function parseRequestLogFilters(query: Record<string, unknown>): RequestLogFilters {
  const page = positiveInteger(singleValue(query, "page"), 1, "page");
  const limit = positiveInteger(singleValue(query, "limit"), 20, "limit");
  if (limit > 100) {
    throw new RequestLogQueryError("limit cannot exceed 100.");
  }

  const sortValue = singleValue(query, "sort")?.toLowerCase() ?? "desc";
  if (sortValue !== "asc" && sortValue !== "desc") {
    throw new RequestLogQueryError("sort must be asc or desc.");
  }

  const method = singleValue(query, "method")?.toUpperCase();
  if (method && !/^[A-Z]{1,16}$/.test(method)) {
    throw new RequestLogQueryError("method is invalid.");
  }

  const statusValue = singleValue(query, "statusCode");
  const statusCode = statusValue === undefined
    ? undefined
    : positiveInteger(statusValue, 0, "statusCode");
  if (statusCode !== undefined && (statusCode < 100 || statusCode > 599)) {
    throw new RequestLogQueryError("statusCode must be between 100 and 599.");
  }

  const completedValue = singleValue(query, "completed")?.toLowerCase();
  if (completedValue && completedValue !== "true" && completedValue !== "false") {
    throw new RequestLogQueryError("completed must be true or false.");
  }

  const requestId = singleValue(query, "requestId");
  if (requestId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new RequestLogQueryError("requestId must be a UUID.");
  }

  const path = singleValue(query, "path");
  const ipAddress = singleValue(query, "ipAddress");
  if (path && path.length > 500) {
    throw new RequestLogQueryError("path cannot exceed 500 characters.");
  }
  if (ipAddress && ipAddress.length > 100) {
    throw new RequestLogQueryError("ipAddress cannot exceed 100 characters.");
  }

  const from = dateValue(singleValue(query, "from"), "from");
  const to = dateValue(singleValue(query, "to"), "to");
  if (from && to && from > to) {
    throw new RequestLogQueryError("from must be before or equal to to.");
  }

  return {
    page,
    limit,
    sort: sortValue,
    method,
    path,
    statusCode,
    from,
    to,
    completed: completedValue === undefined ? undefined : completedValue === "true",
    requestId,
    ipAddress,
  };
}

export async function listRequestLogs(filters: RequestLogFilters) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  const add = (condition: string, value: unknown): void => {
    values.push(value);
    conditions.push(condition.replace("?", `$${values.length}`));
  };

  if (filters.method) add("method = ?", filters.method);
  if (filters.path) add("path ILIKE ?", `%${filters.path}%`);
  if (filters.statusCode) add("status_code = ?", filters.statusCode);
  if (filters.from) add("created_at >= ?", filters.from);
  if (filters.to) add("created_at <= ?", filters.to);
  if (filters.completed !== undefined) add("completed = ?", filters.completed);
  if (filters.requestId) add("request_id = ?", filters.requestId);
  if (filters.ipAddress) add("ip_address ILIKE ?", `%${filters.ipAddress}%`);

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const direction = filters.sort === "asc" ? "ASC" : "DESC";
  const offset = (filters.page - 1) * filters.limit;
  const dataValues = [...values, filters.limit, offset];

  const [countResult, dataResult] = await Promise.all([
    pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM api_gateway_requests ${where}`,
      values
    ),
    pool.query(
      `SELECT
        id::text,
        request_id AS "requestId",
        method,
        path,
        status_code AS "statusCode",
        duration_ms AS "durationMs",
        ip_address AS "ipAddress",
        user_agent AS "userAgent",
        request_body AS "requestBody",
        response_body AS "responseBody",
        completed,
        created_at AS "createdAt"
      FROM api_gateway_requests
      ${where}
      ORDER BY created_at ${direction}, id ${direction}
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      dataValues
    ),
  ]);

  const total = Number(countResult.rows[0]?.total ?? 0);

  return {
    items: dataResult.rows,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
    sort: { field: "createdAt", direction: filters.sort },
  };
}
