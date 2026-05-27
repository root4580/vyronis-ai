import { filterTradesForWeek } from "@/lib/ai/weekly-debrief-engine"
import { detectPrimaryLeak, formatMoney, type LeakEngineInput } from "@/lib/behavior"
import { formatPnL } from "@/lib/trade-utils"
import type { WeeklyReviewReport } from "@/lib/weekly-review/types"

export type BehavioralExportSummary = {
  biggestWin: string
  biggestLeak: string
  moneyOnTable: string
  correctiveFocus: string
  weekPnL: string
  sessionLine: string
  consistencyLine: string
}

export function buildBehavioralExportSummary(
  report: WeeklyReviewReport,
  trades: LeakEngineInput["trades"],
  maxRiskPerTrade = 1,
): BehavioralExportSummary {
  const weekStart = new Date(`${report.weekStart}T12:00:00`)
  const weekEnd = new Date(`${report.weekEnd}T12:00:00`)
  const weekTrades = filterTradesForWeek(
    trades as Parameters<typeof filterTradesForWeek>[0],
    weekStart,
    weekEnd,
  ) as LeakEngineInput["trades"]

  const weekLeak = detectPrimaryLeak({
    trades: weekTrades,
    maxRiskPerTrade,
    lookbackDays: 14,
  })

  const bestTrade = [...weekTrades].sort(
    (a, b) => (b.pnl ?? 0) - (a.pnl ?? 0),
  )[0]
  const biggestWin = bestTrade
    ? `${bestTrade.pair} ${bestTrade.direction} · ${formatPnL(bestTrade.pnl, bestTrade.result)}`
    : "No winning trades logged this week."

  const biggestLeak =
    weekLeak.status === "insufficient_data"
      ? report.recurringMistakes[0] ?? report.weakestHabit ?? "Keep logging — leak detection needs more trades."
      : weekLeak.headline

  const moneyOnTable =
    weekLeak.evidence && weekLeak.evidence.estimatedMoneyLost > 0
      ? `~${formatMoney(weekLeak.evidence.estimatedMoneyLost)} attributed to flagged behavior this week`
      : report.recurringMistakes.length > 0
        ? `Recurring: ${report.recurringMistakes.slice(0, 2).join(", ")}`
        : "No quantified leak yet — discipline tags will sharpen this."

  const correctiveFocus =
    weekLeak.status !== "insufficient_data"
      ? weekLeak.correctiveAction
      : report.improvementPlan[0] ?? "One rule for next week: confirm emotion before every entry."

  const pnlTone = report.totalPnL >= 0 ? "WIN" : "LOSS"

  return {
    biggestWin,
    biggestLeak,
    moneyOnTable,
    correctiveFocus,
    weekPnL: formatPnL(report.totalPnL, pnlTone),
    sessionLine: report.strongestSession
      ? `Best session: ${report.strongestSession}`
      : "Session edge: log session on every trade",
    consistencyLine: `Consistency ${report.scores.consistency}/100 · Discipline ${report.scores.discipline}/100`,
  }
}

export function buildBehavioralPrintHtml(
  report: WeeklyReviewReport,
  summary: BehavioralExportSummary,
): string {
  const generated = new Date(report.generatedAt).toLocaleString()

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Vyronis Weekly Behavioral Review — ${report.weekLabel}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #e8eaef;
      background: #0a0c10;
      margin: 0;
      padding: 32px;
      line-height: 1.5;
    }
    h1 { font-size: 22px; margin: 0 0 8px; font-weight: 600; }
    .meta { color: #8b919e; font-size: 12px; margin-bottom: 28px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .card {
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 14px 16px;
      background: rgba(255,255,255,0.03);
    }
    .label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #6ee7d7;
      margin-bottom: 6px;
    }
    .value { font-size: 14px; }
    .focus {
      border-color: rgba(110, 231, 215, 0.35);
      background: rgba(110, 231, 215, 0.06);
    }
    footer { margin-top: 32px; font-size: 11px; color: #6b7280; }
    @media print {
      body { background: #fff; color: #111; padding: 24px; }
      .card { border-color: #ddd; background: #f9fafb; }
      .label { color: #0d9488; }
      footer { color: #666; }
    }
  </style>
</head>
<body>
  <h1>Vyronis · Weekly Behavioral Review</h1>
  <p class="meta">${report.weekLabel} · Generated ${generated} · ${report.tradeCount} trades · ${report.winRate}% win rate · P&L ${summary.weekPnL}</p>

  <div class="grid">
    <div class="card">
      <div class="label">Biggest win</div>
      <div class="value">${escapeHtml(summary.biggestWin)}</div>
    </div>
    <div class="card">
      <div class="label">Biggest leak</div>
      <div class="value">${escapeHtml(summary.biggestLeak)}</div>
    </div>
    <div class="card">
      <div class="label">Money on table</div>
      <div class="value">${escapeHtml(summary.moneyOnTable)}</div>
    </div>
    <div class="card focus">
      <div class="label">Corrective focus (next week)</div>
      <div class="value">${escapeHtml(summary.correctiveFocus)}</div>
    </div>
  </div>

  <div class="card">
    <div class="label">Session & consistency</div>
    <div class="value">${escapeHtml(summary.sessionLine)} · ${escapeHtml(summary.consistencyLine)}</div>
  </div>

  <footer>Behavioral discipline OS · Journal-derived insights only · Not trade advice</footer>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function printBehavioralWeeklyReview(
  report: WeeklyReviewReport,
  summary: BehavioralExportSummary,
): void {
  const html = buildBehavioralPrintHtml(report, summary)
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=800,height=900")
  if (!printWindow) return
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.onload = () => {
    printWindow.print()
  }
}
