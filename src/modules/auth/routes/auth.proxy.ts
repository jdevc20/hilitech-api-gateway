import { createProxyMiddleware } from "http-proxy-middleware";
import { env } from "../../../../src/configurations/env.js";

const authProxy = createProxyMiddleware({
  target: env.authServiceUrl,
  changeOrigin: true,
});

export default authProxy;