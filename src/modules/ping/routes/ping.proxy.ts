import { env } from "../../../configurations/env.js";
import { createServiceProxy } from "../../../configurations/proxy.js";

const pingProxy = createServiceProxy(env.pingServiceUrl);

export default pingProxy;