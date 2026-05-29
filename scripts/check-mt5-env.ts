/**
 * Verify MT5 pipeline environment — npx tsx scripts/check-mt5-env.ts
 */
import { createClient } from "@supabase/supabase-js"
import { loadEnvLocal } from "./load-env-local"

function status(ok: boolean) {
  return ok ? "✓" : "✗"
}

loadEnvLocal()

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  const secret =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY_VYRONIS?.trim()

  console.log("\n=== MT5 environment check ===\n")
  console.log(`${status(Boolean(url))} NEXT_PUBLIC_SUPABASE_URL`, url || "(missing)")
  console.log(
    `${status(Boolean(anon))} NEXT_PUBLIC_SUPABASE_ANON_KEY`,
    anon ? `${anon.slice(0, 24)}…` : "(missing)",
  )
  console.log(
    `${status(Boolean(secret))} SUPABASE_SECRET_KEY (or SERVICE_ROLE)`,
    secret ? `${secret.slice(0, 20)}…` : "(missing — add from Supabase Dashboard)",
  )

  if (!url || !anon) {
    console.log("\nFix .env.local then re-run.\n")
    process.exit(1)
  }

  const anonClient = createClient(url, anon)
  const { error: anonError } = await anonClient.from("user_settings").select("user_id").limit(1)
  console.log(
    `\n${status(!anonError)} Anon key → Supabase`,
    anonError?.message || "connected",
  )

  let secretOk = false
  if (secret) {
    const admin = createClient(url, secret, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await admin.from("user_settings").select("user_id").limit(3)
    secretOk = !error
    console.log(
      `${status(secretOk)} Secret key → admin access`,
      error?.message || `connected (${data?.length ?? 0} settings rows)`,
    )
    if (!secretOk) {
      console.log(
        "  → Copy the Secret key for project jjdxodqipdjfkjanjywf (not an old Vercel key).",
      )
      console.log(
        "  → https://supabase.com/dashboard/project/jjdxodqipdjfkjanjywf/settings/api-keys",
      )
    }
  }

  const email = process.env.MT5_TEST_EMAIL?.trim()
  const password = process.env.MT5_TEST_PASSWORD?.trim()
  console.log(
    `\n${status(Boolean(email && password))} MT5_TEST_EMAIL + MT5_TEST_PASSWORD`,
    email ? email : "(optional — for npm run mt5:quick-test without API key)",
  )

  console.log("\nFastest test paths:")
  if (secretOk) {
    console.log("  1. npm run mt5:quick-test   (auto API key + ingest)")
    console.log("  2. curl -H X-API-Key … /api/mt5/test-closed-trade")
  } else if (email && password) {
    console.log("  1. npm run mt5:quick-test   (sign-in + ingest)")
  } else {
    console.log("  1. Log in at http://localhost:3000 → DevTools console:")
    console.log('     fetch("/api/mt5/test-closed-trade",{method:"POST",credentials:"include"}).then(r=>r.json()).then(console.log)')
    console.log("  2. Add SUPABASE_SECRET_KEY to .env.local → npm run mt5:quick-test")
  }
  console.log("")
}

void main()
