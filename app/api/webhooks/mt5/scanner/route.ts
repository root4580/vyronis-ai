import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { extractMt5ApiKey, readMt5WebhookBody } from "@/lib/mt5/payload-parser"
import { Mt5WebhookError } from "@/lib/mt5/webhook-server-service"
import type { Mt5ScannerWebhookPayload } from "@/lib/scanner/types"
import {
  ingestMt5ScannerSignal,
  resolveUserByMt5ApiKey,
} from "@/lib/scanner/scanner-webhook-service"

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const body = await readMt5WebhookBody(request)
    const apiKey = extractMt5ApiKey(request, body)

    if (!apiKey) {
      throw new Mt5WebhookError(
        "Missing API key. Send X-API-Key header or api_key in JSON.",
        401,
      )
    }

    const supabase = createServiceRoleClient()
    const user = await resolveUserByMt5ApiKey(supabase, apiKey)
    const result = await ingestMt5ScannerSignal(
      supabase,
      user.user_id,
      body as unknown as Mt5ScannerWebhookPayload,
    )

    console.log(`[MT5 Scanner] ${requestId} ok`, result)
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 })
  } catch (error) {
    if (error instanceof Mt5WebhookError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }
    console.error(`[MT5 Scanner] ${requestId} error:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scanner ingest failed" },
      { status: 500 },
    )
  }
}
