"use client"

import Link from "next/link"
import { CheckCircle2, Moon, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DAILY_JOURNAL_FIELD_MAX_LENGTH } from "@/lib/daily-journal/constants"
import { useDailyJournalClose } from "@/hooks/use-daily-journal-close"
import { getJournalCloseHref } from "@/lib/dashboard-nav"
import { cn } from "@/lib/utils"

function FieldBlock({
  label,
  hint,
  value,
  placeholder,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium text-text-primary">{label}</p>
          {hint ? <p className="mt-0.5 text-[10px] text-text-muted">{hint}</p> : null}
        </div>
        <span className="shrink-0 text-[10px] tabular-nums text-text-muted">
          {value.length}/{DAILY_JOURNAL_FIELD_MAX_LENGTH}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, DAILY_JOURNAL_FIELD_MAX_LENGTH))}
        placeholder={placeholder}
        className="min-h-[80px] resize-none border-[var(--border-subtle)] bg-[var(--surface-card)] text-[12px]"
      />
    </div>
  )
}

export function DailyClosePanel({
  accountId,
  todayTradeCount,
  todayWinCount,
  todayLossCount,
  compact = false,
  className,
}: {
  accountId: string
  todayTradeCount: number
  todayWinCount: number
  todayLossCount: number
  compact?: boolean
  className?: string
}) {
  const journal = useDailyJournalClose(accountId)

  async function handleSave() {
    const ok = await journal.save()
    if (ok && compact) {
      // keep user on HQ after save
    }
  }

  const dayClosed = journal.isComplete && Boolean(journal.savedAt)

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-md)] border",
        dayClosed
          ? "border-profit/25 bg-profit/[0.04]"
          : "border-[var(--border-subtle)] bg-[var(--surface-card)]",
        className,
      )}
    >
      <div className="flex items-start gap-2 border-b border-[var(--border-subtle)] px-3.5 py-3">
        {dayClosed ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-profit" />
        ) : (
          <Moon className="mt-0.5 size-4 shrink-0 text-text-accent" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-accent">
            Close the day
          </p>
          <p className="mt-0.5 text-[12px] text-text-muted">
            {todayTradeCount > 0
              ? `${todayTradeCount} trade${todayTradeCount === 1 ? "" : "s"} today · ${todayWinCount}W · ${todayLossCount}L`
              : "No trades logged today — still worth closing with intent for tomorrow."}
          </p>
        </div>
        {compact ? (
          <Link
            href={getJournalCloseHref()}
            className="shrink-0 text-[11px] font-medium text-text-accent hover:underline"
          >
            Full view
          </Link>
        ) : null}
      </div>

      <div className="space-y-4 px-3.5 py-3.5">
        {!journal.connected ? (
          <p className="text-[12px] leading-relaxed text-text-muted">
            {journal.setupMessage ?? "Daily journal unavailable. Run the Supabase migration."}
          </p>
        ) : journal.loading ? (
          <p className="text-[12px] text-text-muted animate-pulse">Loading today&apos;s close…</p>
        ) : (
          <>
            <FieldBlock
              label="What to improve tomorrow"
              hint="One concrete behavior — not a vague goal."
              value={journal.form.improveTomorrow}
              placeholder="e.g. Wait for H4 confirmation before entry"
              onChange={(improveTomorrow) => journal.setForm((current) => ({ ...current, improveTomorrow }))}
            />
            <FieldBlock
              label="Rules for next session"
              hint="Hard lines you will not cross tomorrow."
              value={journal.form.rulesNextSession}
              placeholder="e.g. Max 2 trades · No revenge after first loss"
              onChange={(rulesNextSession) => journal.setForm((current) => ({ ...current, rulesNextSession }))}
            />
            <FieldBlock
              label="Focus area"
              hint="The one skill or setup to prioritize."
              value={journal.form.focusArea}
              placeholder="e.g. Patience at AOI · Only A+ setups on EURUSD"
              onChange={(focusArea) => journal.setForm((current) => ({ ...current, focusArea }))}
            />

            {journal.error ? (
              <p className="text-[12px] text-loss/90">{journal.error}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={journal.saving || !journal.isComplete}
                onClick={() => void handleSave()}
                className="h-8 bg-text-accent text-[11px] text-white hover:bg-text-accent/90"
              >
                {journal.saving ? "Saving…" : dayClosed ? "Update close" : "Close the day"}
              </Button>
              <button
                type="button"
                onClick={() => void journal.reload()}
                className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-accent"
              >
                <RefreshCw className="size-3" />
                Refresh
              </button>
              {journal.savedAt ? (
                <span className="text-[10px] text-text-muted">
                  Saved {new Date(journal.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
