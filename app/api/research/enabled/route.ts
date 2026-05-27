import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isResearchLabEnabled } from "@/lib/research/feature-flag"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const enabled = await isResearchLabEnabled(supabase, user.id)
  if (!enabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ enabled: true })
}
