import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac, randomBytes } from "node:crypto";
import { openPaddleInbox } from "../paddle-inbox.js";
import { createPaddleReceiver } from "../paddle-webhook-server.js";
import { paddleEventIsStale } from "../paddle-billing.js";
import { spawn } from "node:child_process";
import { once } from "node:events";

test("durable inbox survives restart, lease expiry and retry; deduplicates after completion", () => {
  const dir = mkdtempSync(join(tmpdir(), "tagioo-paddle-test-"));
  const key = randomBytes(32).toString("base64");
  const raw = Buffer.from(JSON.stringify({ event_id: "evt_test", occurred_at: "2026-10-07T00:00:00Z", data: { id: "sub_test" } }));
  let inbox = openPaddleInbox(dir, key);
  try {
    assert.equal(inbox.accept(raw).duplicate, false);
    inbox.close(); inbox = openPaddleInbox(dir, key);
    assert.equal(inbox.accept(raw).duplicate, true);
    let job = inbox.claim();
    assert.equal(job.event.data.id, "sub_test");
    assert.equal(inbox.claim(), null);
    inbox.close(); inbox = openPaddleInbox(dir, key);
    job = inbox.claim(Date.now() + 61000);
    assert.equal(job.attempts, 2);
    inbox.retry(job.id, job.attempts, "temporary failure");
    assert.equal(inbox.claim(), null);
    assert.ok(inbox.claim(Date.now() + 10000));
    inbox.complete(job.id);
    assert.equal(inbox.claim(Date.now() + 100000), null);
    assert.equal(inbox.accept(raw).duplicate, true);
    assert.throws(() => inbox.accept(Buffer.from(raw.toString().replace("sub_test", "sub_other"))), /Conflicting/);
  } finally { inbox.close(); rmSync(dir, { recursive: true }); }
});

test("receiver acknowledges durable acceptance, rejects signatures and never acknowledges failed storage", async () => {
  const secret = "test-only-secret";
  const dir = mkdtempSync(join(tmpdir(), "tagioo-paddle-http-"));
  const inbox = openPaddleInbox(dir);
  const receiver = createPaddleReceiver(inbox, secret);
  await new Promise(resolve => receiver.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${receiver.address().port}/api/paddle/webhook`;
  const body = JSON.stringify({ event_id: "evt_http", occurred_at: new Date().toISOString(), event_type: "transaction.completed", data: {} });
  const ts = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex");
  const headers = { "Paddle-Signature": `ts=${ts};h1=${signature}` };
  try {
    assert.equal((await fetch(url, { method: "POST", body })).status, 401);
    let response = await fetch(url, { method: "POST", headers, body });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).duplicate, false);
    response = await fetch(url, { method: "POST", headers, body });
    assert.equal((await response.json()).duplicate, true);
    inbox.close();
    response = await fetch(url, { method: "POST", headers, body });
    assert.equal(response.status, 503);
  } finally { await new Promise(resolve => receiver.close(resolve)); rmSync(dir, { recursive: true }); }
});

test("older and equal events cannot undo newer state; retired subscriptions cannot overwrite new subscriptions", () => {
  const tenant = { paddleSubscriptionId: "sub_current", lastPaddleSubscriptionId: "sub_old", paddleStateOccurredAt: "2026-10-07T10:00:00Z" };
  assert.equal(paddleEventIsStale(tenant, "sub_current", "2026-10-07T09:00:00Z"), true);
  assert.equal(paddleEventIsStale(tenant, "sub_current", tenant.paddleStateOccurredAt), true);
  assert.equal(paddleEventIsStale(tenant, "sub_current", "2026-10-07T11:00:00Z"), false);
  assert.equal(paddleEventIsStale(tenant, "sub_old", "2026-10-08T10:00:00Z"), true);
  assert.equal(paddleEventIsStale(tenant, "sub_new", "2026-10-07T09:00:00Z"), false);
});

test("independent receiver answers while the panel event loop is blocked", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tagioo-paddle-isolation-"));
  const child = spawn(process.execPath, ["--input-type=module", "-e", `
    import {openPaddleInbox} from './paddle-inbox.js';
    import {createPaddleReceiver} from './paddle-webhook-server.js';
    const s=createPaddleReceiver(openPaddleInbox(process.env.DATA_DIR),'isolation-test');
    s.listen(0,'127.0.0.1',()=>console.log(s.address().port));
  `], { cwd: new URL("..", import.meta.url), env: { ...process.env, DATA_DIR: dir }, stdio: ["ignore", "pipe", "pipe"] });
  try {
    const readOutput = (process) => {
      let stderr = "";
      process.stderr.on("data", chunk => { stderr += chunk; });
      return Promise.race([
        once(process.stdout, "data", { signal: AbortSignal.timeout(15000) }),
        once(process, "exit").then(([code]) => { throw new Error(`Child exited ${code}: ${stderr}`); })
      ]);
    };
    const [output] = await readOutput(child);
    const port = Number(output.toString().trim());
    const ts = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ event_id: "evt_isolation", occurred_at: new Date().toISOString(), data: {} });
    const sig = createHmac("sha256", "isolation-test").update(`${ts}:${body}`).digest("hex");
    // Send from another process so this test's deliberately blocked event loop
    // cannot hide an ingress timing regression.
    const sender = spawn(process.execPath, ["--input-type=module", "-e", `
      const start=performance.now();
      const r=await fetch('http://127.0.0.1:${port}/api/paddle/webhook',{method:'POST',headers:{'Paddle-Signature':${JSON.stringify(`ts=${ts};h1=${sig}`)}},body:${JSON.stringify(body)}});
      console.log(JSON.stringify({status:r.status,ms:performance.now()-start}));
    `], { stdio: ["ignore", "pipe", "pipe"] });
    const resultPromise = readOutput(sender);
    const end = Date.now() + 5500;
    while (Date.now() < end) {} // models the old panel's synchronous JSON work
    const [result] = await resultPromise;
    const timing = JSON.parse(result.toString());
    assert.equal(timing.status, 200);
    assert.ok(timing.ms < 1000, `receiver took ${timing.ms}ms`);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = once(child, "exit");
      child.kill();
      await stopped;
    }
    rmSync(dir, { recursive: true });
  }
});
