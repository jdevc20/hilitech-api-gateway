import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function requiredUrl(name: string): string {
  const value = required(name);

  try {
    new URL(value);
  } catch {
    throw new Error(`Invalid URL in environment variable: ${name}`);
  }

  return value;
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      "Invalid environment variable: PORT must be a valid TCP port."
    );
  }

  return port;
}

function parsePositiveInteger(
  name: string,
  value: string | undefined,
  fallback: number
): number {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid environment variable: ${name} must be a positive integer.`);
  }

  return parsed;
}

function parseOrigins(value: string | undefined): string[] {
  const fallback = "http://localhost:5000";

  const origins = (value ?? fallback)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    return [fallback];
  }

  for (const origin of origins) {
    try {
      new URL(origin);
    } catch {
      throw new Error(
        `Invalid URL in environment variable: CORS_ORIGINS (${origin})`
      );
    }
  }

  return origins;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",

  port: parsePort(process.env.PORT),

  databaseUrl: required("DATABASE_URL"),

  requestLogMaxBodyBytes: parsePositiveInteger(
    "REQUEST_LOG_MAX_BODY_BYTES",
    process.env.REQUEST_LOG_MAX_BODY_BYTES,
    65_536
  ),

  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),

  authServiceUrl: requiredUrl("AUTH_SERVICE_URL"),

  profileServiceUrl: requiredUrl("PROFILE_SERVICE_URL"),

  pingServiceUrl: requiredUrl("PING_SERVICE_URL"),
};
