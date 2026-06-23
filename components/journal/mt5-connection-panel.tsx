"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Check,
  Copy,
  Loader2,
  Plug,
  PlugZap,
  RefreshCw,
  Unplug,
  Wifi,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  DashboardInsetPanel,
} from "@/components/dashboard/dashboard-primitives"
import {
  fetchMt5Settings,
  regenerateMt5ApiKey,
  testMt5Connection,
  type Mt5ConnectionState,
  type Mt5SettingsResponse,
} from "@/lib/mt5/api-client"
import { cn } from "@/lib/utils"
import { formatExactMt5Money } from "@/lib/mt5/live-balance"

function formatLastSync(iso: string | null): string {
  if (!iso) return "Never"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}h ago`
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const CONNECTION_META: Record<
  Mt5ConnectionState,
  { label: string; dotClass: string; description: string }
> = {
  connected: {
    label: "Connected",
    dotClass: "bg-profit shadow-[0_0_8px_rgb(from var(--color-profit) r g b / 0.5)]",
    description: "MT5 EA reached Vyronis recently",
  },
  waiting: {
    label: "Waiting for MT5",
    dotClass: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.45)]",
    description: "Attach Vyronis_APlus_Scanner with API key — pings on start",
  },
  error: {
    label: "Sync error",
    dotClass: "bg-loss shadow-[0_0_8px_rgb(from var(--color-loss) r g b / 0.45)]",
    description: "Check Experts log — WebRequest whitelist & API key",
  },
  disabled: {
    label: "Webhook off",
    dotClass: "bg-muted-foreground/40",
    description: "Click Test connection to enable",
  },
  unknown: {
    label: "Setup incomplete",
    dotClass: "bg-muted-foreground/40",
    description: "Run Supabase migrations 023–025",
  },
}

export function Mt5ConnectionPanel({
  onTradeSynced,
  className,
}: {
  onTradeSynced?: () => void
  className?: string
}) {
  const [settings, setSettings] = useState<Mt5SettingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testLog, setTestLog] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchMt5Settings()
      setSettings(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load MT5 settings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = setInterval(() => {
      void load().then(() => onTradeSynced?.())
    }, 15_000)
    return () => clearInterval(interval)
  }, [load, onTradeSynced])

  async function handleCopyKey() {
    if (!settings?.apiKey) return
    await navigator.clipboard.writeText(settings.apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      const data = await regenerateMt5ApiKey()
      setSettings(data)
      setError(null)
      setTestLog("API key rotated — update InpVyronisApiKey in MT5 EA inputs.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not regenerate key")
    } finally {
      setRegenerating(false)
    }
  }

  async function handleTestConnection() {
    setTesting(true)
    setTestLog(null)
    try {
      const result = await testMt5Connection()
      const lines = result.steps.map(
        (s) => `${s.ok ? "✓" : "✗"} ${s.step}${s.detail ? `: ${s.detail}` : ""}${s.error ? ` — ${s.error}` : ""}`,
      )
      setTestLog([result.hint, ...lines].filter(Boolean).join("\n"))
      if (result.settings) setSettings(result.settings)
      if (result.ok) void load()
    } catch (err) {
      setTestLog(err instanceof Error ? err.message : "Test failed")
    } finally {
      setTesting(false)
    }
  }

  const connection = settings?.connection ?? "unknown"
  const meta = CONNECTION_META[connection]
  const ConnectionIcon =
    connection === "connected" ? PlugZap : connection === "error" ? Unplug : Plug

  const scannerUrl =
    settings?.scannerUrl ?? settings?.webhookUrl.replace("/trades", "/scanner")
  const scannerStateUrl =
    settings?.scannerStateUrl ?? `${scannerUrl}/state`
  const lastActivity = settings?.lastSyncAt ?? settings?.lastPingAt

  return (
    <DashboardCard interactive className={cn("glass-card", className)}>
      <DashboardCardHeader
        title="MT5 Connection"
        icon={ConnectionIcon}
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground/70"
            onClick={() => {
              setLoading(true)
              void load()
            }}
            disabled={loading}
            aria-label="Refresh MT5 status"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        }
      />
      <DashboardCardBody className="space-y-2.5 pt-1">
        {error && <p className="text-[11px] text-loss/90">{error}</p>}
        {loading && !settings ? (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
            <Loader2 className="size-3.5 animate-spin" />
            Loading…
          </div>
        ) : settings ? (
          <>
            <DashboardInsetPanel className="flex items-center gap-2.5 px-3 py-2.5">
              <span
                className={cn("size-2.5 shrink-0 rounded-full", meta.dotClass)}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-foreground/90">{meta.label}</p>
                <p className="text-[10px] text-muted-foreground/65">{meta.description}</p>
              </div>
            </DashboardInsetPanel>

            {(settings.accountLogin || settings.broker) && (
              <DashboardInsetPanel className="px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/65">
                  MT5 account
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-foreground/90">
                  {settings.accountLogin ?? "—"}
                </p>
                <p className="text-[10px] text-muted-foreground/60">
                  {settings.broker ?? "—"}
                  {settings.balance != null
                    ? ` · ${formatExactMt5Money(settings.balance)}`
                    : ""}
                </p>
                {settings.balance != null ? (
                  <p className="mt-1 text-[10px] text-cyan-glow/75">
                    MT5 balance syncs to your Vyronis account balance on ping and trade close.
                  </p>
                ) : null}
              </DashboardInsetPanel>
            )}

            <DashboardInsetPanel className="px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/65">
                Last MT5 Sync
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-foreground/90">
                {formatLastSync(lastActivity ?? null)}
              </p>
              {settings.lastSyncTicket && (
                <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                  Ticket {settings.lastSyncTicket}
                  {settings.lastSyncStatus ? ` · ${settings.lastSyncStatus}` : ""}
                </p>
              )}
              {settings.lastSyncMessage && (
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/70">
                  {settings.lastSyncMessage}
                </p>
              )}
              {settings.lastError && connection === "error" && (
                <p className="mt-1 text-[10px] text-loss/80">{settings.lastError}</p>
              )}
            </DashboardInsetPanel>

            <DashboardInsetPanel className="px-3 py-2 space-y-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/65">
                EA webhook URLs
              </p>
              <div className="space-y-1.5">
                <div>
                  <p className="text-[9px] text-muted-foreground/55">A+ Scanner (signals)</p>
                  <p className="break-all font-mono text-[9px] leading-relaxed text-cyan-glow/85">
                    {scannerUrl}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground/55">A+ Scanner (watchlist state)</p>
                  <p className="break-all font-mono text-[9px] leading-relaxed text-cyan-glow/85">
                    {scannerStateUrl}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground/55">Trade sync (closed trades)</p>
                  <p className="break-all font-mono text-[9px] leading-relaxed text-cyan-glow/85">
                    {settings.webhookUrl}
                  </p>
                </div>
              </div>
            </DashboardInsetPanel>

            {settings.diagnostics?.map((line) => (
              <p key={line} className="text-[10px] text-warning-muted/80">
                {line}
              </p>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="h-8 flex-1 bg-cyan-glow/90 text-[11px] text-black hover:bg-cyan-glow"
                disabled={testing}
                onClick={() => void handleTestConnection()}
              >
                {testing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Wifi className="mr-1.5 size-3.5" />
                )}
                Test connection
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-white/[0.08] bg-white/[0.03] text-[11px]"
                onClick={() => void handleCopyKey()}
              >
                {copied ? (
                  <>
                    <Check className="mr-1 size-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 size-3.5" />
                    API key
                  </>
                )}
              </Button>
            </div>

            {testLog && (
              <pre className="max-h-32 overflow-auto rounded-lg border border-white/[0.06] bg-black/30 p-2 text-[9px] leading-relaxed text-muted-foreground/80 whitespace-pre-wrap">
                {testLog}
              </pre>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-full text-[10px] text-muted-foreground/70"
              disabled={regenerating}
              onClick={() => void handleRegenerate()}
            >
              {regenerating ? "Rotating…" : "Rotate API key"}
            </Button>
          </>
        ) : null}
      </DashboardCardBody>
    </DashboardCard>
  )
}
