"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { getDashboardHomeHref } from "@/lib/dashboard-nav"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  BookOpen,
  Loader2,
  Plus,
  Save,
  Trash2,
  ArrowLeft,
  Star,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardInsetPanel,
} from "@/components/dashboard/dashboard-primitives"
import {
  createDefaultPlaybookInput,
  normalizeStrategyPlaybookInput,
} from "@/lib/strategy/default-playbook"
import {
  createStrategyPlaybookApi,
  deleteStrategyPlaybookApi,
  fetchStrategyPlaybooks,
  updateStrategyPlaybookApi,
} from "@/lib/strategy/api-client"
import type { PlaybookRuleItem, StrategyPlaybookInput, StrategyPlaybookRecord } from "@/lib/strategy/types"
import { cn } from "@/lib/utils"

function RuleRow({
  rule,
  onChange,
}: {
  rule: PlaybookRuleItem
  onChange: (next: PlaybookRuleItem) => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-foreground/90">{rule.label}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground/75">
        <label className="flex items-center gap-1.5">
          <Checkbox
            checked={rule.enabled}
            onCheckedChange={(checked) => onChange({ ...rule, enabled: checked === true })}
          />
          On
        </label>
        <label className="flex items-center gap-1.5">
          <Checkbox
            checked={rule.required}
            onCheckedChange={(checked) => onChange({ ...rule, required: checked === true })}
          />
          Required
        </label>
      </div>
    </div>
  )
}

