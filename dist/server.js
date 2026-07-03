import { app } from "./app.js";
import { env } from "./configurations/env.js";
/**
 * Starts the API Gateway.
 */
const bootstrap = async () => {
    try {
        const port = env.port || 3000;
        const server = app.listen(port, () => {
            console.log(`[Gateway] 🚀 Running on port ${port}`);
            console.log(`[Gateway] Environment: ${env.nodeEnv}`);
        });
        server.on("error", (error) => {
            if (error.code === "EADDRINUSE") {
                console.error(`[CRITICAL] Port ${port} is already in use.`);
            }
            else {
                console.error("[CRITICAL] Failed to start gateway:", error);
            }
            process.exit(1);
        });
        const gracefulShutdown = (signal) => {
            console.log(`\nReceived ${signal}. Closing Gateway...`);
            server.close(() => {
                console.log("[Gateway] Closed.");
                process.exit(0);
            });
            setTimeout(() => {
                console.error("[Gateway] Forced shutdown.");
                process.exit(1);
            }, 10000);
        };
        process.on("SIGINT", gracefulShutdown);
        process.on("SIGTERM", gracefulShutdown);
    }
    catch (error) {
        console.error("[CRITICAL]", error);
        process.exit(1);
    }
};
bootstrap();
//# sourceMappingURL=server.js.map