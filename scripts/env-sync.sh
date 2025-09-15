#!/usr/bin/env bash
set -euo pipefail

# Sync root .env into component env files:
# - edge/secrets.env (for wrangler secret put)
# - core/.env        (runner/backend)
# - app/.env.local   (Next.js public-only keys)

SRC_FILE=${1:-.env}
EDGE_OUT=${2:-edge/secrets.env}
CORE_OUT=${3:-core/.env}
APP_OUT=${4:-app/.env.local}

if [[ ! -f "$SRC_FILE" ]]; then
  echo "Source env not found: $SRC_FILE" >&2
  exit 1
fi

# Load all vars with expansion support
set -a
source "$SRC_FILE"
set +a

mkdir -p "$(dirname "$EDGE_OUT")" "$(dirname "$CORE_OUT")" "$(dirname "$APP_OUT")"

# Helpers
newline=$'\n'
escape_newlines() {
  # Replace actual newlines with \n sequences
  local s=$1
  s="${s//$newline/\\n}"
  printf %s "$s"
}

write_file() {
  local path=$1; shift
  : > "$path"
  for line in "$@"; do
    printf "%s\n" "$line" >> "$path"
  done
}

kv_line() {
  local key=$1; local val=${!key-}
  [[ -z "${val+x}" ]] && return 1
  printf "%s=%s\n" "$key" "$val"
}

kv_line_escaped_newlines() {
  local key=$1; local val=${!key-}
  [[ -z "${val+x}" ]] && return 1
  printf "%s=%s\n" "$key" "$(escape_newlines "$val")"
}

# === edge/secrets.env ===
{
  echo "# Generated from $SRC_FILE"
  echo "# Only secrets for Cloudflare Workers (used by scripts/wrangler-secrets.sh)"
  echo
  kv_line SESSION_SECRET || true
  # Store PEM on one line with \n escapes for safer parsing
  kv_line_escaped_newlines GITHUB_APP_PRIVATE_KEY || true
  kv_line GITHUB_APP_WEBHOOK_SECRET || true
  kv_line GITHUB_OAUTH_CLIENT_ID || true
  kv_line GITHUB_OAUTH_CLIENT_SECRET || true
  kv_line STRIPE_SECRET || true
  kv_line STRIPE_WEBHOOK_SECRET || true
  kv_line DATABASE_URL || true
  kv_line NATS_AUTH_TOKEN || true
  kv_line OTLP_HEADERS || true
} | tee "$EDGE_OUT" >/dev/null

# === core/.env ===
{
  echo "# Generated from $SRC_FILE"
  echo "# Core runner env"
  echo
  kv_line DATABASE_URL || true
  kv_line NATS_URL || true
  kv_line NATS_AUTH_TOKEN || true
  kv_line R2_S3_ENDPOINT || true
  kv_line R2_ACCESS_KEY || true
  kv_line R2_SECRET_KEY || true
  kv_line R2_BUCKET || true
  kv_line OTLP_HEADERS || true
  kv_line SESSION_SECRET || true
  kv_line ADMIN_SECRET || true
} | tee "$CORE_OUT" >/dev/null

# === app/.env.local === (public-only)
{
  echo "# Generated from $SRC_FILE"
  echo "# Next.js public env"
  echo
  kv_line NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || true
  kv_line NEXT_PUBLIC_GITHUB_CLIENT_ID || true
  # Pass-through if explicitly provided in .env
  kv_line NEXT_PUBLIC_APP_ORIGIN || true
  kv_line NEXT_PUBLIC_API_ORIGIN || true
} | tee "$APP_OUT" >/dev/null

echo "Synced:"
echo "  - $EDGE_OUT"
echo "  - $CORE_OUT"
echo "  - $APP_OUT"

