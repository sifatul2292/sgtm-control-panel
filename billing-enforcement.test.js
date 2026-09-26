import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function dhakaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function waitFor(check, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check().catch(() => null);
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for billing enforcement.");
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

test("expired paid plans fall back to Free and capped Free containers stay stopped", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tagioo-billing-enforcement-"));
  const fakeBin = join(directory, "bin");
  const dockerLog = join(directory, "docker.log");
  const historyPath = join(directory, "history.json");
  const today = dhakaDateKey();
  const port = await availablePort();
  await mkdir(fakeBin);
  const dockerPath = join(fakeBin, "docker");
  await writeFile(dockerPath, `#!/bin/sh
printf '%s\\n' "$*" >> "$DOCKER_LOG"
for final_arg; do :; done
if [ "$1" = "inspect" ]; then
  for last; do :; done
  printf '/%s\\n' "$last"
fi
[ "$1" = "stop" ] && [ "$2" = "sgtm-stop-fails" ] && exit 1
[ "$1" = "start" ] && [ "$2" = "sgtm-resume-fails" ] && exit 1
[ "$1" = "update" ] && [ "$2" = "--memory" ] && [ "$final_arg" = "sgtm-resize-fails" ] && exit 1
exit 0
`);
  await chmod(dockerPath, 0o755);
  await writeFile(historyPath, JSON.stringify({
    daily: {},
    tenants: [
      {
        id: "expired-paid",
        name: "Expired Paid",
        plan: "Starter",
        subscriptionStatus: "expired",
        paymentStatus: "paid",
        renewalDate: "2026-01-01T00:00:00.000Z",
        requestLimit: 500000,
        containerLimit: 1,
        monthlyAmount: 1200
      },
      {
        id: "free-at-cap",
        name: "Free At Cap",
        plan: "Free",
        subscriptionStatus: "free",
        paymentStatus: "free",
        cycleStart: "2026-01-01T00:00:00.000Z",
        cycleEnd: "2099-01-01T00:00:00.000Z",
        cycleBaseline: 0,
        requestLimit: 15000,
        containerLimit: 1,
        monthlyAmount: 0
      },
      {
        id: "stop-fails",
        name: "Stop Fails",
        plan: "Free",
        subscriptionStatus: "free",
        paymentStatus: "free",
        cycleStart: "2026-01-01T00:00:00.000Z",
        cycleEnd: "2099-01-01T00:00:00.000Z",
        cycleBaseline: 0,
        requestLimit: 15000
      },
      {
        id: "resume-fails",
        name: "Resume Fails",
        plan: "Starter",
        subscriptionStatus: "expired",
        paymentStatus: "paid",
        renewalDate: "2026-01-01T00:00:00.000Z",
        requestLimit: 500000
      },
      {
        id: "owner-corrupt",
        name: "Owner Corrupt",
        plan: "Pro",
        subscriptionStatus: "free",
        paymentStatus: "free",
        renewalDate: "",
        planUpdatedAt: new Date().toISOString(),
        requestLimit: 2000000,
        monthlyAmount: 2900
      },
      {
        id: "owner-free",
        name: "Owner Free",
        plan: "Free",
        subscriptionStatus: "free",
        paymentStatus: "free",
        cycleStart: "2026-01-01T00:00:00.000Z",
        cycleEnd: "2099-01-01T00:00:00.000Z",
        cycleBaseline: 0,
        requestLimit: 15000
      },
      {
        id: "owner-provider",
        name: "Owner Provider",
        plan: "Pro",
        subscriptionStatus: "active",
        paymentStatus: "paid",
        paymentProvider: "paddle",
        renewalDate: "2099-01-01T00:00:00.000Z",
        requestLimit: 2000000
      },
      {
        id: "owner-corrupt-pending",
        name: "Owner Corrupt Pending",
        plan: "Starter",
        subscriptionStatus: "pending_payment",
        paymentStatus: "pending",
        pendingPlan: "Pro",
        pendingInvoiceNo: "OLD-INV-1",
        planUpdatedAt: new Date().toISOString(),
        requestLimit: 500000
      },
      {
        id: "owner-lifetime",
        name: "Owner Lifetime",
        plan: "Pro",
        subscriptionStatus: "active",
        paymentStatus: "paid",
        lifetimeAccess: true,
        renewalDate: "",
        requestLimit: 2000000
      },
      {
        id: "owner-resize-fails",
        name: "Owner Resize Fails",
        plan: "Free",
        subscriptionStatus: "free",
        paymentStatus: "free",
        cycleStart: "2026-01-01T00:00:00.000Z",
        cycleEnd: "2099-01-01T00:00:00.000Z",
        requestLimit: 15000
      }
    ],
    customerAccounts: [],
    customerSetupRequests: [],
    payments: [
      { id: "old-pending", tenantId: "owner-corrupt-pending", plan: "Pro", status: "pending", type: "plan" }
    ],
    tenantDailyRequests: {
      "expired-paid": { [today]: 150110 },
      "free-at-cap": { [today]: 15000 },
      "stop-fails": { [today]: 15000 },
      "resume-fails": { [today]: 1 },
      "owner-corrupt": { [today]: 200 },
      "owner-free": { [today]: 300 },
      "owner-corrupt-pending": { [today]: 10 },
      "owner-resize-fails": { [today]: 20 }
    },
    tenantEventHistory: {},
    provisioning: {
      requests: [
        { tenantId: "expired-paid", containerName: "sgtm-expired-paid", plan: { accessLog: join(directory, "expired.log"), errorLog: join(directory, "expired-error.log") } },
        { tenantId: "free-at-cap", containerName: "sgtm-free-at-cap", plan: { accessLog: join(directory, "free.log"), errorLog: join(directory, "free-error.log") } },
        { tenantId: "stop-fails", containerName: "sgtm-stop-fails", plan: { accessLog: join(directory, "stop-fails.log"), errorLog: join(directory, "stop-fails-error.log") } },
        { tenantId: "resume-fails", containerName: "sgtm-resume-fails", plan: { accessLog: join(directory, "resume-fails.log"), errorLog: join(directory, "resume-fails-error.log") } },
        { tenantId: "owner-corrupt", containerName: "sgtm-owner-corrupt", plan: { accessLog: join(directory, "owner-corrupt.log"), errorLog: join(directory, "owner-corrupt-error.log") } },
        { tenantId: "owner-free", containerName: "sgtm-owner-free", plan: { accessLog: join(directory, "owner-free.log"), errorLog: join(directory, "owner-free-error.log") } },
        { tenantId: "owner-corrupt-pending", containerName: "sgtm-owner-corrupt-pending", plan: { accessLog: join(directory, "owner-corrupt-pending.log"), errorLog: join(directory, "owner-corrupt-pending-error.log") } },
        { tenantId: "owner-resize-fails", containerName: "sgtm-resize-fails", plan: { accessLog: join(directory, "owner-resize-fails.log"), errorLog: join(directory, "owner-resize-fails-error.log") } }
      ]
    }
  }));

  const child = spawn(process.execPath, [join(process.cwd(), "server.js")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH || ""}`,
      DOCKER_LOG: dockerLog,
      DATA_DIR: directory,
      PORT: String(port),
      AUTH_ENABLED: "false",
      TAGIOO_DATA_ENCRYPTION_KEY: "",
      RESEND_API_KEY: "",
      BREVO_API_KEY: "",
      SGTM_ACCESS_LOG: join(directory, "missing-access.log"),
      SGTM_ERROR_LOG: join(directory, "missing-error.log"),
      INGEST_INTERVAL_MS: "600000",
      PERSIST_SNAPSHOT_INTERVAL_MS: "600000",
      PERSISTENCE_INTERVAL_MS: "50",
      OWNER_DASHBOARD_WARM_MS: "600000",
      AUTO_LAUNCH_ENABLED: "false",
      AUTO_LAUNCH_USE_SUDO: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let childOutput = "";
  child.stdout.on("data", (chunk) => { childOutput += chunk; });
  child.stderr.on("data", (chunk) => { childOutput += chunk; });

  try {
    const data = await waitFor(async () => {
      const current = JSON.parse(await readFile(historyPath, "utf8"));
      const expired = current.tenants.find((tenant) => tenant.id === "expired-paid");
      const capped = current.tenants.find((tenant) => tenant.id === "free-at-cap");
      const repaired = current.tenants.find((tenant) => tenant.id === "owner-corrupt");
      const repairedPending = current.tenants.find((tenant) => tenant.id === "owner-corrupt-pending");
      return expired?.plan === "Free" && capped?.subscriptionStatus === "free_capped"
        && repaired?.subscriptionStatus === "active" && repairedPending?.subscriptionStatus === "active" ? current : null;
    }).catch((error) => {
      throw new Error(`${error.message}\n${childOutput}`);
    });
    const expired = data.tenants.find((tenant) => tenant.id === "expired-paid");
    const capped = data.tenants.find((tenant) => tenant.id === "free-at-cap");
    const stopFails = data.tenants.find((tenant) => tenant.id === "stop-fails");
    const resumeFails = data.tenants.find((tenant) => tenant.id === "resume-fails");
    const repaired = data.tenants.find((tenant) => tenant.id === "owner-corrupt");
    const repairedPending = data.tenants.find((tenant) => tenant.id === "owner-corrupt-pending");
    assert.equal(expired.subscriptionStatus, "free");
    assert.equal(expired.paymentStatus, "free");
    assert.equal(expired.requestLimit, 15000);
    assert.equal(expired.renewalDate, "");
    assert.equal(expired.cycleBaseline, 150110);
    assert.ok(expired.cycleStart);
    assert.ok(expired.cycleEnd);
    assert.ok(capped.suspensionEnforcedAt);
    assert.equal(stopFails.subscriptionStatus, "free");
    assert.equal(stopFails.suspensionEnforcedAt || "", "");
    assert.equal(resumeFails.plan, "Free");
    assert.ok(resumeFails.suspensionEnforcedAt);
    assert.equal(repaired.plan, "Pro");
    assert.equal(repaired.subscriptionStatus, "active");
    assert.equal(repaired.paymentStatus, "paid");
    assert.equal(repaired.paymentProvider, "manual");
    assert.ok(Date.parse(repaired.renewalDate) > Date.now());
    assert.equal(repairedPending.subscriptionStatus, "active");
    assert.equal(repairedPending.paymentStatus, "paid");
    assert.equal(repairedPending.pendingPlan, "");
    assert.equal(data.payments.find((payment) => payment.id === "old-pending").status, "rejected");

    const planResponse = await fetch(`http://127.0.0.1:${port}/api/admin/customers/owner-free/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: "Pro" })
    });
    const planResult = await planResponse.json();
    assert.equal(planResponse.status, 200);
    assert.equal(planResult.tenant.plan, "Pro");
    assert.equal(planResult.tenant.subscriptionStatus, "active");
    assert.equal(planResult.tenant.paymentStatus, "paid");
    assert.equal(planResult.tenant.paymentProvider, "manual");
    assert.ok(Date.parse(planResult.tenant.renewalDate) > Date.now());
    const savedAfterOwnerChange = JSON.parse(await readFile(historyPath, "utf8"));
    const ownerChanged = savedAfterOwnerChange.tenants.find((tenant) => tenant.id === "owner-free");
    assert.equal(ownerChanged.plan, "Pro");
    assert.equal(ownerChanged.subscriptionStatus, "active");
    assert.equal(ownerChanged.paymentStatus, "paid");
    assert.ok(ownerChanged.renewalDate);
    assert.equal(ownerChanged.suspensionEnforcedAt, "");

    const freeResponse = await fetch(`http://127.0.0.1:${port}/api/admin/customers/owner-free/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: "Free" })
    });
    const freeResult = await freeResponse.json();
    assert.equal(freeResponse.status, 200);
    assert.equal(freeResult.tenant.plan, "Free");
    assert.equal(freeResult.tenant.subscriptionStatus, "free");
    assert.equal(freeResult.tenant.paymentStatus, "free");
    assert.equal(freeResult.tenant.renewalDate, "");
    assert.equal(freeResult.tenant.monthlyAmount, 0);
    assert.equal(freeResult.tenant.cycleBaseline, 300);

    const providerResponse = await fetch(`http://127.0.0.1:${port}/api/admin/customers/owner-provider/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: "Starter" })
    });
    assert.equal(providerResponse.status, 409);

    const lifetimeResponse = await fetch(`http://127.0.0.1:${port}/api/admin/customers/owner-lifetime/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: "Starter" })
    });
    assert.equal(lifetimeResponse.status, 409);

    const resizeFailureResponse = await fetch(`http://127.0.0.1:${port}/api/admin/customers/owner-resize-fails/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: "Pro" })
    });
    const resizeFailureResult = await resizeFailureResponse.json();
    assert.equal(resizeFailureResponse.status, 200);
    assert.equal(resizeFailureResult.tenant.subscriptionStatus, "active");
    assert.ok(resizeFailureResult.tenant.resourceResizePendingAt);

    const commands = await waitFor(async () => {
      const lines = (await readFile(dockerLog, "utf8")).trim().split("\n");
      return lines.includes("start sgtm-resume-fails") ? lines : null;
    });
    const paidPolicy = commands.findIndex((line) => line === "update --restart=unless-stopped sgtm-expired-paid");
    const paidStart = commands.findIndex((line) => line === "start sgtm-expired-paid");
    const capPolicy = commands.findIndex((line) => line === "update --restart=no sgtm-free-at-cap");
    const capStop = commands.findIndex((line) => line === "stop sgtm-free-at-cap");
    assert.ok(paidPolicy >= 0 && paidStart > paidPolicy);
    assert.ok(capPolicy >= 0 && capStop > capPolicy);
    assert.ok(commands.includes("stop sgtm-stop-fails"));
    const failedStopPolicy = commands.findIndex((line) => line === "update --restart=no sgtm-stop-fails");
    const failedStop = commands.findIndex((line) => line === "stop sgtm-stop-fails");
    const failedStopRollback = commands.findIndex((line) => line === "update --restart=unless-stopped sgtm-stop-fails");
    assert.ok(failedStopPolicy >= 0 && failedStop > failedStopPolicy && failedStopRollback > failedStop);
    assert.ok(commands.includes("update --restart=unless-stopped sgtm-resume-fails"));
    assert.ok(commands.includes("start sgtm-resume-fails"));
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    }
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test("watchdog restarts crashes but skips intentionally stopped containers", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tagioo-watchdog-"));
  const fakeBin = join(directory, "bin");
  const dockerLog = join(directory, "docker.log");
  const watchdogLog = join(directory, "watchdog.log");
  await mkdir(fakeBin);
  await writeFile(join(fakeBin, "docker"), `#!/bin/sh
printf '%s\\n' "$*" >> "$DOCKER_LOG"
if [ "$1" = "ps" ] && [ "$2" = "-a" ]; then
  case "$*" in *status=exited*) printf 'sgtm-intentional\\nsgtm-crashed\\n';; esac
  exit 0
fi
if [ "$1" = "inspect" ]; then
  for last; do :; done
  case "$2" in
    *RestartPolicy*) [ "$last" = "sgtm-intentional" ] && printf 'no\\n' || printf 'unless-stopped\\n' ;;
    *State.Status*) printf 'running\\n' ;;
  esac
fi
exit 0
`);
  await writeFile(join(fakeBin, "systemctl"), "#!/bin/sh\nexit 0\n");
  await writeFile(join(fakeBin, "sleep"), "#!/bin/sh\nexit 0\n");
  await writeFile(join(fakeBin, "pm2"), `#!/bin/sh
if [ "$1" = "jlist" ]; then
  printf '[{"name":"sgtm-control-panel","pm2_env":{"status":"online"}}]\\n'
fi
exit 0
`);
  await Promise.all(["docker", "systemctl", "sleep", "pm2"].map((name) => chmod(join(fakeBin, name), 0o755)));

  try {
    const child = spawn("bash", [join(process.cwd(), "tagioo-watchdog.sh")], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH || ""}`,
        DOCKER_LOG: dockerLog,
        TAGIOO_WATCHDOG_LOG: watchdogLog,
        RESEND_API_KEY: ""
      },
      stdio: "ignore"
    });
    const exitCode = await new Promise((resolve) => child.once("exit", resolve));
    assert.equal(exitCode, 0);
    const commands = await readFile(dockerLog, "utf8");
    assert.equal(commands.includes("start sgtm-intentional"), false);
    assert.equal(commands.includes("start sgtm-crashed"), true);
    const log = await readFile(watchdogLog, "utf8");
    assert.match(log, /sgtm-intentional is intentionally stopped — skipping restart/);
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});
