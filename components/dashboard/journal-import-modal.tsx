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
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import type { JournalImportResult } from "@/lib/journal/csv-import"
import { confirmJournalImport, previewJournalImport } from "@/lib/journal/api-client"
import { cn } from "@/lib/utils"
import { formatPnL, getPnLTextClass } from "@/lib/trade-utils"

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
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([])
  const [preview, setPreview] = useState<JournalImportResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  function resetState() {
    setCsvFile(null)
    setScreenshotFiles([])
    setPreview(null)
    setError(null)
    setIsLoading(false)
    setIsImporting(false)
  }

  function handleClose() {
    resetState()
    onClose()
  }

  async function runPreview(nextCsv: File | null, nextScreenshots: File[]) {
    if (!nextCsv && nextScreenshots.length === 0) {
      setPreview(null)
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      const result = await previewJournalImport({
        csvFile: nextCsv,
        screenshotFiles: nextScreenshots,
      })
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
    if (incoming.some(isCsvFile)) setCsvFile(incoming.find(isCsvFile)!)
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

  async function handleConfirm() {
    if (!csvFile && screenshotFiles.length === 0) return
    setIsImporting(true)
    setError(null)
    try {
      const result = await confirmJournalImport({
        csvFile: csvFile,
        screenshotFiles,
      })
      if (result.importedCount === 0 && result.errorCount > 0) {
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

  const readyCount = preview?.preview.filter((row) => row.status === "ready").length ?? 0

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/[0.08] bg-[#0a0f14] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import to Journal</DialogTitle>
          <DialogDescription>
            Upload MT5 trade history (CSV) and/or chart screenshots. Preview before saving to your
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
            <DashboardInsetPanel className="px-3 py-2 text-[12px] text-cyan-glow/90">
              {readyCount} ready to import
              {preview.skippedCount > 0 ? ` · ${preview.skippedCount} skipped` : ""}
            </DashboardInsetPanel>

            <div className="max-h-[320px] overflow-auto rounded-xl border border-white/[0.06]">
              <table className="w-full text-left text-[12px]">
                <thead className="sticky top-0 bg-[#0d1218] text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  <tr>
                    <th className="px-3 py-2">Ticket</th>
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
                      <td className="px-3 py-2">{row.pair}</td>
                      <td className="px-3 py-2">{row.direction}</td>
                      <td
                        className={cn(
                          "px-3 py-2 tabular-nums",
                          getPnLTextClass(row.pnl, row.result),
                        )}
                      >
                        {formatPnL(row.pnl, row.result)}
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
                              : "border-amber-500/25 text-amber-300",
                          )}
                        >
                          {row.status}
                        </Badge>
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
              disabled={isImporting || readyCount === 0}
              className="bg-cyan-glow/90 text-black hover:bg-cyan-glow"
              onClick={() => void handleConfirm()}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Importing…
                </>
              ) : (
                `Import ${readyCount} ${readyCount === 1 ? "entry" : "entries"}`
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
