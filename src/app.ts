import express from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import authProxy from "./modules/auth/routes/auth.proxy.js";
import accountProxy from "./modules/auth/routes/account.proxy.js";
import tokenProxy from "./modules/auth/routes/token.proxy.js";
import usersProxy from "./modules/auth/routes/users.proxy.js";
import dashboardProxy from "./modules/auth/routes/dashboard.proxy.js";
import profileProxy from "./modules/profile/routes/profile.proxy.js";
import pingProxy from "./modules/ping/routes/ping.proxy.js";
import { env } from "./configurations/env.js";

import sessionsProxy from "./modules/auth/routes/sessions.proxy.js";

import applicationsProxy from "./modules/auth/routes/applications.proxy.js";
import registrationReportsProxy from "./modules/auth/routes/app-registration-reports.proxy.js";

export const app = express();

/**
 * =========================
 * CORS CONFIG
 * =========================
 */

const allowedOrigins = new Set([
  ...env.corsOrigins,
]);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const isLocalhost =
      origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1");

    const isAllowedProd = allowedOrigins.has(origin);

    if (isLocalhost || isAllowedProd) {
      return callback(null, true);
    }

    console.warn("[Gateway] CORS blocked origin:", origin);

    callback(null, false);
  },

  credentials: true,
};

/**
 * =========================
 * MIDDLEWARES
 * =========================
 */

app.use(cors(corsOptions));

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  })
);

app.use(cookieParser());

// IMPORTANT: Parse body BEFORE proxy so fixRequestBody works.
app.use(express.json());

app.use(morgan("dev"));

/**
 * =========================
 * HEALTH CHECK
 * =========================
 */

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Hilitech API Gateway is running.",
  });
});

/**
 * =========================
 * PROXY ROUTES
 * =========================
 */

app.use("/api/auth", authProxy);

app.use("/api/token", tokenProxy);

app.use("/api/account", accountProxy);

app.use("/api/users", usersProxy);

app.use("/api/dashboard", dashboardProxy);
app.use("/api/applications", applicationsProxy);
app.use("/api/app-registration-reports", registrationReportsProxy);
app.use("/api/sessions", sessionsProxy);

app.use("/api/profile", profileProxy);

app.use("/api/ping", pingProxy);

/**
 * =========================
 * 404
 * =========================
 */

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
    method: req.method,
    path: req.originalUrl,
  });
});
