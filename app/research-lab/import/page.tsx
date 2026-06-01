"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, FileUp, FlaskConical, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DashboardChrome } from "@/components/dashboard/dashboard-chrome"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { SigningOutScreen } from "@/components/auth/signing-out-screen"
import { useAccountSettingsModal } from "@/hooks/use-account-settings-modal"
import { useDashboardChrome } from "@/hooks/use-dashboard-chrome"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import {
  createResearchStrategy,
  fetchResearchStrategies,
  importResearchCsv,
} from "@/lib/research/api-client"
import type { CsvImportResult, ImportPreviewRow, ResearchStrategyRecord } from "@/lib/research/types"

export default function ResearchLabImportPage() {
  const router = useRouter()
  const { toast } = useToast()
  const chrome = useDashboardChrome({ loginNextPath: "/research-lab/import" })
  const settings = useAccountSettingsModal(chrome.supabase, chrome.user?.id)

  const [strategies, setStrategies] = useState<ResearchStrategyRecord[]>([])
  const [selectedStrategyId, setSelectedStrategyId] = useState("")
  const [newStrategyName, setNewStrategyName] = useState("")
  const [newMagicNumber, setNewMagicNumber] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewRow[]>([])
  const [previewResult, setPreviewResult] = useState<CsvImportResult | null>(null)
  const [isLoadingStrategies, setIsLoadingStrategies] = useState(true)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isCreatingStrategy, setIsCreatingStrategy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!chrome.isAuthReady) return

    let cancelled = false

    async function loadStrategies() {
      setIsLoadingStrategies(true)
      try {
        const rows = await fetchResearchStrategies()
        if (!cancelled) {
          setStrategies(rows)
          if (rows[0] && !selectedStrategyId) {
            setSelectedStrategyId(rows[0].id)
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load strategies")
        }
      } finally {
        if (!cancelled) setIsLoadingStrategies(false)
      }
    }

    void loadStrategies()

    return () => {
      cancelled = true
    }
  }, [chrome.isAuthReady])

  async function handleCreateStrategy() {
    const name = newStrategyName.trim()
    if (!name) {
      toast({ title: "Strategy name required", variant: "destructive" })
      return
    }

    setIsCreatingStrategy(true)
    try {
      const created = await createResearchStrategy({
        name,
        magic_number: newMagicNumber.trim() ? Number(newMagicNumber) : null,
        description: "Demo MT5 research strategy",
      })
      setStrategies((current) => [created, ...current])
      setSelectedStrategyId(created.id)
      setNewStrategyName("")
      setNewMagicNumber("")
      toast({ title: "Strategy created", description: created.name })
    } catch (createError) {
      toast({
        title: "Could not create strategy",
        description: createError instanceof Error ? createError.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsCreatingStrategy(false)
    }
  }

  async function handlePreview() {
    if (!file || !selectedStrategyId) return

    setIsPreviewing(true)
    setError(null)
    try {
      const result = await importResearchCsv({
        file,
        researchStrategyId: selectedStrategyId,
        dryRun: true,
      })
      setPreviewResult(result)
      setPreview(result.preview ?? [])
    } catch (previewError) {
      setPreview([])
      setPreviewResult(null)
      setError(previewError instanceof Error ? previewError.message : "Preview failed")
    } finally {
      setIsPreviewing(false)
    }
  }

  async function handleImport() {
    if (!file || !selectedStrategyId) return

    setIsImporting(true)
    setError(null)
    try {
      const result = await importResearchCsv({
        file,
        researchStrategyId: selectedStrategyId,
        dryRun: false,
      })
      toast({
        title: "Import complete",
        description: `${result.imported} imported, ${result.skipped} skipped.`,
      })
      router.push("/research-lab")
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed")
    } finally {
      setIsImporting(false)
    }
  }

  const readyCount = useMemo(
    () => preview.filter((row) => row.status === "ready").length,
    [preview],
  )

  if (chrome.isLoggingOut) {
    return <SigningOutScreen />
  }

  if (!chrome.isAuthReady) {
    return null
  }

  return (
    <>
      <DashboardChrome
        activeTab="analytics"
        profileCard={chrome.profileCard}
        showProfileEmptyHint={chrome.showProfileEmptyHint}
        accountSwitcher={chrome.accountSwitcher}
        onOpenSettings={settings.openSettings}
        onLogout={() => void chrome.handleLogout()}
        isLoggingOut={chrome.isLoggingOut}
        onFabClick={() => router.push("/?action=new-trade")}
      >
        <section className="dashboard-section">
          <Link
            href="/research-lab"
            className="mb-3 inline-flex items-center gap-2 text-[12px] text-muted-foreground/75 hover:text-cyan-glow"
          >
            <ArrowLeft className="size-3.5" />
            Back to Research Lab
          </Link>
          <p className="dashboard-section-title mb-1 flex items-center gap-2">
            <FlaskConical className="size-4 text-cyan-glow" />
            Import MT5 Demo CSV
          </p>
          <p className="max-w-2xl text-sm text-muted-foreground/75">
            Upload a closed-trade history export from a demo MT5 account. Live accounts and order
            execution are not supported.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DashboardInsetPanel className="space-y-4 p-4">
            <div>
              <Label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/75">
                Research Strategy
              </Label>
              {isLoadingStrategies ? (
                <div className="mt-2 flex min-h-[40px] items-center">
                  <Loader2 className="size-4 animate-spin text-cyan-glow" />
                </div>
              ) : (
                <select
                  value={selectedStrategyId}
                  onChange={(event) => setSelectedStrategyId(event.target.value)}
                  className="add-trade-input mt-2 h-10 w-full rounded-xl px-3 text-sm"
                >
                  <option value="">Select a demo strategy</option>
                  {strategies.map((strategy) => (
                    <option key={strategy.id} value={strategy.id}>
                      {strategy.name}
                      {strategy.magic_number != null ? ` (Magic ${strategy.magic_number})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2 border-t border-white/[0.06] pt-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/75">
                Create Demo Strategy
              </p>
              <Input
                value={newStrategyName}
                onChange={(event) => setNewStrategyName(event.target.value)}
                placeholder="London Breakout EA"
                className="add-trade-input h-10"
              />
              <Input
                value={newMagicNumber}
                onChange={(event) => setNewMagicNumber(event.target.value)}
                placeholder="Magic number (optional)"
                className="add-trade-input h-10"
              />
              <Button
                type="button"
                variant="outline"
                className="h-9 border-cyan-glow/20 text-cyan-glow"
                disabled={isCreatingStrategy}
                onClick={() => void handleCreateStrategy()}
              >
                {isCreatingStrategy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="mr-2 size-4" />
                    Add Strategy
                  </>
                )}
              </Button>
            </div>
          </DashboardInsetPanel>

          <DashboardInsetPanel className="space-y-4 p-4">
            <div>
              <Label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/75">
                MT5 CSV File
              </Label>
              <Input
                type="file"
                accept=".csv,text/csv"
                className="add-trade-input mt-2 h-10 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-glow/15 file:px-3 file:py-1 file:text-[11px] file:font-medium file:text-cyan-glow"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null)
                  setPreview([])
                  setPreviewResult(null)
                }}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 border-white/[0.08]"
                disabled={!file || !selectedStrategyId || isPreviewing}
                onClick={() => void handlePreview()}
              >
                {isPreviewing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Preview Import"
                )}
              </Button>
              <Button
                type="button"
                className="h-9 btn-primary"
                disabled={!file || !selectedStrategyId || readyCount === 0 || isImporting}
                onClick={() => void handleImport()}
              >
                {isImporting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <FileUp className="mr-2 size-4" />
                    Import {readyCount > 0 ? `${readyCount} Trades` : ""}
                  </>
                )}
              </Button>
            </div>

            {previewResult && (
              <p className="text-[11px] text-muted-foreground/75">
                Ready: {readyCount} · Skipped: {previewResult.skipped} · Errors:{" "}
                {previewResult.errors.length}
              </p>
            )}
          </DashboardInsetPanel>
        </div>

        {error && (
          <DashboardInsetPanel className="border-loss/20 bg-loss/[0.06] px-4 py-3 text-sm text-loss/90">
            {error}
          </DashboardInsetPanel>
        )}

        {preview.length > 0 && (
          <section className="dashboard-section">
            <p className="dashboard-section-title">Preview</p>
            <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
              <table className="min-w-full text-left text-[12px]">
                <thead className="bg-white/[0.03] text-muted-foreground/75">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Ticket</th>
                    <th className="px-3 py-2">Pair</th>
                    <th className="px-3 py-2">Dir</th>
                    <th className="px-3 py-2">Result</th>
                    <th className="px-3 py-2">PnL</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 50).map((row) => (
                    <tr key={`${row.rowNumber}-${row.external_ticket}`} className="border-t border-white/[0.04]">
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2">{row.external_ticket}</td>
                      <td className="px-3 py-2">{row.pair}</td>
                      <td className="px-3 py-2">{row.direction}</td>
                      <td className="px-3 py-2">{row.result}</td>
                      <td className="px-3 py-2 tabular-nums">{row.pnl.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            row.status === "ready"
                              ? "text-profit"
                              : row.status === "duplicate"
                                ? "text-yellow-400"
                                : "text-loss"
                          }
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.length > 50 && (
              <p className="mt-2 text-[11px] text-muted-foreground/70">
                Showing first 50 rows of {preview.length}.
              </p>
            )}
          </section>
        )}
      </DashboardChrome>

      <Toaster />
    </>
  )
}
