import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openPaddleInbox } from "./paddle-inbox.js";
import { verifyPaddleSignature } from "./paddle-billing.js";

export function createPaddleReceiver(inbox, secret) {
  return createServer(async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(body));
    };
    if (req.method === "GET" && req.url === "/health") { reply(200, { ok: true }); return; }
    if (req.method !== "POST" || req.url !== "/api/paddle/webhook") { reply(404, { error: "Not found" }); return; }
    try {
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1024 * 1024) { reply(413, { error: "Payload too large" }); return; }
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks);
      if (!verifyPaddleSignature({ header: req.headers["paddle-signature"], rawBody: raw, secret })) {
        reply(401, { error: "Invalid Paddle webhook signature." }); return;
      }
      const result = inbox.accept(raw);
      reply(200, { received: true, ...result });
    } catch (error) {
      // Do not acknowledge storage failure; Paddle must retry delivery.
      const invalid = error instanceof SyntaxError || /Invalid Paddle|Conflicting Paddle/.test(error.message);
      if (!invalid) console.error("Paddle inbox persistence failed:", error.code || error.name);
      reply(invalid ? 400 : 503, { error: invalid ? "Invalid event payload." : "Webhook storage unavailable." });
    }
  });
}

if (process.env.TAGIOO_PADDLE_RECEIVER === "1" || (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))) {
  if (!process.env.PADDLE_WEBHOOK_SECRET) throw new Error("PADDLE_WEBHOOK_SECRET is required.");
  const inbox = openPaddleInbox(process.env.DATA_DIR || "./data", process.env.TAGIOO_DATA_ENCRYPTION_KEY || "");
  const server = createPaddleReceiver(inbox, process.env.PADDLE_WEBHOOK_SECRET);
  server.requestTimeout = 10000;
  server.listen(Number(process.env.PADDLE_WEBHOOK_PORT || 3101), "127.0.0.1", () => console.log("Paddle durable receiver online"));
  process.on("SIGTERM", () => server.close(() => { inbox.close(); process.exit(0); }));
}
