#!/bin/sh
# Render Haraka runtime config from environment and select the outbound
# delivery mode, then start Haraka. This makes one MTA image deployable to any
# broker: they just set env vars (hostname, domains, mode, relay creds).
set -eu

CFG=/haraka/config
MODE="${MTA_DELIVERY_MODE:-direct}"   # direct | relay

# --- HELO hostname (must have matching PTR for direct mode) ---
if [ -n "${MTA_HOSTNAME:-}" ]; then
  printf '%s\n' "$MTA_HOSTNAME" > "$CFG/me"
fi

# --- Local (inbound) domains we accept mail FOR (comma-separated) ---
if [ -n "${MTA_LOCAL_DOMAINS:-}" ]; then
  printf '%s\n' "$MTA_LOCAL_DOMAINS" | tr ',' '\n' > "$CFG/host_list"
fi

# --- Inbound webhook (forward received mail to the app) ---
cat > "$CFG/inbound_forward.ini" <<EOF
[main]
url=${APP_INBOUND_URL:-http://host.docker.internal:3000/api/v1/email/inbound}
token=${APP_INBOUND_TOKEN:-}
EOF

# --- Plugins + delivery mode ---
{
  echo "local_relay"          # relay only for trusted clients on the submission port
  echo "rcpt_to.in_host_list" # accept inbound for our domains
  echo "inbound_forward"      # forward inbound to the app
  if [ "$MODE" = "relay" ]; then
    echo "queue/smtp_forward" # relay outbound via an upstream smarthost (587)
  fi
} > "$CFG/plugins"

if [ "$MODE" = "relay" ]; then
  cat > "$CFG/smtp_forward.ini" <<EOF
[main]
host=${RELAY_HOST:-}
port=${RELAY_PORT:-587}
enable_tls=true
auth_type=${RELAY_AUTH_TYPE:-plain}
auth_user=${RELAY_USER:-}
auth_pass=${RELAY_PASS:-}
EOF
  echo "[entrypoint] outbound delivery mode = RELAY via ${RELAY_HOST:-<unset>}:${RELAY_PORT:-587}"
else
  # DIRECT: ensure no smarthost config lingers; Haraka core does direct-to-MX.
  rm -f "$CFG/smtp_forward.ini" 2>/dev/null || true
  echo "[entrypoint] outbound delivery mode = DIRECT (direct-to-MX)"
fi

exec haraka -c /haraka
