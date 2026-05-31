import type { TradeFormState } from "@/lib/trade-form-config"

/** Pre-trade plan vs post-trade result vs full edit */
export type TradeJournalMode = "plan" | "log" | "edit"

export const PLANNED_SETUP_NOTE_MARKER = "[vyronis-planned-setup]"

export function isPlannedSetupTrade(notes: string | null | undefined): boolean {
  return Boolean(notes?.includes(PLANNED_SETUP_NOTE_MARKER))
}

export function appendPlannedSetupMarker(notes: string): string {
  const trimmed = notes.trim()
  if (trimmed.includes(PLANNED_SETUP_NOTE_MARKER)) return trimmed
  return trimmed ? `${PLANNED_SETUP_NOTE_MARKER}\n${trimmed}` : PLANNED_SETUP_NOTE_MARKER
}

export function stripPlannedSetupMarker(notes: string): string {
  return notes.replace(PLANNED_SETUP_NOTE_MARKER, "").trim()
}

export function journalModeLabel(mode: TradeJournalMode): string {
  if (mode === "plan") return "Plan setup"
  if (mode === "log") return "Log result"
  return "Edit trade"
}

export function journalModeDescription(mode: TradeJournalMode): string {
  if (mode === "plan") {
    return "Score your setup before you enter — HTF, AOI, confirmation, and A+ gate."
  }
  if (mode === "log") {
    return "Fast path after the trade — outcome, P&L, psychology, and notes."
  }
  return "Update any field on this journal entry."
}

export function submitLabel(mode: TradeJournalMode, isEditing: boolean): string {
  if (isEditing) return "Update trade"
  if (mode === "plan") return "Save setup & score"
  return "Save trade"
}

export function validateTradeFormForMode(
  form: TradeFormState,
  mode: TradeJournalMode,
): { ok: true } | { ok: false; message: string } {
  if (!form.pair || !form.direction) {
    return { ok: false, message: "Pair and direction are required." }
  }

  if (mode === "plan") {
    return { ok: true }
  }

  if (!form.result || !form.pnl) {
    return { ok: false, message: "Result and P&L are required when logging a trade." }
  }

  return { ok: true }
}
