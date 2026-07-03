import { createProxyMiddleware } from "http-proxy-middleware";
import { env } from "../../../../src/configurations/env.js";
const profileProxy = createProxyMiddleware({
    target: env.profileServiceUrl,
    changeOrigin: true,
});
export default profileProxy;
//# sourceMappingURL=profile.proxy.js.map