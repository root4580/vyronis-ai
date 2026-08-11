import { after, NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { readTradingViewRequestBody } from "@/lib/tradingview/payload-parser"
import { runTradingViewChartVisionEnrichment } from "@/lib/tradingview/schedule-chart-vision"
import {
  ingestTradingViewAlert,
  TradingViewTableMissingError,
  TradingViewWebhookError,
} from "@/lib/tradingview/webhook-server-service"

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient()
    const rateLimit = await checkRateLimit(
      supabase,
      `tradingview-webhook:${getClientIp(request)}`,
      { maxRequests: 60, windowSeconds: 60 },
    )
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit)
    }

    const payload = await readTradingViewRequestBody(request)
    const rawPayload =
      payload && typeof payload === "object"
        ? (payload as unknown as Record<string, unknown>)
        : {}
    const { result, chartVision } = await ingestTradingViewAlert(supabase, payload, {
      ...rawPayload,
      received_content_type: request.headers.get("content-type"),
    })

    if (chartVision) {
      after(() => {
        runTradingViewChartVisionEnrichment(supabase, chartVision)
      })
    }

    return NextResponse.json(result, { status: result.duplicate ? 200 : 202 })
  } catch (error) {
    if (error instanceof TradingViewTableMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (error instanceof TradingViewWebhookError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("TradingView webhook error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook ingest failed" },
      { status: 500 },
    )
  }
}
