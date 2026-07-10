import { env } from "../../../configurations/env.js";
import { createServiceProxy } from "../../../configurations/proxy.js";
const profileProxy = createServiceProxy(env.profileServiceUrl);
export default profileProxy;
//# sourceMappingURL=profile.proxy.js.map