"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, Copy, Loader2, Radio, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import {
  fetchTradingViewWebhookSettings,
  regenerateTradingViewWebhookSecret,
} from "@/lib/tradingview/api-client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type WebhookSettings = {
  secret: string
  enabled: boolean
  webhookUrl: string
  alertTemplate: string
}

export function TradingViewWebhookSettings() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<WebhookSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await fetchTradingViewWebhookSettings()
      setSettings(result)
    } catch (loadError) {
      setSettings(null)
      setError(loadError instanceof Error ? loadError.message : "Could not load webhook settings")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast({ title: "Copied", description: `${label} copied to clipboard.` })
    } catch {
      toast({ title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" })
    }
  }

  async function handleRegenerateSecret() {
    setIsRegenerating(true)
    try {
      const result = await regenerateTradingViewWebhookSecret()
      setSettings(result)
      toast({
        title: "New secret generated",
        description: "Update your TradingView alert JSON with the new secret.",
      })
    } catch (regenError) {
      toast({
        title: "Could not regenerate",
        description: regenError instanceof Error ? regenError.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setIsRegenerating(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-glow/80">
          <Radio className="size-3.5" />
          TradingView Setup Alerts
        </p>
        {settings?.enabled ? (
          <Badge variant="outline" className="h-6 border-profit/25 bg-profit/[0.08] text-[10px] text-profit">
            Webhook active
          </Badge>
        ) : null}
      </div>

      <DashboardInsetPanel className="space-y-4 px-3 py-3 text-[11px] leading-relaxed text-muted-foreground/75">
        <p>
          Alerts flow into <strong className="text-foreground/90">Journal → Planned Trades</strong> and
          the <strong className="text-foreground/90">bell</strong> notification icon. Vyronis analyzes
          each setup — no orders are placed.
        </p>

        {isLoading ? (
          <div className="flex min-h-[100px] items-center justify-center gap-2 text-muted-foreground/60">
            <Loader2 className="size-4 animate-spin text-cyan-glow" />
            Generating webhook credentials…
          </div>
        ) : error ? (
          <p className="text-loss/90">{error}</p>
        ) : settings ? (
          <>
            <CredentialRow
              label="1. Webhook URL (TradingView notifications URL)"
              value={settings.webhookUrl}
              onCopy={() => void copyValue("Webhook URL", settings.webhookUrl)}
            />

            <CredentialRow
              label="2. Secret key (include in alert JSON)"
              value={settings.secret}
              onCopy={() => void copyValue("Webhook secret", settings.secret)}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isRegenerating}
                  className="h-8 shrink-0 border-white/[0.08] text-[10px]"
                  onClick={() => void handleRegenerateSecret()}
                >
                  {isRegenerating ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="mr-1 size-3" />
                      New secret
                    </>
                  )}
                </Button>
              }
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
                  3. TradingView alert JSON template
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-cyan-glow/20 bg-cyan-glow/[0.04] text-[10px] text-cyan-glow"
                  onClick={() => void copyValue("Alert JSON template", settings.alertTemplate)}
                >
                  <Copy className="mr-1 size-3" />
                  Copy template
                </Button>
              </div>
              <pre className="max-h-[220px] overflow-auto rounded-lg border border-white/[0.08] bg-black/30 p-3 text-[10px] leading-relaxed text-cyan-glow/85">
                {settings.alertTemplate}
              </pre>
              <p className="text-[10px] text-muted-foreground/55">
                In TradingView: create alert → Notifications → Webhook URL → paste message above.
                Use <code className="text-cyan-glow/80">{"{{ticker}}"}</code> placeholders or fixed
                values for SL/TP.
              </p>
            </div>

            <div className="rounded-lg border border-cyan-glow/15 bg-cyan-glow/[0.04] px-3 py-2.5">
              <p className="flex items-center gap-2 text-[11px] font-medium text-cyan-glow/90">
                <Bell className="size-3.5" />
                What happens when an alert fires
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-[10px] text-muted-foreground/70">
                <li>Alert saved to your signal inbox</li>
                <li>AI scores HTF alignment, R:R, and session timing</li>
                <li>Planned Trade card appears on Journal (Open Coach when ready)</li>
                <li>Bell glows with unread count until you view the alert</li>
              </ol>
            </div>
          </>
        ) : (
          <p className="text-amber-300/80">
            Run <code className="text-cyan-glow/80">supabase/013-tradingview-signals.sql</code> in
            Supabase, then reload this page.
          </p>
        )}
      </DashboardInsetPanel>
    </section>
  )
}

function CredentialRow({
  label,
  value,
  onCopy,
  action,
}: {
  label: string
  value: string
  onCopy: () => void
  action?: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">{label}</p>
      <div className="flex gap-2">
        <code
          className={cn(
            "min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/20 px-2 py-1.5 text-[10px] text-foreground/85",
            "break-all",
          )}
        >
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 border-white/[0.08]"
          onClick={onCopy}
        >
          <Copy className="size-3.5" />
        </Button>
        {action}
      </div>
    </div>
  )
}
