import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ signalId: string }>
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { signalId } = await context.params

  if (!signalId?.trim()) {
    return NextResponse.json({ error: "Missing signal id." }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
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
  const { error: deleteError } = await admin
    .from("scanner_signals")
    .delete()
    .eq("id", signalId)
    .eq("user_id", user.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: signalId })
}
