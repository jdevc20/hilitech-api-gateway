import { createProxyMiddleware } from "http-proxy-middleware";
import { env } from "../../../configurations/env.js";
const pingProxy = createProxyMiddleware({
    target: env.pingServiceUrl, // or env.pingServiceUrl
    changeOrigin: true,
});
export default pingProxy;
//# sourceMappingURL=ping.proxy.js.map