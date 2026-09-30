import type { NextFunction, Request, Response } from "express";

import { env } from "../configurations/env.js";

type AccountResponse = {
  data?: {
    user?: {
      role?: unknown;
    };
  };
};

export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authorization = req.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Unauthorized." });
    return;
  }

  try {
    const response = await fetch(`${env.authServiceUrl}/api/account/me`, {
      headers: { authorization, accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });

    if (response.status === 401) {
      res.status(401).json({ success: false, message: "Invalid or expired token." });
      return;
    }

    if (!response.ok) {
      console.error(`[Gateway] Auth role check failed with status ${response.status}.`);
      res.status(503).json({ success: false, message: "Authorization service unavailable." });
      return;
    }

    const payload = await response.json() as AccountResponse;
    if (payload.data?.user?.role !== "SUPER_ADMIN") {
      res.status(403).json({ success: false, message: "Super Admin access required." });
      return;
    }

    next();
  } catch (error) {
    console.error("[Gateway] Auth role check failed:", error);
    res.status(503).json({ success: false, message: "Authorization service unavailable." });
  }
}
