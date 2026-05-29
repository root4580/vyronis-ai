import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { extractMt5ApiKey } from "@/lib/mt5/payload-parser"
import { recordMt5Ping, type Mt5PingPayload } from "@/lib/mt5/ping-service"
import {
  Mt5WebhookError,
  Mt5WebhookTableMissingError,
  resolveUserByMt5ApiKey,
} from "@/lib/mt5/webhook-server-service"

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8)
  try {
    const contentType = request.headers.get("content-type") ?? ""
    let record: Record<string, unknown> = {}
    if (contentType.includes("application/json")) {
      record = (await request.json()) as Record<string, unknown>
    } else {
      const text = await request.text()
      if (text.trim()) record = JSON.parse(text) as Record<string, unknown>
    }

    const apiKey = extractMt5ApiKey(request, {
      api_key: String(record.api_key ?? record.apiKey ?? ""),
      ticket: "ping",
      symbol: "PING",
      direction: "BUY",
      profit: 0,
    })

    if (!apiKey) throw new Mt5WebhookError("Missing API key.", 401)

    const supabase = createServiceRoleClient()
    const user = await resolveUserByMt5ApiKey(supabase, apiKey)

    const ping: Mt5PingPayload = {
      ping: true,
      account_login: record.account_login as string | number | undefined,
      broker: record.broker as string | undefined,
      balance: Number(record.balance) || undefined,
      equity: Number(record.equity) || undefined,
      terminal: record.terminal as string | undefined,
      ea_version: record.ea_version as string | undefined,
    }

    console.log(`[MT5 Ping] ${requestId} user=${user.user_id}`, ping)

    await recordMt5Ping(supabase, user.user_id, ping, "MT5 connection ping OK.")

    return NextResponse.json({
      ok: true,
      requestId,
      message: "Ping OK",
      server_time: new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof Mt5WebhookTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (error instanceof Mt5WebhookError) {
      return NextResponse.json({ error: error.message, requestId }, { status: error.statusCode })
    }
    console.error(`[MT5 Ping] ${requestId} error:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ping failed", requestId },
      { status: 500 },
    )
  }
}
