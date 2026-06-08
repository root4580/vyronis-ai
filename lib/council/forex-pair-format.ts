/** Full 6-letter forex symbols for council speech and prompts (e.g. USDCHF, not USD/CHF). */

export function normalizeForexPairSymbol(pair: string | null | undefined): string {
  const raw = String(pair ?? "").trim()
  if (!raw || raw === "—" || /^unknown/i.test(raw)) return raw || "—"

  const normalized = raw.replace(/[^A-Za-z]/g, "").toUpperCase()
  if (normalized.length >= 6) return normalized.slice(0, 6)
  return normalized
}

export const COUNCIL_FOREX_PAIR_RULE =
  "When you name a forex pair, always say the full 6-letter symbol from the snapshot (e.g. USDCHF, EURUSD, AUDUSD). Never use slash format (USD/CHF), never only one currency (CHF or dollar), and never vague wording like \"the pair\" or \"top pair\" without the full symbol."