function StringListEditor({
  title,
  items,
  onChange,
  placeholder,
}: {
  title: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
}) {
  return (
    <DashboardInsetPanel className="space-y-2 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/75">
        {title}
      </p>
      {items.map((item, index) => (
        <div key={`${title}-${index}`} className="flex gap-2">
          <Input
            value={item}
            onChange={(event) => {
              const next = [...items]
              next[index] = event.target.value
              onChange(next)
            }}
            placeholder={placeholder}
            className="add-trade-input h-9"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0 border-loss/20"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            <Trash2 className="size-3.5 text-loss" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-8 border-white/[0.08] text-[11px]"
        onClick={() => onChange([...items, ""])}
      >
        <Plus className="mr-1.5 size-3.5" />
        Add rule
      </Button>
    </DashboardInsetPanel>
  )
}

export function StrategyPlaybookMain({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [playbooks, setPlaybooks] = useState<StrategyPlaybookRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<StrategyPlaybookInput>(createDefaultPlaybookInput())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedPlaybook = useMemo(
    () => playbooks.find((playbook) => playbook.id === selectedId) ?? null,
    [playbooks, selectedId],
  )

  const loadPlaybooks = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!embedded) {
          router.replace("/auth/login?next=/strategy")
        }
        return
      }

      const rows = await fetchStrategyPlaybooks()
      setPlaybooks(rows)
      if (rows.length > 0) {
        setSelectedId((current) => current ?? rows.find((row) => row.is_default)?.id ?? rows[0].id)
      } else {
        setSelectedId(null)
        setDraft(createDefaultPlaybookInput())
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load playbooks")
    } finally {
      setIsLoading(false)
    }
  }, [embedded, router, supabase])

  useEffect(() => {
    void loadPlaybooks()
  }, [loadPlaybooks])

  useEffect(() => {
    if (!selectedPlaybook) return
    setDraft(normalizeStrategyPlaybookInput(selectedPlaybook))
  }, [selectedPlaybook])

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    try {
      const payload = normalizeStrategyPlaybookInput(draft)
      if (selectedId) {
        const updated = await updateStrategyPlaybookApi(selectedId, payload)
        setPlaybooks((current) => current.map((row) => (row.id === updated.id ? updated : row)))
      } else {
        const created = await createStrategyPlaybookApi(payload)
        setPlaybooks((current) => [created, ...current])
        setSelectedId(created.id)
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save playbook")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateNew() {
    setSelectedId(null)
    setDraft(createDefaultPlaybookInput(`Strategy ${playbooks.length + 1}`))
  }

  async function handleDelete() {
    if (!selectedId) return
    setIsSaving(true)
    setError(null)
    try {
      await deleteStrategyPlaybookApi(selectedId)
      const remaining = playbooks.filter((row) => row.id !== selectedId)
      setPlaybooks(remaining)
      setSelectedId(remaining[0]?.id ?? null)
      setDraft(
        remaining[0]
          ? normalizeStrategyPlaybookInput(remaining[0])
          : createDefaultPlaybookInput(),
      )
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete playbook")
    } finally {
      setIsSaving(false)
    }
  }

  function updateRuleSection<K extends "bias_rules" | "entry_rules">(
    section: K,
    key: keyof StrategyPlaybookInput[K],
    next: PlaybookRuleItem,
  ) {
    setDraft((current) => ({
      ...current,
      [section]: {
        ...(current[section] as StrategyPlaybookInput[K]),
        [key]: next,
      },
    }))
  }

  function updateInvalidationRule(key: keyof StrategyPlaybookInput["invalidation_rules"], next: PlaybookRuleItem) {
    if (key === "custom") return
    setDraft((current) => ({
      ...current,
      invalidation_rules: {
        ...current.invalidation_rules,
        [key]: next,
      },
    }))
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {!embedded && (
            <Link
              href={getDashboardHomeHref()}
              className="mb-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70 hover:text-cyan-glow"
            >
              <ArrowLeft className="size-3.5" />
              Back to Dashboard
            </Link>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Strategy Playbook</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground/75">
            Multi-Timeframe FX Continuation — one playbook for chart coach (Sunday focus → AOI →
            confirmation). Duplicates merge on load.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild className="h-9 border-violet-500/25 text-violet-200">
            <Link href="/strategy-brain">Strategy Brain</Link>
          </Button>
          {playbooks.length > 1 ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 border-white/[0.08]"
              onClick={() => void handleCreateNew()}
            >
              <Plus className="mr-2 size-4" />
              New Playbook
            </Button>
          ) : null}
          <Button
            type="button"
            className="h-9 bg-gradient-to-r from-cyan-glow to-profit text-background"
            disabled={isSaving}
            onClick={() => void handleSave()}
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Save Playbook
          </Button>
        </div>
      </div>

      {error && (
        <DashboardInsetPanel className="mb-4 border-loss/20 bg-loss/[0.06] px-3 py-2.5">
          <p className="text-[12px] text-loss/90">{error}</p>
        </DashboardInsetPanel>
      )}

      {isLoading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-cyan-glow" />
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-4",
            playbooks.length > 1 && "lg:grid-cols-[280px_minmax(0,1fr)]",
          )}
        >
          {playbooks.length > 1 ? (
            <DashboardCard className="glass-card h-fit" glow>
              <DashboardCardHeader title="Your Playbooks" icon={BookOpen} />
              <DashboardCardBody className="space-y-2 pt-2">
                {playbooks.map((playbook) => (
                  <button
                    key={playbook.id}
                    type="button"
                    onClick={() => setSelectedId(playbook.id)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left transition-all",
                      selectedId === playbook.id
                        ? "border-cyan-glow/30 bg-cyan-glow/[0.08]"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {playbook.strategy_name}
                      </span>
                      {playbook.is_default && (
                        <Badge variant="outline" className="h-5 shrink-0 text-[9px]">
                          <Star className="mr-1 size-3" />
                          Default
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </DashboardCardBody>
            </DashboardCard>
          ) : playbooks.length === 1 ? (
            <DashboardInsetPanel className="flex items-center gap-2 border-cyan-glow/20 bg-cyan-glow/[0.04] px-3 py-2.5">
              <BookOpen className="size-4 shrink-0 text-cyan-glow" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {playbooks[0].strategy_name}
                </p>
                <p className="text-[10px] text-muted-foreground/70">Default · used by AI Trade Coach</p>
              </div>
              {playbooks[0].is_default ? (
                <Badge variant="outline" className="ml-auto h-5 shrink-0 text-[9px]">
                  <Star className="mr-1 size-3" />
                  Default
                </Badge>
              ) : null}
            </DashboardInsetPanel>
          ) : null}

          <div className="space-y-4">
            <DashboardCard className="glass-card" glow interactive>
              <DashboardCardHeader title="Playbook Setup" icon={BookOpen} />
              <DashboardCardBody className="space-y-4 pt-2">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground/75">Strategy name</Label>
                    <Input
                      value={draft.strategy_name}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, strategy_name: event.target.value }))
                      }
                      className="add-trade-input h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground/75">Ideal R:R minimum</Label>
                    <Input
                      type="number"
                      min={1}
                      step={0.1}
                      value={draft.rr_minimum}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          rr_minimum: Number(event.target.value) || 2,
                        }))
                      }
                      className="add-trade-input h-10"
                    />
                  </div>
                </div>

                <Textarea
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Describe your edge, session, and ideal market conditions."
                  className="add-trade-input min-h-[72px]"
                />

                <label className="flex items-center gap-2 text-[12px] text-muted-foreground/80">
                  <Checkbox
                    checked={draft.is_default}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, is_default: checked === true }))
                    }
                  />
                  Use as default playbook in AI Trade Coach
                </label>
              </DashboardCardBody>
            </DashboardCard>

            <DashboardCard className="glass-card" glow>
              <DashboardCardHeader title="Market Bias & HTF Rules" icon={BookOpen} />
              <DashboardCardBody className="space-y-2 pt-2">
                {Object.entries(draft.bias_rules).map(([key, rule]) => (
                  <RuleRow
                    key={key}
                    rule={rule}
                    onChange={(next) =>
                      updateRuleSection("bias_rules", key as keyof StrategyPlaybookInput["bias_rules"], next)
                    }
                  />
                ))}
              </DashboardCardBody>
            </DashboardCard>

            <DashboardCard className="glass-card" glow>
              <DashboardCardHeader title="Entry Confirmation Rules" icon={BookOpen} />
              <DashboardCardBody className="space-y-2 pt-2">
                {Object.entries(draft.entry_rules).map(([key, rule]) => (
                  <RuleRow
                    key={key}
                    rule={rule}
                    onChange={(next) =>
                      updateRuleSection("entry_rules", key as keyof StrategyPlaybookInput["entry_rules"], next)
                    }
                  />
                ))}
              </DashboardCardBody>
            </DashboardCard>

            <DashboardCard className="glass-card" glow>
              <DashboardCardHeader title="Invalidation & Warnings" icon={BookOpen} />
              <DashboardCardBody className="space-y-2 pt-2">
                <RuleRow
                  rule={draft.invalidation_rules.countertrend_warning}
                  onChange={(next) => updateInvalidationRule("countertrend_warning", next)}
                />
                <RuleRow
                  rule={draft.invalidation_rules.no_confirmation_warning}
                  onChange={(next) => updateInvalidationRule("no_confirmation_warning", next)}
                />
                <RuleRow
                  rule={draft.invalidation_rules.early_entry_warning}
                  onChange={(next) => updateInvalidationRule("early_entry_warning", next)}
                />
                <StringListEditor
                  title="Custom invalidation rules"
                  items={draft.invalidation_rules.custom}
                  onChange={(custom) =>
                    setDraft((current) => ({
                      ...current,
                      invalidation_rules: { ...current.invalidation_rules, custom },
                    }))
                  }
                  placeholder="e.g. Price invalidates AOI before entry"
                />
              </DashboardCardBody>
            </DashboardCard>

            <DashboardCard className="glass-card" glow>
              <DashboardCardHeader title="Required Confluences" icon={BookOpen} />
              <DashboardCardBody className="space-y-2 pt-2">
                {draft.confluence_rules.items.map((rule, index) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    onChange={(next) =>
                      setDraft((current) => ({
                        ...current,
                        confluence_rules: {
                          items: current.confluence_rules.items.map((item, i) =>
                            i === index ? next : item,
                          ),
                        },
                      }))
                    }
                  />
                ))}
              </DashboardCardBody>
            </DashboardCard>

            <StringListEditor
              title="Forbidden conditions"
              items={draft.forbidden_conditions.items}
              onChange={(items) =>
                setDraft((current) => ({
                  ...current,
                  forbidden_conditions: { items },
                }))
              }
              placeholder="e.g. Trading against HTF bias"
            />

            <DashboardCard className="glass-card" glow>
              <DashboardCardHeader title="Example Notes" icon={BookOpen} />
              <DashboardCardBody className="grid gap-3 pt-2 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground/75">Example winner notes</Label>
                  <Textarea
                    value={draft.example_notes.winner_notes}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        example_notes: {
                          ...current.example_notes,
                          winner_notes: event.target.value,
                        },
                      }))
                    }
                    className="add-trade-input min-h-[96px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground/75">Example loser notes</Label>
                  <Textarea
                    value={draft.example_notes.loser_notes}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        example_notes: {
                          ...current.example_notes,
                          loser_notes: event.target.value,
                        },
                      }))
                    }
                    className="add-trade-input min-h-[96px]"
                  />
                </div>
              </DashboardCardBody>
            </DashboardCard>

            {selectedId && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="border-loss/20 text-loss hover:bg-loss/[0.06]"
                  disabled={isSaving}
                  onClick={() => void handleDelete()}
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete Playbook
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
