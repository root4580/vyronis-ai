import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  deleteAllJournalCsvImports,
  importJournalUpload,
  JournalImportTableMissingError,
} from "@/lib/journal/import-server-service"
import { MAX_CSV_BYTES } from "@/lib/research/mt5-csv-parser"

export async function DELETE(request: NextRequest) {
  try {
    const tradeDate = request.nextUrl.searchParams.get("date")?.trim() || undefined
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await deleteAllJournalCsvImports(supabase, user.id, {
      tradeDate,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof JournalImportTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Journal CSV delete error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file")
    const dryRun = String(formData.get("dryRun") || "true") === "true"
    const replaceExisting = String(formData.get("replaceExisting") || "false") === "true"
    const useTodayForMissingDates =
      String(formData.get("useTodayForMissingDates") || "false") === "true"
    const fallbackDateForMissing = useTodayForMissingDates
      ? new Date().toISOString().slice(0, 10)
      : undefined
    const screenshotUrlsRaw = String(formData.get("screenshotUrls") || "")

    let screenshotUrls: string[] = []
    if (screenshotUrlsRaw) {
      try {
        screenshotUrls = JSON.parse(screenshotUrlsRaw) as string[]
      } catch {
        screenshotUrls = []
      }
    }

    let csvContent: string | null = null
    if (file instanceof File) {
      if (file.size > MAX_CSV_BYTES) {
        return NextResponse.json({ error: "CSV file exceeds the 5 MB limit." }, { status: 400 })
      }
      csvContent = await file.text()
    }

    if (!csvContent && screenshotUrls.length === 0) {
      return NextResponse.json(
        { error: "Upload a CSV file and/or chart screenshots." },
        { status: 400 },
      )
    }

    const { data: settings } = await supabase
      .from("user_settings")
      .select("max_risk_per_trade")
      .eq("user_id", user.id)
      .maybeSingle()

    const result = await importJournalUpload(supabase, user.id, {
      csvContent,
      screenshotUrls,
      dryRun,
      replaceExisting,
      fallbackDateForMissing,
      maxRiskPerTrade: settings?.max_risk_per_trade ?? 1,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof JournalImportTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Journal import error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 },
    )
  }
}
