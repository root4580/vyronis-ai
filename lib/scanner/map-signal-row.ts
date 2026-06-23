import {
  formatRiskReward,
  scoreScannerSetup,
  type ScannerBias,
  type ScannerChochBosStatus,
  type ScannerGrade,
  type ScannerLiquiditySweepStatus,
} from "@/lib/scanner/scoring"
import type { ScannerSignalRow } from "@/lib/scanner/types"
import type { ScannerLiveSignal, ScannerSignalStatus } from "@/lib/scanner/signal-types"

function parseBias(value: string): ScannerBias {
  const v = value.toLowerCase()
  if (v === "bullish") return "Bullish"
  if (v === "bearish") return "Bearish"
  return "Neutral"
}

function rowStatusToUi(status: string): ScannerSignalStatus {
  if (status === "active") return "active"
  if (status === "watchlist") return "watching"
  return "expired"
}

function normalizeGrade(grade: string): ScannerGrade {
  if (grade === "A+ Sniper" || grade === "A+") return "A+ Sniper"
  if (grade === "A Strong" || grade === "A") return "A Strong"
  if (grade === "B Watchlist" || grade === "B") return "B Watchlist"
  return "Skip"
}

function sweepStatus(sweep: string | null): ScannerLiquiditySweepStatus {
  if (!sweep || sweep === "None") return "None"
  return "Confirmed"
}

function chochStatus(choch: string | null): ScannerChochBosStatus {
  if (!choch || choch === "None") return "None"
  return "CHoCH"
}

function formatDetectedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export function rowToLiveSignal(row: ScannerSignalRow): ScannerLiveSignal {
  const dailyBias = parseBias(row.daily_bias)
  const h4Bias = parseBias(row.h4_bias)
  const weeklyBias = parseBias(row.weekly_bias ?? row.daily_bias)
  const grade = normalizeGrade(row.grade)
  const riskRewardRatio = Number(row.risk_reward)

  const scoring = scoreScannerSetup({
    direction: row.direction,
    dailyBias,
    h4Bias,
    validZone: true,
    zoneType: row.zone_type,
    liquiditySweep: sweepStatus(row.sweep),
    chochBos: chochStatus(row.choch),
    engulfingConfirmation: row.confirmation_type !== "None",
    confirmationType: row.confirmation_type,
    sessionAlignment: true,
    session: row.session,
    riskRewardRatio,
    bosBonus: row.raw_payload?.bos_bonus === true,
  })

  return {
    id: row.id,
    pair: row.pair,
    direction: row.direction,
    grade,
    score: row.score,
    confidence: scoring.confidence,
    scoring,
    setup: `${row.session} ${row.zone_type} — ${row.confirmation_type}`,
    session: row.session,
    detectedAt: formatDetectedAt(row.detected_at),
    status: rowStatusToUi(row.status),
    entry: Number(row.entry_price ?? 0),
    stopLoss: Number(row.stop_loss ?? 0),
    takeProfit: Number(row.take_profit ?? 0),
    riskRewardRatio,
    riskReward: formatRiskReward(riskRewardRatio),
    weeklyBias,
    dailyBias,
    h4Bias,
    zoneType: row.zone_type,
    liquiditySweepStatus: sweepStatus(row.sweep),
    chochBosStatus: chochStatus(row.choch),
    confirmationType: row.confirmation_type,
    sweepLabel: row.sweep ?? undefined,
    chochLabel: row.choch ?? undefined,
    notes: `MT5 scanner — ${row.grade}`,
  }
}
