"use client"

import { useRef, useState } from "react"
import { FileUp, ImageIcon, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import type { JournalImportResult } from "@/lib/journal/csv-import"
import {
  confirmJournalImport,
  deleteJournalCsvImports,
  previewJournalImport,
} from "@/lib/journal/api-client"
import { cn } from "@/lib/utils"
import { formatPnL, formatSignedDollarPnl, getPnLTextClass } from "@/lib/trade-utils"

type JournalImportModalProps = {
  open: boolean
  onClose: () => void
  onImported: () => void
}

function isCsvFile(file: File): boolean {
  return file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv")
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/")
}

export function JournalImportModal({ open, onClose, onImported }: JournalImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autoReplaceTriggered = useRef(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([])
  const [preview, setPreview] = useState<JournalImportResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [useTodayForMissingDates, setUseTodayForMissingDates] = useState(false)
  const [isDeletingCsvImports, setIsDeletingCsvImports] = useState(false)

  function resetState() {
    setCsvFile(null)
    setScreenshotFiles([])
    setPreview(null)
    setError(null)
    setIsLoading(false)
    setIsImporting(false)
    setReplaceExisting(false)
    setUseTodayForMissingDates(false)
    autoReplaceTriggered.current = false
  }

  function handleClose() {
    resetState()
    onClose()
  }

  async function runPreview(
    nextCsv: File | null,
    nextScreenshots: File[],
    replaceOverride?: boolean,
    useTodayOverride?: boolean,
  ) {
    if (!nextCsv && nextScreenshots.length === 0) {
      setPreview(null)
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      let useReplace = replaceOverride ?? replaceExisting
      let result = await previewJournalImport({
        csvFile: nextCsv,
        screenshotFiles: nextScreenshots,
        replaceExisting: useReplace,
        useTodayForMissingDates: useTodayOverride ?? useTodayForMissingDates,
      })

      const allDuplicates =
        nextCsv &&
        result.needsDateFixCount === 0 &&
        result.preview.length > 0 &&
        result.preview.every((row) => row.status === "duplicate")

      if (allDuplicates && !useReplace && !autoReplaceTriggered.current) {
        autoReplaceTriggered.current = true
        useReplace = true
        setReplaceExisting(true)
        result = await previewJournalImport({
          csvFile: nextCsv,
          screenshotFiles: nextScreenshots,
          replaceExisting: true,
          useTodayForMissingDates: useTodayOverride ?? useTodayForMissingDates,
        })
      }

      setPreview(result)
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Preview failed")
      setPreview(null)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files?.length) return
    const incoming = Array.from(files)
    const nextCsv = incoming.find(isCsvFile) ?? csvFile
    const nextScreenshots = [...screenshotFiles, ...incoming.filter(isImageFile)]
    if (incoming.some(isCsvFile)) {
      setCsvFile(incoming.find(isCsvFile)!)
      autoReplaceTriggered.current = false
    }
    setScreenshotFiles(nextScreenshots)
    await runPreview(nextCsv, nextScreenshots)
  }

  function removeScreenshot(index: number) {
    const next = screenshotFiles.filter((_, i) => i !== index)
    setScreenshotFiles(next)
    void runPreview(csvFile, next)
  }

  function removeCsv() {
    setCsvFile(null)
    void runPreview(null, screenshotFiles)
  }

  async function handleDeleteOldCsvImports() {
    const confirmed = window.confirm(
      "Delete all trades imported from journal CSV? Manual journal entries are kept. This cannot be undone.",
    )
    if (!confirmed) return

    setIsDeletingCsvImports(true)
    setError(null)
    try {
      const { deletedCount } = await deleteJournalCsvImports()
      setPreview(null)
      setReplaceExisting(false)
      autoReplaceTriggered.current = false
      if (csvFile) {
        await runPreview(csvFile, screenshotFiles, false, useTodayForMissingDates)
      }
      onImported()
      if (deletedCount === 0) {
        setError("No journal CSV imports found to delete.")
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed")
    } finally {
      setIsDeletingCsvImports(false)
    }
  }

  async function handleConfirm() {
    if (!csvFile && screenshotFiles.length === 0) return
    setIsImporting(true)
    setError(null)
    try {
      const result = await confirmJournalImport({
        csvFile: csvFile,
        screenshotFiles,
        replaceExisting,
        useTodayForMissingDates,
      })
      const updated = result.replacedCount + result.importedCount
      if (updated === 0 && result.errorCount > 0) {
        setError(result.errors[0] || "No trades were imported.")
        return
      }
      onImported()
      handleClose()
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed")
    } finally {
      setIsImporting(false)
    }
  }

  const validRowCount = preview?.importReadyCount ?? preview?.validRowCount ?? 0
  const replaceCount = preview?.preview.filter((row) => row.status === "replace").length ?? 0
  const duplicateCount =
    preview?.preview.filter((row) => row.status === "duplicate").length ?? 0
  const needsDateFixCount = preview?.needsDateFixCount ?? 0

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/[0.08] bg-surface-modal sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import to Journal</DialogTitle>
          <DialogDescription>
            Import closed trades from a broker CSV export and/or attach chart screenshots. Preview before saving to your
            journal.
          </DialogDescription>
        </DialogHeader>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            setDragActive(false)
            void handleFilesSelected(e.dataTransfer.files)
          }}
          className={cn(
            "flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition-all",
            dragActive
              ? "border-cyan-glow/50 bg-cyan-glow/[0.08]"
              : "border-white/[0.12] bg-white/[0.02] hover:border-cyan-glow/30",
          )}
        >
          {isLoading ? (
            <Loader2 className="size-6 animate-spin text-cyan-glow" />
          ) : (
            <>
              <FileUp className="mb-2 size-7 text-cyan-glow/80" />
              <p className="text-sm font-medium">Drop CSV and/or chart screenshots</p>
              <p className="mt-1 text-[11px] text-muted-foreground/70">
                CSV rows can be paired with screenshots in upload order
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv,image/*"
            multiple
            className="hidden"
            onChange={(e) => void handleFilesSelected(e.target.files)}
          />
        </div>

        {csvFile ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <Checkbox
                id="journal-replace-existing"
                checked={replaceExisting}
                onCheckedChange={(checked) => {
                  const next = checked === true
                  setReplaceExisting(next)
                  void runPreview(csvFile, screenshotFiles, next)
                }}
              />
              <Label
                htmlFor="journal-replace-existing"
                className="cursor-pointer text-[12px] leading-snug text-muted-foreground/90"
              >
                Replace existing trades by ticket (overwrites previous journal import with this CSV)
              </Label>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <Checkbox
                id="journal-use-today-missing"
                checked={useTodayForMissingDates}
                onCheckedChange={(checked) => {
                  const next = checked === true
                  setUseTodayForMissingDates(next)
                  void runPreview(csvFile, screenshotFiles, undefined, next)
                }}
              />
              <Label
                htmlFor="journal-use-today-missing"
                className="cursor-pointer text-[12px] leading-snug text-muted-foreground/90"
              >
                Use today&apos;s date when CSV has no Date / Close Time / Open Time columns
              </Label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeletingCsvImports || isLoading}
              className="w-full border-loss/30 text-[12px] text-loss hover:bg-loss/[0.08]"
              onClick={() => void handleDeleteOldCsvImports()}
            >
              {isDeletingCsvImports ? (
                <>
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                  Deleting old CSV imports…
                </>
              ) : (
                "Delete all previous journal CSV imports"
              )}
            </Button>
          </div>
        ) : null}

        {!csvFile ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDeletingCsvImports}
            className="w-full border-loss/30 text-[12px] text-loss hover:bg-loss/[0.08]"
            onClick={() => void handleDeleteOldCsvImports()}
          >
            {isDeletingCsvImports ? (
              <>
                <Loader2 className="mr-2 size-3.5 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete all previous journal CSV imports"
            )}
          </Button>
        ) : null}

        {(csvFile || screenshotFiles.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {csvFile ? (
              <Badge variant="outline" className="h-7 gap-1.5 pl-2.5 pr-1 text-[11px]">
                {csvFile.name}
                <button
                  type="button"
                  onClick={removeCsv}
                  className="rounded p-0.5 hover:bg-white/[0.06]"
                  aria-label="Remove CSV"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ) : null}
            {screenshotFiles.map((file, index) => (
              <Badge
                key={`${file.name}-${index}`}
                variant="outline"
                className="h-7 gap-1.5 pl-2.5 pr-1 text-[11px]"
              >
                <ImageIcon className="size-3 opacity-70" />
                {file.name}
                <button
                  type="button"
                  onClick={() => removeScreenshot(index)}
                  className="rounded p-0.5 hover:bg-white/[0.06]"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {preview ? (
          <div className="space-y-3">
            <DashboardInsetPanel
              className={cn(
                "px-3 py-2 text-[12px]",
                validRowCount > 0 ? "text-cyan-glow/90" : "text-warning-foreground/90",
              )}
            >
              {preview.summaryMessage ||
                `Found ${preview.totalRowsFound} rows, import-ready ${validRowCount}, skipped ${preview.skippedCount}`}
              {replaceCount > 0 ? ` · ${replaceCount} will replace previous import` : ""}
              {duplicateCount > 0 && replaceCount === 0
                ? ` · ${duplicateCount} duplicate — enable replace above`
                : ""}
              {needsDateFixCount > 0 ? ` · ${needsDateFixCount} need date fix` : ""}
              {preview.calendarSummary
                ? ` · ${preview.calendarSummary.uniqueDates.length} calendar days`
                : ""}
            </DashboardInsetPanel>

            {preview.columnDiagnostics ? (
              <DashboardInsetPanel className="space-y-1.5 px-3 py-2 font-mono text-[10px] text-muted-foreground/75">
                <p>
                  <span className="text-muted-foreground/55">CSV headers:</span>{" "}
                  {preview.columnDiagnostics.headers.join(" | ") || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground/55">firstRow keys:</span>{" "}
                  {preview.columnDiagnostics.firstRowKeys.join(", ") || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground/55">dateHeader:</span>{" "}
                  {preview.columnDiagnostics.detectedDateHeader ??
                    preview.columnDiagnostics.detectedCloseTimeHeader ??
                    preview.columnDiagnostics.detectedOpenTimeHeader ??
                    "—"}{" "}
                  → {preview.columnDiagnostics.inferredTradeDate ?? "—"}
                </p>
                <p>
                  <span className="text-muted-foreground/55">profitHeader:</span>{" "}
                  {preview.columnDiagnostics.detectedProfitHeader ?? "—"} →{" "}
                  {preview.columnDiagnostics.firstRowRaw.pnl ??
                    preview.columnDiagnostics.firstRowRaw.profit ??
                    "—"}
                </p>
                {!preview.columnDiagnostics.inferredTradeDate ? (
                  <p className="text-warning-foreground/90">
                    No Date / Close Time / Open Time found. Add a Date column (YYYY-MM-DD) or
                    export with Close Time from TradeZella.
                  </p>
                ) : null}
              </DashboardInsetPanel>
            ) : null}

            {preview.dateLogs.length > 0 ? (
              <div className="max-h-[200px] overflow-auto rounded-xl border border-cyan-glow/15 bg-cyan-glow/[0.03]">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-surface-card text-[9px] uppercase tracking-wide text-muted-foreground/70">
                    <tr>
                      <th className="px-2 py-1.5">Row</th>
                      <th className="px-2 py-1.5">CSV datetime</th>
                      <th className="px-2 py-1.5">Parsed</th>
                      <th className="px-2 py-1.5">Calendar</th>
                      <th className="px-2 py-1.5">P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.dateLogs.map((log) => (
                      <tr
                        key={`${log.ticket}-${log.rowNumber}`}
                        className="border-t border-white/[0.04]"
                      >
                        <td className="px-2 py-1.5 tabular-nums">{log.rowNumber}</td>
                        <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground/80">
                          {log.originalCsvDateTime}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-[10px]">{log.parsedDate}</td>
                        <td className="px-2 py-1.5 font-medium text-cyan-glow/90">
                          {log.calendarDate}
                        </td>
                        <td
                          className={cn(
                            "px-2 py-1.5 tabular-nums",
                            log.pnl >= 0 ? "text-profit" : "text-loss",
                          )}
                        >
                          {log.pnl >= 0 ? "+" : ""}
                          {log.pnl}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="max-h-[320px] overflow-auto rounded-xl border border-white/[0.06]">
              <table className="w-full text-left text-[12px]">
                <thead className="sticky top-0 bg-surface-card text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  <tr>
                    <th className="px-3 py-2">Ticket</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Pair</th>
                    <th className="px-3 py-2">Dir</th>
                    <th className="px-3 py-2">P&amp;L</th>
                    <th className="px-3 py-2">Screenshot</th>
                    <th className="px-3 py-2">AI tags</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row) => (
                    <tr
                      key={`${row.external_ticket}-${row.rowNumber}`}
                      className="border-t border-white/[0.04]"
                    >
                      <td className="px-3 py-2 tabular-nums">{row.external_ticket}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-cyan-glow/80">
                        {row.trade_date || "—"}
                      </td>
                      <td className="px-3 py-2">{row.pair}</td>
                      <td className="px-3 py-2">{row.direction}</td>
                      <td
                        className={cn(
                          "px-3 py-2 tabular-nums",
                          row.status === "needs_date_fix"
                            ? row.pnl >= 0
                              ? "text-profit"
                              : "text-loss"
                            : getPnLTextClass(row.pnl, row.result),
                        )}
                      >
                        {row.status === "needs_date_fix"
                          ? formatSignedDollarPnl(row.pnl)
                          : formatPnL(row.pnl, row.result)}
                      </td>
                      <td className="px-3 py-2">
                        {row.screenshot_url ? (
                          <Badge variant="outline" className="h-5 text-[9px]">
                            Attached
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {row.suggested_setup ? (
                            <Badge variant="outline" className="h-5 text-[9px]">
                              {row.suggested_setup}
                            </Badge>
                          ) : null}
                          {row.suggested_emotion ? (
                            <Badge variant="outline" className="h-5 text-[9px]">
                              {row.suggested_emotion}
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 text-[9px]",
                            row.status === "ready"
                              ? "border-profit/25 text-profit"
                              : row.status === "replace"
                                ? "border-cyan-glow/30 text-cyan-glow"
                                : row.status === "needs_date_fix"
                                  ? "border-warning/30 text-warning-foreground"
                                  : "border-warning/25 text-warning-foreground",
                          )}
                        >
                          {row.status === "ready"
                            ? "Ready"
                            : row.status === "replace"
                              ? "Replace existing"
                              : row.status === "duplicate"
                                ? "Skipped duplicate"
                                : row.status === "needs_date_fix"
                                  ? "Needs date fix"
                                  : row.status}
                        </Badge>
                        {row.message ? (
                          <p className="mt-1 max-w-[140px] text-[10px] leading-snug text-muted-foreground/65">
                            {row.message}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {error ? (
          <DashboardInsetPanel className="border-loss/25 bg-loss/[0.06] px-3 py-2 text-[12px] text-loss">
            {error}
          </DashboardInsetPanel>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {preview ? (
            <Button
              type="button"
              disabled={isImporting || validRowCount === 0}
              className="btn-primary"
              onClick={() => void handleConfirm()}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Importing…
                </>
              ) : (
                replaceCount > 0
                  ? `Replace ${replaceCount} ${replaceCount === 1 ? "trade" : "trades"}`
                  : `Import ${validRowCount} ${validRowCount === 1 ? "entry" : "entries"}`
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
