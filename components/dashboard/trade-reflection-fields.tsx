"use client"

import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  REFLECTION_FIELD_MAX_LENGTH,
  type TradeFormState,
} from "@/lib/trade-form-config"
import { cn } from "@/lib/utils"

function FieldLabel({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium text-foreground/90">{children}</p>
      {hint ? <p className="text-[10px] text-muted-foreground/65">{hint}</p> : null}
    </div>
  )
}

function ReflectionTextarea({
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
        <FieldLabel hint={hint}>{label}</FieldLabel>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
          {value.length}/{REFLECTION_FIELD_MAX_LENGTH}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, REFLECTION_FIELD_MAX_LENGTH))}
        placeholder={placeholder}
        className="add-trade-input min-h-[72px] resize-none"
      />
    </div>
  )
}

type TradeReflectionFieldsProps = {
  form: TradeFormState
  onFormChange: (patch: Partial<TradeFormState>) => void
  showDuration?: boolean
  className?: string
}

export function TradeReflectionFields({
  form,
  onFormChange,
  showDuration = true,
  className,
}: TradeReflectionFieldsProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/90">
          Post-trade reflection
        </p>
        <p className="text-[10px] leading-relaxed text-muted-foreground/70">
          Capture what you were thinking and what to take into the next session.
        </p>
      </div>

      <ReflectionTextarea
        label="Thinking before trade"
        hint="Setup thesis, confidence, and plan."
        value={form.thinking_before}
        placeholder="Why did I take this? What was my plan?"
        onChange={(thinking_before) => onFormChange({ thinking_before })}
      />
      <ReflectionTextarea
        label="Thinking during trade"
        hint="Management, emotions, and adjustments."
        value={form.thinking_during}
        placeholder="Did I manage it well? Did I move stops or hesitate?"
        onChange={(thinking_during) => onFormChange({ thinking_during })}
      />
      <ReflectionTextarea
        label="Thinking after trade"
        hint="Honest review right after close."
        value={form.thinking_after}
        placeholder="How do I feel now? Was the outcome fair?"
        onChange={(thinking_after) => onFormChange({ thinking_after })}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ReflectionTextarea
          label="What worked"
          value={form.what_worked}
          placeholder="Discipline, timing, patience…"
          onChange={(what_worked) => onFormChange({ what_worked })}
        />
        <ReflectionTextarea
          label="What didn't work"
          value={form.what_didnt_work}
          placeholder="Hesitation, oversize, late entry…"
          onChange={(what_didnt_work) => onFormChange({ what_didnt_work })}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ReflectionTextarea
          label="Biggest mistake"
          value={form.biggest_mistake}
          placeholder="One thing to fix next time"
          onChange={(biggest_mistake) => onFormChange({ biggest_mistake })}
        />
        <ReflectionTextarea
          label="Lesson learned"
          value={form.lesson_learned}
          placeholder="One sentence you'll remember"
          onChange={(lesson_learned) => onFormChange({ lesson_learned })}
        />
      </div>

      {showDuration ? (
        <div className="space-y-2">
          <FieldLabel hint="Optional — MT5 imports use open/close timestamps automatically.">
            Hold time (minutes)
          </FieldLabel>
          <Input
            type="number"
            min="0"
            step="1"
            value={form.hold_minutes}
            onChange={(e) => onFormChange({ hold_minutes: e.target.value })}
            className="add-trade-input h-10 max-w-[10rem] tabular-nums"
            placeholder="45"
          />
        </div>
      ) : null}
    </div>
  )
}
