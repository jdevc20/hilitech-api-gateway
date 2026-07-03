import { createProxyMiddleware } from "http-proxy-middleware";
import { env } from "../../../configurations/env.js";
import { createServiceProxy } from "../../../configurations/proxy.js";

const authProxy = createServiceProxy(env.authServiceUrl);

export default authProxy;