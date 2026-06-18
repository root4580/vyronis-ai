#!/usr/bin/env bash
# Set Supabase Auth Site URL + redirect allow list for vyronishq.com (Management API).
#
# 1. Create a token: https://supabase.com/dashboard/account/tokens
# 2. Run:
#    SUPABASE_ACCESS_TOKEN="sbp_..." ./scripts/configure-supabase-auth-urls.sh
#
# Project ref defaults to jjdxodqipdjfkjanjywf (vyronis-ai).

set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-jjdxodqipdjfkjanjywf}"
SITE_URL="${VYRONIS_SITE_URL:-https://vyronishq.com}"
TOKEN="${SUPABASE_ACCESS_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  echo "Missing SUPABASE_ACCESS_TOKEN."
  echo "Create one at https://supabase.com/dashboard/account/tokens"
  echo "Then run:"
  echo '  SUPABASE_ACCESS_TOKEN="sbp_..." ./scripts/configure-supabase-auth-urls.sh'
  exit 1
fi

# Supabase stores redirect allow list as newline-separated URIs.
URI_ALLOW_LIST=$(
  printf '%s\n%s\n%s\n%s' \
    "${SITE_URL}/auth/callback" \
    "${SITE_URL}/auth/reset-password" \
    "http://localhost:3000/auth/callback" \
    "http://localhost:3000/auth/reset-password"
)

PAYLOAD=$(jq -n \
  --arg site_url "$SITE_URL" \
  --arg uri_allow_list "$URI_ALLOW_LIST" \
  '{ site_url: $site_url, uri_allow_list: $uri_allow_list }')

echo "Updating auth config for project ${PROJECT_REF}..."
echo "  site_url: ${SITE_URL}"
echo "  uri_allow_list:"
echo "$URI_ALLOW_LIST" | sed 's/^/    /'

RESPONSE=$(curl -sS -w "\n%{http_code}" -X PATCH \
  "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "Failed (HTTP ${HTTP_CODE}):"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  exit 1
fi

echo "OK — Auth URLs updated."
echo ""
echo "Next (manual in dashboard):"
echo "  Authentication → Email Templates → Confirm signup"
echo "  Paste HTML from supabase/email-templates/confirm-signup.html"
echo "  (uses token_hash links — required for verify-on-phone; do NOT use {{ .ConfirmationURL }} alone)"
echo "  Authentication → Email Templates → Reset password"
echo "  Paste HTML from supabase/email-templates/reset-password.html"
echo ""
echo "Optional: Vercel NEXT_PUBLIC_APP_URL=${SITE_URL} and redeploy."
