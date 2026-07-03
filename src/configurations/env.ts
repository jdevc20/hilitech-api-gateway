import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",

  port: Number(process.env.PORT ?? 3000),

  authServiceUrl: required("AUTH_SERVICE"),

  profileServiceUrl: required("PROFILE_SERVICE"),

  pingServiceUrl: required("PING_SERVICE"),
};