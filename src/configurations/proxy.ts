import type { IncomingMessage, ServerResponse } from "node:http";

import { createProxyMiddleware } from "http-proxy-middleware";

export function createServiceProxy(target: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    timeout: 15_000,
    proxyTimeout: 15_000,
    on: {
      error(_error, _req, res: ServerResponse<IncomingMessage>) {
        if (res.headersSent) {
          return;
        }

        res.writeHead(502, {
          "Content-Type": "application/json; charset=utf-8",
        });

        res.end(
          JSON.stringify({
            success: false,
            message: "Upstream service unavailable.",
          })
        );
      },
    },
  });
}
