#!/bin/bash
# Tagioo sGTM Watchdog — runs every 5 min via cron
# Restarts crashed Docker sGTM containers, nginx, and pm2 panel.
# Sends an email alert (throttled) whenever it has to take action.

LOG="${TAGIOO_WATCHDOG_LOG:-/var/log/tagioo-watchdog.log}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# ── Alert config (Resend HTTP API) ───────────────────────────────────────────
# Override in /etc/default/tagioo-watchdog if present. Required: RESEND_API_KEY.
ALERT_EMAIL="${ALERT_EMAIL:-sifatul.alams@gmail.com}"
ALERT_FROM="${ALERT_FROM:-Tagioo Watchdog <watchdog@tagioo.com>}"   # from-domain must be verified in Resend
RESEND_API_KEY="${RESEND_API_KEY:-}"
ALERT_COOLDOWN_SECONDS="${ALERT_COOLDOWN_SECONDS:-1800}"   # 30 min per alert key
ALERT_STATE_DIR="${ALERT_STATE_DIR:-/tmp/tagioo-watchdog-alerts}"
# A container the watchdog restarted is not restarted again within this window.
RESTART_COOLDOWN_SECONDS="${RESTART_COOLDOWN_SECONDS:-1800}"
RESTART_STATE_DIR="${RESTART_STATE_DIR:-/tmp/tagioo-watchdog-restarts}"
HOSTNAME_SHORT=$(hostname -s 2>/dev/null || echo tagioo)
[ -f /etc/default/tagioo-watchdog ] && . /etc/default/tagioo-watchdog

mkdir -p "$ALERT_STATE_DIR" "$RESTART_STATE_DIR"

log() { echo "[$TIMESTAMP] $*" >> "$LOG"; }

# send_alert <key> <subject> <body>
# Throttles per <key> so a flapping container doesn't email every 5 min.
send_alert() {
  local key="$1" subject="$2" body="$3"
  local now last state_file
  state_file="$ALERT_STATE_DIR/$(echo "$key" | tr -c 'A-Za-z0-9_' '_')"
  now=$(date +%s)
  last=0
  [ -f "$state_file" ] && last=$(cat "$state_file" 2>/dev/null || echo 0)
  if [ $(( now - last )) -lt "$ALERT_COOLDOWN_SECONDS" ]; then
    log "INFO: alert '$key' suppressed (cooldown)"
    return
  fi
  echo "$now" > "$state_file"
  if [ -z "$RESEND_API_KEY" ]; then
    log "ERROR: RESEND_API_KEY not set — cannot email alert ($key). Set it in /etc/default/tagioo-watchdog."
    return
  fi
  # Build JSON safely (escape quotes/newlines/backslashes in the body via python).
  local full_body json http_code
  full_body=$(printf '%s\n\nHost: %s\nTime: %s\n' "$body" "$HOSTNAME_SHORT" "$TIMESTAMP")
  json=$(ALERT_FROM="$ALERT_FROM" ALERT_EMAIL="$ALERT_EMAIL" SUBJECT="[Tagioo Watchdog] $subject" BODY="$full_body" python3 -c '
import json, os
print(json.dumps({
  "from": os.environ["ALERT_FROM"],
  "to": [os.environ["ALERT_EMAIL"]],
  "subject": os.environ["SUBJECT"],
  "text": os.environ["BODY"],
}))')
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "https://api.resend.com/emails" \
    -H "Authorization: Bearer $RESEND_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$json" 2>/dev/null)
  if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
    log "INFO: alert email sent to $ALERT_EMAIL via Resend ($key)"
  else
    log "ERROR: Resend send failed (http $http_code) for alert ($key) — check API key / verified from-domain"
  fi
}

# ── 1. Check nginx ────────────────────────────────────────────────────────────
if ! systemctl is-active --quiet nginx; then
  log "ALERT: nginx stopped — attempting restart"
  systemctl start nginx
  if systemctl is-active --quiet nginx; then
    log "OK: nginx restarted successfully"
    send_alert "nginx" "nginx was down, restarted OK" "nginx had stopped and was restarted successfully by the watchdog."
  else
    log "ERROR: nginx failed to restart — check: journalctl -u nginx -n 30"
    send_alert "nginx-fail" "nginx DOWN — restart FAILED" "nginx stopped and the watchdog could NOT restart it. Manual action needed: journalctl -u nginx -n 30"
  fi
fi

# ── 2. Check all sGTM Docker containers ──────────────────────────────────────
# Any container whose name starts with "sgtm-" that is not in running state
STOPPED=$(docker ps -a --filter "name=sgtm-" --filter "status=exited" --filter "status=dead" --format "{{.Names}}" 2>/dev/null)
RESTARTING=$(docker ps -a --filter "name=sgtm-" --filter "status=restarting" --format "{{.Names}}" 2>/dev/null)

for container in $STOPPED; do
  RESTART_POLICY=$(docker inspect --format='{{.HostConfig.RestartPolicy.Name}}' "$container" 2>/dev/null)
  if [ "$RESTART_POLICY" = "no" ]; then
    log "INFO: container $container is intentionally stopped — skipping restart"
    continue
  fi
  log "ALERT: container $container is stopped — restarting"
  docker start "$container" >> "$LOG" 2>&1
  sleep 3
  STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null)
  log "INFO: $container status after restart: $STATUS"
  if [ "$STATUS" = "running" ]; then
    send_alert "stopped-$container" "Container $container was down, restarted" "sGTM container '$container' had exited (likely OOM-kill) and was restarted. Status now: $STATUS. Consider raising its mem_limit if this repeats."
  else
    send_alert "stopped-fail-$container" "Container $container DOWN — restart failed" "sGTM container '$container' exited and did NOT come back (status: $STATUS). Manual action needed: docker logs $container --tail 50"
  fi
