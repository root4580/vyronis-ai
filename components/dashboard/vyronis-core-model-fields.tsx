"use client"

import { AlertTriangle } from "lucide-react"
import {
  VYRONIS_AOI_OPTIONS,
  VYRONIS_BIAS_OPTIONS,
  VYRONIS_CONFIRMATION_OPTIONS,
  VYRONIS_ENTRY_QUALITY_OPTIONS,
  type TradeFormState,
} from "@/lib/trade-form-config"
import { VYRONIS_CORE_MODEL } from "@/types/vyronis-branding"
import { cn } from "@/lib/utils"

type VyronisCoreModelFieldsProps = {
  form: TradeFormState
  onFormChange: (updates: Partial<TradeFormState>) => void
  rrWarning?: boolean
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/80">{children}</p>
  )
}

function ChipGrid<T extends string>({
  options,
  value,
  onChange,
  columns = "grid-cols-3",
}: {
  options: ReadonlyArray<{ value: T; label: string }>
  value: string
  onChange: (value: T) => void
  columns?: string
}) {
  return (
    <div className={cn("grid gap-1.5", columns, "sm:grid-cols-3")}>
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-lg border px-2 py-2 text-[10px] font-medium leading-tight transition-all sm:text-[11px]",
              active
                ? "border-cyan-glow/35 bg-cyan-glow/[0.12] text-cyan-glow"
                : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-cyan-glow/20",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function BiasRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/75">{label}</p>
      <ChipGrid
        options={VYRONIS_BIAS_OPTIONS}
        value={value}
        onChange={onChange}
        columns="grid-cols-3"
      />
    </div>
  )
}

export function VyronisCoreModelFields({ form, onFormChange, rrWarning }: VyronisCoreModelFieldsProps) {
  const htfIncomplete = !form.weekly_bias || !form.daily_bias || !form.h4_bias

  return (
    <section className="space-y-4 rounded-xl border border-cyan-glow/15 bg-cyan-glow/[0.03] p-3 sm:p-4">
      <div>
        <SectionLabel>{VYRONIS_CORE_MODEL}</SectionLabel>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Vyronis AI scores every journal entry with Vyronis strategy scoring on submit.
        </p>
      </div>

      <div className="space-y-3">
        <SectionLabel>HTF Bias</SectionLabel>
        <BiasRow
          label="Weekly"
          value={form.weekly_bias}
          onChange={(weekly_bias) => onFormChange({ weekly_bias })}
        />
        <BiasRow
          label="Daily"
          value={form.daily_bias}
          onChange={(daily_bias) => onFormChange({ daily_bias })}
        />
        <BiasRow label="H4" value={form.h4_bias} onChange={(h4_bias) => onFormChange({ h4_bias })} />
        {htfIncomplete && (
          <p className="flex items-center gap-1.5 text-[10px] text-warning-foreground">
            <AlertTriangle className="size-3 shrink-0" />
            All three HTF biases required — missing alignment auto-grades Skip.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <SectionLabel>AOI</SectionLabel>
        <ChipGrid
          options={VYRONIS_AOI_OPTIONS}
          value={form.aoi_type}
          onChange={(aoi_type) => onFormChange({ aoi_type })}
          columns="grid-cols-2 sm:grid-cols-3"
        />
      </div>

      <div className="space-y-2">
        <SectionLabel>Confirmation</SectionLabel>
        <ChipGrid
          options={VYRONIS_CONFIRMATION_OPTIONS}
          value={form.confirmation_type}
          onChange={(confirmation_type) => onFormChange({ confirmation_type })}
          columns="grid-cols-2 sm:grid-cols-3"
        />
      </div>

      <div className="space-y-2">
        <SectionLabel>Entry Quality</SectionLabel>
        <ChipGrid
          options={VYRONIS_ENTRY_QUALITY_OPTIONS}
          value={form.entry_quality}
          onChange={(entry_quality) => onFormChange({ entry_quality })}
          columns="grid-cols-2 sm:grid-cols-4"
        />
      </div>

      {rrWarning && (
        <p className="flex items-center gap-1.5 rounded-lg border border-warning/25 bg-warning/[0.08] px-3 py-2 text-[11px] text-warning-muted">
          <AlertTriangle className="size-3.5 shrink-0" />
          R:R below 1:2 — Vyronis will warn on this entry.
        </p>
      )}
    </section>
  )
}
