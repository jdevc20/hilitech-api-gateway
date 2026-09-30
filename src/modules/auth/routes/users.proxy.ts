import { Router } from "express";
import { createServiceProxy } from "../../../configurations/proxy.js";
import { env } from "../../../configurations/env.js";

const router = Router();

router.use(
  "/",
  createServiceProxy(env.authServiceUrl, {
    pathRewrite: {
      "^/": "/api/users/",
    },
  })
);

export default router;


// This is still on auth-service, but it is for the users route. The path rewrite is set to "/api/users/" to direct requests to the appropriate endpoint in the auth service.