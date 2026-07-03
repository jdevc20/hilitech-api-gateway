import { createProxyMiddleware } from "http-proxy-middleware";
import { env } from "../../../../src/configurations/env.js";
import pingProxy from "../../ping/routes/ping.proxy.js";

const profileProxy = createProxyMiddleware({
  target: env.profileServiceUrl,
  changeOrigin: true,
});

export default profileProxy;