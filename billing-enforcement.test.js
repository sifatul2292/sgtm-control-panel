import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

test("expired paid plans fall back to Free and capped Free containers stay stopped", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tagioo-billing-enforcement-"));
  const fakeBin = join(directory, "bin");
  const dockerLog = join(directory, "docker.log");
  const historyPath = join(directory, "history.json");
  const today = dhakaDateKey();
  await mkdir(fakeBin);
  const dockerPath = join(fakeBin, "docker");
  await writeFile(dockerPath, `#!/bin/sh
printf '%s\\n' "$*" >> "$DOCKER_LOG"
if [ "$1" = "inspect" ]; then
  for last; do :; done
  printf '/%s\\n' "$last"
fi
[ "$1" = "stop" ] && [ "$2" = "sgtm-stop-fails" ] && exit 1
[ "$1" = "start" ] && [ "$2" = "sgtm-resume-fails" ] && exit 1
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
      }
    ],
    customerAccounts: [],
    customerSetupRequests: [],
    payments: [],
    tenantDailyRequests: {
      "expired-paid": { [today]: 150110 },
      "free-at-cap": { [today]: 15000 },
      "stop-fails": { [today]: 15000 },
      "resume-fails": { [today]: 1 }
    },
    tenantEventHistory: {},
    provisioning: {
      requests: [
        { tenantId: "expired-paid", containerName: "sgtm-expired-paid", plan: { accessLog: join(directory, "expired.log"), errorLog: join(directory, "expired-error.log") } },
        { tenantId: "free-at-cap", containerName: "sgtm-free-at-cap", plan: { accessLog: join(directory, "free.log"), errorLog: join(directory, "free-error.log") } },
        { tenantId: "stop-fails", containerName: "sgtm-stop-fails", plan: { accessLog: join(directory, "stop-fails.log"), errorLog: join(directory, "stop-fails-error.log") } },
        { tenantId: "resume-fails", containerName: "sgtm-resume-fails", plan: { accessLog: join(directory, "resume-fails.log"), errorLog: join(directory, "resume-fails-error.log") } }
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
      PORT: "0",
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
      AUTO_LAUNCH_ENABLED: "false"
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
      return expired?.plan === "Free" && capped?.subscriptionStatus === "free_capped" ? current : null;
    }).catch((error) => {
      throw new Error(`${error.message}\n${childOutput}`);
    });
    const expired = data.tenants.find((tenant) => tenant.id === "expired-paid");
    const capped = data.tenants.find((tenant) => tenant.id === "free-at-cap");
    const stopFails = data.tenants.find((tenant) => tenant.id === "stop-fails");
    const resumeFails = data.tenants.find((tenant) => tenant.id === "resume-fails");
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
    await rm(directory, { recursive: true, force: true });
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
    await rm(directory, { recursive: true, force: true });
  }
});
