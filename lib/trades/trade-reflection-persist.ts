import type { TradeFormState } from "@/lib/trade-form-config"
import { parseOptionalNumber } from "@/lib/trade-form-utils"

function parseOptionalInteger(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function trimOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

export function buildTradeReflectionPersistFields(form: TradeFormState) {
  return {
    lots: parseOptionalNumber(form.lots),
    hold_minutes: parseOptionalInteger(form.hold_minutes),
    thinking_before: trimOrNull(form.thinking_before),
    thinking_during: trimOrNull(form.thinking_during),
    thinking_after: trimOrNull(form.thinking_after),
    biggest_mistake: trimOrNull(form.biggest_mistake),
    lesson_learned: trimOrNull(form.lesson_learned),
    what_worked: trimOrNull(form.what_worked),
    what_didnt_work: trimOrNull(form.what_didnt_work),
  }
}

export const TRADE_REFLECTION_PERSIST_KEYS = [
  "lots",
  "hold_minutes",
  "thinking_before",
  "thinking_during",
  "thinking_after",
  "biggest_mistake",
  "lesson_learned",
  "what_worked",
  "what_didnt_work",
] as const
