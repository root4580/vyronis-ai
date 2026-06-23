import { NextResponse } from "next/server"
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

  const { data, error } = await supabase
    .from("scanner_signals")
    .delete()
    .eq("id", signalId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle()

  if (error) {
    if (/scanner_signals|does not exist|PGRST205/i.test(error.message)) {
      return NextResponse.json(
        { error: "Run supabase/048-scanner-signals-user-delete.sql first." },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data?.id) {
    return NextResponse.json({ error: "Signal not found." }, { status: 404 })
  }

  return NextResponse.json({ ok: true, id: data.id })
}
