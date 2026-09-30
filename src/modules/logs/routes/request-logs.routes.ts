import { Router } from "express";

import { requireSuperAdmin } from "../../../middlewares/super-admin.middleware.js";
import {
  listRequestLogs,
  parseRequestLogFilters,
  RequestLogQueryError,
} from "../request-logs.service.js";

const router = Router();

router.get("/", requireSuperAdmin, async (req, res) => {
  try {
    const filters = parseRequestLogFilters(req.query);
    const data = await listRequestLogs(filters);

    res.json({ success: true, message: "Gateway logs fetched successfully.", data });
  } catch (error) {
    if (error instanceof RequestLogQueryError) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }

    console.error("[Gateway] Failed to fetch request logs:", error);
    res.status(500).json({ success: false, message: "Unable to fetch gateway logs." });
  }
});

export default router;