done

for container in $RESTARTING; do
  log "WARN: container $container is in restart loop — check logs: docker logs $container --tail 20"
  send_alert "restartloop-$container" "Container $container in restart loop" "sGTM container '$container' is stuck restarting (OOM flap or bad config). Check: docker logs $container --tail 50"
done

# ── 3. Liveness check: is each running sGTM container still serving? ─────────
# Probe "/" on the container's loopback port. A live sGTM answers 400 there (no
# client claims the path), so the probe creates no events.
#
# Do NOT probe /healthz. Since about late October 2026 every sGTM container
# answers /healthz with 503 (Docker shows "unhealthy") while still serving
# /g/collect normally. Restarting on that would bounce every customer container
# every 5 minutes and drop their events each time.
#
# Restart only when the port refuses or times out on two probes in a row, and at
# most once per RESTART_COOLDOWN_SECONDS per container. Any other 5xx answer
# sends an alert but does not restart.

# state_file <dir> <key>: path of the per-key timestamp file.
state_file() { printf '%s/%s' "$1" "$(printf '%s' "$2" | tr -c 'A-Za-z0-9_' '_')"; }

recently_restarted() {
  local f last
  f=$(state_file "$RESTART_STATE_DIR" "$1")
  [ -f "$f" ] || return 1
  last=$(cat "$f" 2>/dev/null || echo 0)
  [ $(( $(date +%s) - last )) -lt "$RESTART_COOLDOWN_SECONDS" ]
}

mark_restarted() { date +%s > "$(state_file "$RESTART_STATE_DIR" "$1")"; }

# probe_container <port> <timeout-seconds>: prints the HTTP code, "000" when the
# port refuses the connection or times out.
probe_container() {
  curl -so /dev/null -w "%{http_code}" --max-time "$2" "http://127.0.0.1:$1/" 2>/dev/null
}

RUNNING=$(docker ps --filter "name=sgtm-" --format "{{.Names}} {{.Ports}}" 2>/dev/null)
while IFS= read -r line; do
  [ -z "$line" ] && continue
  name=$(echo "$line" | awk '{print $1}')
  port=$(echo "$line" | grep -oE '127\.0\.0\.1:[0-9]+->' | head -1 | sed -E 's/.*:([0-9]+)->/\1/')
  if [ -z "$name" ] || [ -z "$port" ]; then
    continue
  fi

  HTTP_CODE=$(probe_container "$port" 5)
  if [ "$HTTP_CODE" = "000" ]; then
    sleep 5
    HTTP_CODE=$(probe_container "$port" 10)
    if [ "$HTTP_CODE" != "000" ]; then
      log "WARN: $name on port $port missed one probe but answered the retry (http $HTTP_CODE) — not restarting"
    fi
  fi

  if [ "$HTTP_CODE" = "000" ]; then
    if recently_restarted "$name"; then
      log "ALERT: $name on port $port still not answering after a recent watchdog restart — not restarting again (cooldown)"
      send_alert "unresponsive-repeat-$name" "Container $name still unresponsive after restart" "sGTM container '$name' on port $port is still not answering after the watchdog restarted it in the last $(( RESTART_COOLDOWN_SECONDS / 60 )) minutes. It will not be restarted again automatically until the cooldown ends. Check: docker logs $name --tail 50"
      continue
    fi
    log "ALERT: $name on port $port not answering (connection refused or timed out twice) — restarting"
    mark_restarted "$name"
    docker restart "$name" >> "$LOG" 2>&1
    sleep 3
    AFTER=$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null)
    log "INFO: $name status after restart: $AFTER"
    send_alert "unresponsive-$name" "Container $name unresponsive, restarted" "sGTM container '$name' was running but not answering on port $port (connection refused or timed out twice). Restarted. Status now: $AFTER."
  elif [[ "$HTTP_CODE" =~ ^5[0-9][0-9]$ ]]; then
    log "WARN: $name on port $port answered http $HTTP_CODE on / (expected 400) — alert only, not restarting"
    send_alert "http5xx-$name" "Container $name answering http $HTTP_CODE" "sGTM container '$name' on port $port answers http $HTTP_CODE on / (a live container answers 400). It was not restarted automatically. Check: docker logs $name --tail 50"
  fi
done <<< "$RUNNING"

# ── 4. Check pm2 node process ─────────────────────────────────────────────────
if command -v pm2 &> /dev/null; then
  PANEL_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
  procs = json.load(sys.stdin)
  panel = next((p for p in procs if 'sgtm-control-panel' in p.get('name','') or 'server' in p.get('name','') or 'tagioo' in p.get('name','')), None)
  print(panel['pm2_env']['status'] if panel else 'missing')
except: print('error')
" 2>/dev/null || echo "unknown")

  if [[ "$PANEL_STATUS" == "stopped" || "$PANEL_STATUS" == "errored" || "$PANEL_STATUS" == "missing" ]]; then
    log "ALERT: pm2 control panel is $PANEL_STATUS — restarting"
    cd /var/www/tagioo && pm2 restart ecosystem.config.cjs >> "$LOG" 2>&1
    send_alert "pm2-panel" "Control panel was $PANEL_STATUS, restarted" "The Tagioo pm2 control-panel process was '$PANEL_STATUS' and the watchdog restarted it."
  fi
fi

# ── 5. Trim log file to last 5000 lines ──────────────────────────────────────
if [ -f "$LOG" ] && [ $(wc -l < "$LOG") -gt 5000 ]; then
  tail -4000 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
fi
