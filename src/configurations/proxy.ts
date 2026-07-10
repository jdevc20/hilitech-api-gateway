import type { Request } from "express";
import {
  createProxyMiddleware,
  fixRequestBody,
} from "http-proxy-middleware";

type ServiceProxyOptions = {
  pathRewrite?: Record<string, string>;
};

export function createServiceProxy(
  target: string,
  options: ServiceProxyOptions = {}
) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,

    timeout: 15_000,
    proxyTimeout: 15_000,

    pathRewrite: options.pathRewrite,

    on: {
      proxyReq(proxyReq, req) {
        // Required when express.json() has already parsed the body.
        fixRequestBody(proxyReq, req);

        // Cast only for Express-specific properties.
        const expressReq = req as Request;

        const url = req.url ?? "/";
        const method = req.method ?? "UNKNOWN";

        console.log("");
        console.log("==================================================");
        console.log("[Gateway] Forwarding Request");
        console.log("==================================================");
        console.log("Method :", method);
        console.log("Source :", url);
        console.log("Target :", `${target}${url}`);
        console.log("Host   :", req.headers.host);
        console.log("Origin :", req.headers.origin ?? "-");
        console.log("IP     :", expressReq.ip ?? "-");

        console.log("Headers:");
        console.log({
          "content-type": req.headers["content-type"],
          authorization: req.headers.authorization,
          cookie: req.headers.cookie,
        });

        if (
          expressReq.body &&
          typeof expressReq.body === "object" &&
          Object.keys(expressReq.body).length > 0
        ) {
          console.log("Body:");
          console.dir(expressReq.body, { depth: null });
        }

        console.log("==================================================");
        console.log("");
      },

      proxyRes(proxyRes, req) {
        console.log(
          `[Gateway] ${req.method} ${req.url} <- ${proxyRes.statusCode}`
        );
      },

      error(error, req, res) {
        console.error("");
        console.error("==================================================");
        console.error("[Gateway] Proxy Error");
        console.error("==================================================");
        console.error("Request :", `${req.method} ${req.url}`);
        console.error("Target  :", target);
        console.error("Message :", error.message);
        console.error("==================================================");
        console.error("");

        if (!("writeHead" in res)) {
          return;
        }

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
