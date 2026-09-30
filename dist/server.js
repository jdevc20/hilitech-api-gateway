import { app } from "./app.js";
import { env } from "./configurations/env.js";
import { closeDatabase } from "./database/pool.js";
const port = env.port;
const server = app.listen(port, () => {
    console.log(`[Gateway] Running on port ${port}`);
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
    console.log(`\nReceived ${signal}. Closing gateway...`);
    const shutdownTimer = setTimeout(() => {
        console.error("[Gateway] Forced shutdown.");
        process.exit(1);
    }, 10_000);
    server.close(async () => {
        clearTimeout(shutdownTimer);
        try {
            await closeDatabase();
            console.log("[Gateway] Closed.");
            process.exit(0);
        }
        catch (error) {
            console.error("[Gateway] Failed to close database connections:", error);
            process.exit(1);
        }
    });
};
process.once("SIGINT", gracefulShutdown);
process.once("SIGTERM", gracefulShutdown);
//# sourceMappingURL=server.js.map