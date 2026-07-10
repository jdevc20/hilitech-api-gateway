import { env } from "../../../configurations/env.js";
import { createServiceProxy } from "../../../configurations/proxy.js";
const authProxy = createServiceProxy(env.authServiceUrl);
export default authProxy;
//# sourceMappingURL=auth.proxy.js.map