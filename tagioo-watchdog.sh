#!/bin/bash
# Tagioo sGTM Watchdog — runs every 5 min via cron
# Restarts crashed Docker sGTM containers and nginx, logs all actions.

LOG="/var/log/tagioo-watchdog.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log() { echo "[$TIMESTAMP] $*" >> "$LOG"; }

# ── 1. Check nginx ────────────────────────────────────────────────────────────
if ! systemctl is-active --quiet nginx; then
  log "ALERT: nginx stopped — attempting restart"
  systemctl start nginx
  if systemctl is-active --quiet nginx; then
    log "OK: nginx restarted successfully"
  else
    log "ERROR: nginx failed to restart — check: journalctl -u nginx -n 30"
  fi
fi

# ── 2. Check all sGTM Docker containers ──────────────────────────────────────
# Any container whose name starts with "sgtm-" that is not in running state
STOPPED=$(docker ps -a --filter "name=sgtm-" --filter "status=exited" --filter "status=dead" --format "{{.Names}}" 2>/dev/null)
RESTARTING=$(docker ps -a --filter "name=sgtm-" --filter "status=restarting" --format "{{.Names}}" 2>/dev/null)

for container in $STOPPED; do
  log "ALERT: container $container is stopped — restarting"
  docker start "$container" >> "$LOG" 2>&1
  sleep 3
  STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null)
  log "INFO: $container status after restart: $STATUS"
done

for container in $RESTARTING; do
  log "WARN: container $container is in restart loop — check logs: docker logs $container --tail 20"
done

# ── 3. Sanity-check: can we reach each running sGTM container? ───────────────
RUNNING=$(docker ps --filter "name=sgtm-" --format "{{.Names}} {{.Ports}}" 2>/dev/null)
while IFS= read -r line; do
  name=$(echo "$line" | awk '{print $1}')
  port=$(echo "$line" | grep -oP '127\.0\.0\.1:\K[0-9]+(?=->)' | head -1)
  if [ -n "$port" ]; then
    if ! curl -sf --max-time 3 "http://127.0.0.1:$port/healthz" > /dev/null 2>&1; then
      # /healthz not always available — try root path (sGTM returns 200 or 301)
      HTTP_CODE=$(curl -so /dev/null -w "%{http_code}" --max-time 3 "http://127.0.0.1:$port/" 2>/dev/null)
      if [[ "$HTTP_CODE" == "000" ]]; then
        log "ALERT: $name on port $port not responding (http $HTTP_CODE) — restarting"
        docker restart "$container" >> "$LOG" 2>&1
      fi
    fi
  fi
done <<< "$RUNNING"

# ── 4. Check pm2 node process ─────────────────────────────────────────────────
if command -v pm2 &> /dev/null; then
  PANEL_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
  procs = json.load(sys.stdin)
  panel = next((p for p in procs if 'sgtm-control-panel' in p.get('name','') or 'server' in p.get('name','')), None)
  print(panel['pm2_env']['status'] if panel else 'missing')
except: print('error')
" 2>/dev/null || echo "unknown")

  if [[ "$PANEL_STATUS" == "stopped" || "$PANEL_STATUS" == "errored" || "$PANEL_STATUS" == "missing" ]]; then
    log "ALERT: pm2 control panel is $PANEL_STATUS — restarting"
    cd /root/sgtm-contro-panel && pm2 restart ecosystem.config.cjs >> "$LOG" 2>&1
  fi
fi

# ── 5. Trim log file to last 5000 lines ──────────────────────────────────────
if [ -f "$LOG" ] && [ $(wc -l < "$LOG") -gt 5000 ]; then
  tail -4000 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
fi
