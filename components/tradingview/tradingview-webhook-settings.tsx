"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bell, CheckCircle2, Circle, Copy, Loader2, Radio, RefreshCw, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import {
  fetchTradingViewSetupReadiness,
  fetchTradingViewWebhookSettings,
  regenerateTradingViewWebhookSecret,
  sendTradingViewTestAlert,
  type TradingViewSetupReadiness,
} from "@/lib/tradingview/api-client"
import { useToast } from "@/hooks/use-toast"
import { notifyTradingViewSignalsRefresh } from "@/lib/tradingview/signals-events"
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
  const [readiness, setReadiness] = useState<TradingViewSetupReadiness | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [webhook, setup] = await Promise.all([
        fetchTradingViewWebhookSettings(),
        fetchTradingViewSetupReadiness(),
      ])
      setSettings(webhook)
      setReadiness(setup)
    } catch (loadError) {
      setSettings(null)
      setReadiness(null)
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

  async function handleTestAlert(override?: { symbol?: string; direction?: "BUY" | "SELL" }) {
    setIsTesting(true)
    try {
      const result = await sendTradingViewTestAlert({
        symbol: override?.symbol ?? readiness?.suggestedTestSymbol ?? undefined,
        direction: override?.direction ?? readiness?.suggestedTestDirection,
      })
      notifyTradingViewSignalsRefresh()
      toast({
        title: result.setup_grade
          ? `Test alert · Grade ${result.setup_grade}`
          : "Test alert sent",
        description:
          result.message ??
          `Close settings — bell (top right) shows ${result.symbol} ${result.direction}.`,
      })
      await loadSettings()
    } catch (testError) {
      toast({
        title: "Test failed",
        description: testError instanceof Error ? testError.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setIsTesting(false)
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
          TradingView fires your strategy → Vyronis grades the setup against{" "}
          <strong className="text-foreground/90">War Room</strong> (watchlist, AOI, HTF bias) →{" "}
          <strong className="text-foreground/90">A+ / B / C / D</strong> with Wait or Trade ready. You
          only take <strong className="text-foreground/90">B+</strong>; Vyronis never places orders.
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
            {readiness ? (
              <div className="space-y-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2.5">
                <p className="text-[11px] font-medium text-foreground/90">Setup checklist</p>
                <ul className="space-y-1.5">
                  {readiness.steps.map((step, index) => (
                    <li key={step.id} className="flex gap-2 text-[10px] leading-relaxed">
                      {step.done ? (
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-profit" />
                      ) : (
                        <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/45" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-foreground/85">
                          {index + 1}. {step.label}
                        </span>
                        <span className="block text-muted-foreground/65">{step.hint}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-[10px]"
                    asChild
                  >
                    <Link href="/war-room">Open War Room</Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 bg-cyan-glow/90 text-[10px] font-semibold text-background hover:bg-cyan-glow"
                    disabled={isTesting}
                    onClick={() => void handleTestAlert()}
                  >
                    {isTesting ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <Zap className="mr-1 size-3" />
                    )}
                    Test best pair
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-[10px]"
                    disabled={isTesting}
                    onClick={() =>
                      void handleTestAlert({
                        symbol: "GBPCAD",
                        direction: "BUY",
                      })
                    }
                  >
                    Test GBPCAD
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/55">
                  Test uses{" "}
                  <strong className="text-foreground/75">
                    {readiness.suggestedTestSymbol} {readiness.suggestedTestDirection}
                  </strong>{" "}
                  from your watchlist (no TradingView required).
                </p>
              </div>
            ) : null}

            <CredentialRow
              label="4. Webhook URL (paste in TradingView)"
              value={settings.webhookUrl}
              onCopy={() => void copyValue("Webhook URL", settings.webhookUrl)}
            />

            <CredentialRow
              label="5. Secret key (inside alert JSON)"
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
                  6. TradingView alert JSON template
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
                values for SL/TP. TradingView cannot attach chart images — upload screenshots in War
                Room and Vyronis runs vision on each alert (H4 preferred).
              </p>
            </div>

            <div className="rounded-lg border border-cyan-glow/15 bg-cyan-glow/[0.04] px-3 py-2.5">
              <p className="flex items-center gap-2 text-[11px] font-medium text-cyan-glow/90">
                <Bell className="size-3.5" />
                What happens when an alert fires
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-[10px] text-muted-foreground/70">
                <li>Alert saved to your signal inbox (bell icon)</li>
                <li>Graded vs weekly watchlist + AOI status + HTF bias</li>
                <li>
                  <strong className="text-foreground/80">A+ / B</strong> → tradable per your rules;{" "}
                  <strong className="text-foreground/80">C</strong> → wait;{" "}
                  <strong className="text-foreground/80">D</strong> → skip
                </li>
                <li>
                  Chart vision on your War Room uploads (needs{" "}
                  <code className="text-cyan-glow/80">OPENAI_API_KEY</code> on server)
                </li>
                <li>Pre-trade coach session created — tap alert to open</li>
                <li>
                  Email for <strong className="text-foreground/80">B+</strong> only when{" "}
                  <code className="text-cyan-glow/80">RESEND_API_KEY</code> is set (optional — uses test sender until custom domain is verified)
                </li>
              </ol>
            </div>
          </>
        ) : (
          <p className="text-warning-foreground/80">
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
