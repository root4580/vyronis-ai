import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { extractMt5ApiKey } from "@/lib/mt5/payload-parser"
import { recordMt5Ping } from "@/lib/mt5/ping-service"
import {
  Mt5WebhookError,
  Mt5WebhookTableMissingError,
  resolveUserByMt5ApiKey,
} from "@/lib/mt5/webhook-server-service"

/**
 * Log-only MT5 webhook — validates API key, logs payload, no trade ingest.
 * Use to isolate MT5 → server connectivity.
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)
  const receivedAt = new Date().toISOString()

  try {
    const rawText = await request.text()
    let parsed: unknown = null
    try {
      parsed = rawText.trim() ? JSON.parse(rawText) : null
    } catch {
      parsed = { _raw: rawText.slice(0, 2000) }
    }

    console.log(`[MT5 Echo] ${requestId} received at ${receivedAt}`)
    console.log(`[MT5 Echo] ${requestId} body:`, JSON.stringify(parsed))

    const headerKey =
      request.headers.get("x-api-key")?.trim() ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
      null

    const bodyKey =
      parsed && typeof parsed === "object" && parsed !== null
        ? String(
            (parsed as Record<string, unknown>).api_key ??
              (parsed as Record<string, unknown>).apiKey ??
              "",
          ).trim()
        : ""

    const apiKey = headerKey || bodyKey
    if (!apiKey) {
      throw new Mt5WebhookError("Missing API key.", 401)
    }

    const supabase = createServiceRoleClient()
    const user = await resolveUserByMt5ApiKey(supabase, apiKey)

    await recordMt5Ping(
      supabase,
      user.user_id,
      parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {},
      "Echo received — MT5 can reach Vyronis.",
    )

    return NextResponse.json({
      ok: true,
      mode: "echo",
      requestId,
      receivedAt,
      user_id: user.user_id,
      message: "Payload logged. No trade saved.",
      payload: parsed,
    })
  } catch (error) {
    if (error instanceof Mt5WebhookTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (error instanceof Mt5WebhookError) {
      console.error(`[MT5 Echo] ${requestId} auth error:`, error.message)
      return NextResponse.json({ error: error.message, requestId }, { status: error.statusCode })
    }
    console.error(`[MT5 Echo] ${requestId} error:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Echo failed", requestId },
      { status: 500 },
    )
  }
}
