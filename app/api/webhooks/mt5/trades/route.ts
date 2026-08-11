import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import {
  extractMt5ApiKey,
  readMt5WebhookBody,
} from "@/lib/mt5/payload-parser"
import type { Mt5TradeWebhookPayload } from "@/lib/mt5/types"
import {
  ingestMt5Trade,
  ingestMt5TradeBatch,
  Mt5WebhookError,
  Mt5WebhookTableMissingError,
  resolveUserByMt5ApiKey,
} from "@/lib/mt5/webhook-server-service"

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)
  const debugLogOnly =
    request.nextUrl.searchParams.get("debug") === "log" ||
    request.nextUrl.searchParams.get("mode") === "echo"

  try {
    console.log(`[MT5 Webhook] ${requestId} received${debugLogOnly ? " (debug=log)" : ""}`)
    const body = await readMt5WebhookBody(request)

    if (debugLogOnly) {
      // Do not log the full raw payload — it can contain account numbers,
      // symbols, and trade details that shouldn't end up in provider logs.
      // Log only shape/metadata useful for debugging connectivity.
      const summary =
        "trades" in body && Array.isArray(body.trades)
          ? { keys: Object.keys(body), tradeCount: body.trades.length }
          : { keys: Object.keys(body) }
      console.log(`[MT5 Webhook] ${requestId} debug body received`, summary)
    }
    const apiKey = extractMt5ApiKey(request, body)

    if (!apiKey) {
      throw new Mt5WebhookError(
        "Missing API key. Send X-API-Key header, Authorization: Bearer, or api_key in JSON.",
        401,
      )
    }

    const supabase = createServiceRoleClient()
    const user = await resolveUserByMt5ApiKey(supabase, apiKey)
    console.log(`[MT5 Webhook] ${requestId} auth ok user=${user.user_id}`)

    if (debugLogOnly) {
      const { recordMt5Ping } = await import("@/lib/mt5/ping-service")
      await recordMt5Ping(supabase, user.user_id, { ping: true, test: true }, "Debug log — trade payload received.")
      return NextResponse.json({
        ok: true,
        mode: "debug-log",
        requestId,
        message: "Payload logged. No trade ingested. Remove ?debug=log for full processing.",
        body,
      })
    }

    if ("trades" in body && Array.isArray(body.trades)) {
      const batch = await ingestMt5TradeBatch(supabase, user, body.trades)
      console.log(`[MT5 Webhook] ${requestId} batch done`, {
        imported: batch.imported,
        duplicates: batch.duplicates,
        errors: batch.errors.length,
      })
      return NextResponse.json(batch, { status: 202 })
    }

    const result = await ingestMt5Trade(supabase, user, body as Mt5TradeWebhookPayload)
    console.log(`[MT5 Webhook] ${requestId} single done`, {
      ticket: result.ticket,
      trade_id: result.trade_id,
      duplicate: result.duplicate,
      pipeline_ok: result.pipeline?.ok,
      failedAt: result.pipeline?.failedAt,
    })
    return NextResponse.json(result, {
      status: result.duplicate ? 200 : 201,
    })
  } catch (error) {
    if (error instanceof Mt5WebhookTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (error instanceof Mt5WebhookError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }
    console.error(`[MT5 Webhook] ${requestId} error:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "MT5 ingest failed" },
      { status: 500 },
    )
  }
}
