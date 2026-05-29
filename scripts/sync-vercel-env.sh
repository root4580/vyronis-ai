#!/usr/bin/env bash
# Sync Vercel production env with .env.local (same Supabase + AI keys as localhost).
# Usage: ./scripts/sync-vercel-env.sh <vercel-project-name> <NEXT_PUBLIC_APP_URL>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env.local"
PROJECT="${1:?Project name required (e.g. vyronis-ai)}"
APP_URL="${2:?App URL required (e.g. https://vyronishq.com)}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

cd "$ROOT"
npx vercel@latest link --project "$PROJECT" --yes >/dev/null

upsert_env() {
  local name="$1"
  local value="$2"
  if [[ -z "${value:-}" ]]; then
    echo "Skip empty: $name"
    return
  fi
  if npx vercel@latest env ls production 2>/dev/null | grep -q "^ ${name} "; then
    npx vercel@latest env update "$name" production --value "$value" -y >/dev/null
    echo "Updated $name"
  else
    printf '%s' "$value" | npx vercel@latest env add "$name" production -y >/dev/null
    echo "Added $name"
  fi
}

upsert_env "NEXT_PUBLIC_SUPABASE_URL" "${NEXT_PUBLIC_SUPABASE_URL}"
upsert_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" "${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
upsert_env "NEXT_PUBLIC_APP_URL" "${APP_URL}"
upsert_env "SUPABASE_URL" "${NEXT_PUBLIC_SUPABASE_URL}"
upsert_env "AI_PROVIDER" "${AI_PROVIDER:-openai}"
upsert_env "CHART_VISION_PROVIDER" "${CHART_VISION_PROVIDER:-openai}"
upsert_env "OPENAI_API_KEY" "${OPENAI_API_KEY:-}"
upsert_env "OPENAI_VISION_MODEL" "${OPENAI_VISION_MODEL:-gpt-4o}"

# Service role must be from the SAME Supabase project as NEXT_PUBLIC_SUPABASE_URL
if [[ -n "${SUPABASE_SECRET_KEY:-}" ]]; then
  upsert_env "SUPABASE_SECRET_KEY" "${SUPABASE_SECRET_KEY}"
elif [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  upsert_env "SUPABASE_SERVICE_ROLE_KEY" "${SUPABASE_SERVICE_ROLE_KEY}"
else
  echo "WARN: No SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local — webhooks will fail."
fi

echo "Done: $PROJECT → $APP_URL (Supabase host: ${NEXT_PUBLIC_SUPABASE_URL#https://})"
