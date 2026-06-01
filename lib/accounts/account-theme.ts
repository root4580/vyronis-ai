import type { TradingAccountRecord } from "@/lib/accounts/types"

export type AccountAccent = "cyan" | "violet" | "amber" | "emerald" | "rose" | "sky"

export const ACCOUNT_ACCENT_PALETTE: AccountAccent[] = [
  "cyan",
  "violet",
  "amber",
  "emerald",
  "rose",
  "sky",
]

const ACCENT_STYLES: Record<
  AccountAccent,
  { border: string; bg: string; text: string; dot: string; ring: string }
> = {
  cyan: {
    border: "border-cyan-glow/25",
    bg: "bg-cyan-glow/[0.08]",
    text: "text-cyan-glow",
    dot: "bg-cyan-glow",
    ring: "ring-cyan-glow/30",
  },
  violet: {
    border: "border-violet-400/25",
    bg: "bg-violet-500/[0.08]",
    text: "text-violet-300",
    dot: "bg-violet-400",
    ring: "ring-violet-400/30",
  },
  amber: {
    border: "border-amber-400/25",
    bg: "bg-amber-500/[0.08]",
    text: "text-amber-300",
    dot: "bg-amber-400",
    ring: "ring-amber-400/30",
  },
  emerald: {
    border: "border-emerald-400/25",
    bg: "bg-emerald-500/[0.08]",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
    ring: "ring-emerald-400/30",
  },
  rose: {
    border: "border-rose-400/25",
    bg: "bg-rose-500/[0.08]",
    text: "text-rose-300",
    dot: "bg-rose-400",
    ring: "ring-rose-400/30",
  },
  sky: {
    border: "border-sky-400/25",
    bg: "bg-sky-500/[0.08]",
    text: "text-sky-300",
    dot: "bg-sky-400",
    ring: "ring-sky-400/30",
  },
}

export function normalizeAccountAccent(value?: string | null): AccountAccent {
  if (value && ACCOUNT_ACCENT_PALETTE.includes(value as AccountAccent)) {
    return value as AccountAccent
  }
  return "cyan"
}

export function pickAccentForIndex(index: number): AccountAccent {
  return ACCOUNT_ACCENT_PALETTE[index % ACCOUNT_ACCENT_PALETTE.length]
}

export function getAccountAccentStyles(account: Pick<TradingAccountRecord, "accent_color">) {
  return ACCENT_STYLES[normalizeAccountAccent(account.accent_color)]
}

export function hashAccountAccent(accountId: string): AccountAccent {
  let hash = 0
  for (let index = 0; index < accountId.length; index += 1) {
    hash = (hash + accountId.charCodeAt(index) * (index + 1)) % 9973
  }
  return pickAccentForIndex(hash)
}
