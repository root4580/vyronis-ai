import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: { signalId?: string }
  try {
    body = (await request.json()) as { signalId?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const signalId = body.signalId?.trim()
  if (!signalId) {
    return NextResponse.json({ error: "Missing signalId." }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: owned, error: lookupError } = await supabase
    .from("scanner_signals")
    .select("id")
    .eq("id", signalId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (lookupError) {
    if (/scanner_signals|does not exist|PGRST205/i.test(lookupError.message)) {
      return NextResponse.json(
        { error: "Scanner signals table not found. Run migration 047." },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: lookupError.message }, { status: 500 })
  }

  if (!owned?.id) {
    return NextResponse.json({ error: "Signal not found." }, { status: 404 })
  }

  const admin = createServiceRoleClient()
  const { data: removed, error: removeError } = await admin
    .from("scanner_signals")
    .delete()
    .eq("id", signalId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle()

  if (removeError) {
    console.error("[scanner/remove] delete failed:", removeError.message)
    return NextResponse.json({ error: removeError.message }, { status: 500 })
  }

  if (!removed?.id) {
    const { error: expireError } = await admin
      .from("scanner_signals")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", signalId)
      .eq("user_id", user.id)

    if (expireError) {
      console.error("[scanner/remove] expire failed:", expireError.message)
      return NextResponse.json({ error: expireError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, id: signalId })
}
