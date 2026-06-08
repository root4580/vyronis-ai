import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getDailyJournalClose,
  saveDailyJournalClose,
  todaySessionDateISO,
} from "@/lib/daily-journal/server-service"
import type { DailyJournalClosePayload } from "@/lib/daily-journal/types"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accountId = request.nextUrl.searchParams.get("accountId")?.trim()
    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 })
    }

    const sessionDate = request.nextUrl.searchParams.get("date")?.trim() || todaySessionDateISO()
    const snapshot = await getDailyJournalClose(supabase, user.id, accountId, sessionDate)
    return NextResponse.json(snapshot)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch daily journal" },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as Partial<DailyJournalClosePayload>
    const accountId = body.accountId?.trim()
    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 })
    }

    const snapshot = await saveDailyJournalClose(supabase, user.id, {
      accountId,
      sessionDate: body.sessionDate,
      improveTomorrow: body.improveTomorrow ?? "",
      rulesNextSession: body.rulesNextSession ?? "",
      focusArea: body.focusArea ?? "",
    })

    if (!snapshot.connected) {
      return NextResponse.json(snapshot, { status: 503 })
    }

    return NextResponse.json(snapshot)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save daily journal" },
      { status: 500 },
    )
  }
}
