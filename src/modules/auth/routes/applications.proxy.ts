import { Router } from "express";
import { createServiceProxy } from "../../../configurations/proxy.js";
import { env } from "../../../configurations/env.js";

const router = Router();

router.use(
  "/",
  createServiceProxy(env.authServiceUrl, {
    pathRewrite: {
      "^/": "/api/applications/"
    }
  })
);

export default router;

