#!/usr/bin/env bash
set -euo pipefail

# Usage: bash scripts/wrangler-secrets.sh [secrets_file] [wrangler_config]
# Defaults: secrets_file=edge/secrets.env, wrangler_config=edge/wrangler.toml

SECRETS_FILE="${1:-edge/secrets.env}"
WRANGLER_CONFIG="${2:-edge/wrangler.toml}"

if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "Secrets file not found: $SECRETS_FILE" >&2
  exit 1
fi

# Whitelist of secret keys to put into Cloudflare Workers
SECRET_KEYS=(
  SESSION_SECRET
  GITHUB_APP_PRIVATE_KEY
  GITHUB_APP_WEBHOOK_SECRET
  GITHUB_OAUTH_CLIENT_ID
  GITHUB_OAUTH_CLIENT_SECRET
  STRIPE_SECRET
  STRIPE_WEBHOOK_SECRET
  DATABASE_URL
  NATS_AUTH_TOKEN
  OTLP_HEADERS
)

# Fast key lookup using associative array
declare -A ALLOW
for k in "${SECRET_KEYS[@]}"; do ALLOW["$k"]=1; done

echo "Loading secrets from: $SECRETS_FILE"

while IFS= read -r raw || [[ -n "$raw" ]]; do
  # Skip comments and blank lines
  [[ -z "$raw" || "$raw" =~ ^[[:space:]]*# ]] && continue

  # Parse KEY=VALUE (preserve '=' in value)
  key="${raw%%=*}"
  value="${raw#*=}"
  key="${key## }"; key="${key%% }"

  # Only process whitelisted keys
  if [[ -z "${ALLOW[$key]:-}" ]]; then
    continue
  fi

  # Trim surrounding quotes if present (simple case)
  if [[ "$value" =~ ^\".*\"$ || "$value" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi

  echo "Putting secret: $key"
  printf %s "$value" | npx -y wrangler@latest -c "$WRANGLER_CONFIG" secret put "$key" --quiet >/dev/null
done < "$SECRETS_FILE"

echo "Done. Verify with: npx -y wrangler@latest -c $WRANGLER_CONFIG secret list"

