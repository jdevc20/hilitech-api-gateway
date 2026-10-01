import { env } from "../configurations/env.js";

export type ServiceHealthStatus = "healthy" | "unhealthy";

export type ServiceHealth = {
  name: string;
  status: ServiceHealthStatus;
  url: string;
  responseTimeMs: number;
  statusCode: number | null;
  message?: string;
};

type ServiceTarget = {
  name: string;
  baseUrl: string;
};

const HEALTH_TIMEOUT_MS = 5_000;

const services: ServiceTarget[] = [
  { name: "auth-service", baseUrl: env.authServiceUrl },
  { name: "profile-service", baseUrl: env.profileServiceUrl },
  { name: "ping-service", baseUrl: env.pingServiceUrl },
];

function healthUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/health`;
}

async function checkService(target: ServiceTarget): Promise<ServiceHealth> {
  const url = healthUrl(target.baseUrl);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });

    return {
      name: target.name,
      status: response.ok ? "healthy" : "unhealthy",
      url,
      responseTimeMs: Date.now() - startedAt,
      statusCode: response.status,
      ...(!response.ok ? { message: `Health endpoint returned HTTP ${response.status}.` } : {}),
    };
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";

    return {
      name: target.name,
      status: "unhealthy",
      url,
      responseTimeMs: Date.now() - startedAt,
      statusCode: null,
      message: isTimeout
        ? `Health check timed out after ${HEALTH_TIMEOUT_MS}ms.`
        : error instanceof Error
          ? error.message
          : "Health check failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getServicesHealth(): Promise<ServiceHealth[]> {
  return Promise.all(services.map(checkService));
}
