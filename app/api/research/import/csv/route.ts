import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  ResearchLabDisabledError,
  ResearchLabTableMissingError,
} from "@/lib/research/feature-flag"
import { importMt5Csv } from "@/lib/research/server-service"
import { MAX_CSV_BYTES } from "@/lib/research/mt5-csv-parser"

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
    const researchStrategyId = String(formData.get("researchStrategyId") || "").trim()
    const dryRun = String(formData.get("dryRun") || "") === "true"

    if (!researchStrategyId) {
      return NextResponse.json({ error: "researchStrategyId is required." }, { status: 400 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required." }, { status: 400 })
    }

    if (file.size > MAX_CSV_BYTES) {
      return NextResponse.json({ error: "CSV file exceeds the 5 MB limit." }, { status: 400 })
    }

    const csvContent = await file.text()
    const result = await importMt5Csv(supabase, user.id, {
      csvContent,
      researchStrategyId,
      filename: file.name,
      dryRun,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ResearchLabDisabledError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (error instanceof ResearchLabTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error("Research CSV import error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 },
    )
  }
}
