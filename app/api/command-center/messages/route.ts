import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  CommandCenterTableMissingError,
  postCommandCenterMessage,
} from "@/lib/intelligence/command-center-server-service"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as { content?: string }
    const content = body.content?.trim()
    if (!content) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 })
    }

    const result = await postCommandCenterMessage(supabase, user.id, content)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CommandCenterTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Command center message error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send message" },
      { status: 500 },
    )
  }
}
