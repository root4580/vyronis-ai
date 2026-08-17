"use client"

import { useRef } from "react"
import { useRouter } from "next/navigation"
import { FileUp, ClipboardCheck, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/toaster"
import { SigningOutScreen } from "@/components/auth/signing-out-screen"
import { AppTabShell } from "@/components/shell/app-tab-shell"
import { LazyJournalCommandCenter, LazyWeeklyDebriefPanel } from "@/components/dashboard/lazy-dashboard-modules"
import { CollapsibleDashboardSection } from "@/components/dashboard/collapsible-dashboard-section"
import { RiskGuardBanner } from "@/components/dashboard/risk-guard-banner"
import { AddTradeModal } from "@/components/dashboard/add-trade-modal"
import { TradeDetailsModal } from "@/components/dashboard/trade-details-modal"
import { JournalImportModal } from "@/components/dashboard/journal-import-modal"
import { ScreenshotViewerModal } from "@/components/dashboard/screenshot-viewer-modal"
import { TradeRiskGuardModal } from "@/components/dashboard/trade-risk-guard-modal"
import { VyronisScoreResultModal } from "@/components/dashboard/vyronis-score-result-modal"
import { collectStrategyNamesFromTrades } from "@/components/dashboard/strategy-name-select"
import { CommandCenterBridge } from "@/components/command-center/command-center-bridge"
import { CommandCenterLauncher } from "@/components/command-center/command-center-launcher"
import { VyronisCommandCenter } from "@/components/command-center/vyronis-command-center"
import { AIContextProvider } from "@/providers/ai-context-provider"
import { buildEmptyPlannedContext, buildPlannedContextFromForm } from "@/lib/trade-coach/planned-context"
import { buildRepeatTradeDraft, getMostRecentTradeForRepeat } from "@/lib/trade-quick-log"
import { useDashboardChrome } from "@/hooks/use-dashboard-chrome"
import { useToast } from "@/hooks/use-toast"
import { useHomeDashboardData } from "@/hooks/use-home-dashboard-data"
import { useTradeJournal } from "@/hooks/use-trade-journal"
import { formatPnL, getPnLTextClass } from "@/lib/trade-utils"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"
import { APP_HOME_PATH } from "@/lib/branding"
import type { PreTradePlannedContext } from "@/lib/trade-coach/types"

/**
 * Trade tab — full parity with app/(app)/hq/page.tsx's "journal" tab
 * (add/edit/delete, CSV import, screenshot + MT5 autofill, pre-trade coach
 * sessions, risk guard, Vyronis scoring). Both pages now share the same
 * hooks/use-trade-journal.ts hook instead of two copies of this logic.
 *
 * Not yet ported here (still only on the old /hq journal tab and
 * /practice-room): the Live/Practice toggle, a "strategy match" column on
 * the trade list, and Practice Room's paper-trade flow — planned as a
 * fast-follow once this core flow is verified live.
 */
export default function TradePage() {
  const router = useRouter()
  const chrome = useDashboardChrome({ loginNextPath: "/trade" })
  const { toast } = useToast()
  const data = useHomeDashboardData({
    supabase: chrome.supabase,
    userId: chrome.user?.id,
    userMetadata: chrome.user?.user_metadata,
    activeAccountId: chrome.activeAccountId,
    legacyAccountId: chrome.legacyTradeAccountId,
  })

  const openPreTradeCoachRef = useRef<
    (options?: {
      sessionId?: string
      plannedContext?: PreTradePlannedContext
      plannerCheckIn?: boolean
    }) => Promise<void>
  >(async () => {})

  const startingBalance =
    chrome.activeAccount?.starting_balance ??
    data.userSettings?.starting_balance ??
    data.settingsForm.starting_balance ??
    DEFAULT_USER_SETTINGS.starting_balance

  const journal = useTradeJournal({
    supabase: chrome.supabase,
    user: chrome.user,
    activeAccountId: chrome.activeAccountId,
    activeAccount: chrome.activeAccount,
    trades: data.trades,
    setTrades: data.setTrades,
    accountTrades: data.accountTrades,
    refetchTrades: (userId) => data.refetchTrades(userId),
    loadAccounts: chrome.loadAccounts,
    startingBalance,
    settingsForm: data.settingsForm,
    userSettings: data.userSettings,
    toast,
    tradingRules: chrome.tradingRules,
    openPreTradeCoach: (options) => openPreTradeCoachRef.current(options),
  })

  if (chrome.isLoggingOut) {
    return <SigningOutScreen />
  }

  if (!chrome.isAuthReady) {
    return (
      <div className="dashboard-shell">
        <div className="dashboard-container flex min-h-[60vh] items-center justify-center px-4">
          <div className="size-6 animate-spin rounded-full border-2 border-white/10 border-t-cyan-glow" />
        </div>
      </div>
    )
  }

  return (
    <AIContextProvider
      userId={chrome.user?.id}
      maxRiskPerTrade={journal.maxRiskPerTrade}
      onCoachSessionChange={journal.handleCoachSessionChange}
      onCoachCompleted={journal.handleCoachCompleted}
      onLogPlannedTrade={(sessionId) => void journal.handleConvertPlannedTrade(sessionId)}
    >
      <CommandCenterBridge
        onBindOpen={() => {}}
        onBindPreTrade={(openPreTrade) => {
          openPreTradeCoachRef.current = openPreTrade
        }}
        onCoachSessionIdChange={journal.setCoachSessionId}
      />
      <AppTabShell
        activeTab="trade"
        profileCard={chrome.profileCard}
        showProfileEmptyHint={chrome.showProfileEmptyHint}
        accountSwitcher={chrome.accountSwitcher}
        onOpenSettings={() => router.push("/settings")}
        onLogout={() => void chrome.handleLogout()}
        isLoggingOut={chrome.isLoggingOut}
        banner={chrome.tradingRulesBanner}
        advisorBar={chrome.user ? <CommandCenterLauncher /> : null}
        fab={null}
      >
        <section className="dashboard-section">
          <p className="dashboard-section-title">Trade</p>
          <p className="max-w-2xl text-sm text-muted-foreground/75">
            Log, review, and edit your trades.
          </p>
        </section>

        <div className="dashboard-stagger space-y-3">
          <RiskGuardBanner trades={data.accountTrades} settings={data.settingsForm} startingBalance={startingBalance} />

          <CollapsibleDashboardSection
            id="weekly-debrief-panel"
            title="Weekly debrief"
            subtitle="Execution week — trades, coach sessions, corrective focus"
            defaultOpen={false}
            collapseOnMobile
          >
            <LazyWeeklyDebriefPanel
              onViewTrade={(tradeId) => {
                const trade = data.accountTrades.find((t) => t.id === tradeId)
                if (trade) journal.setSelectedTrade(trade)
              }}
            />
          </CollapsibleDashboardSection>

          <LazyJournalCommandCenter
            trades={data.accountTrades}
            startingBalance={startingBalance}
            viewingClosedTradeId={null}
            plannedSessions={journal.plannedSessions}
            isLoadingPlanned={journal.isLoadingPlannedSessions}
            deletingSessionId={journal.deletingPlannedSessionId}
            onContinueCoach={(sessionId) => void journal.handleContinuePlannedCoach(sessionId)}
            onConvertToTrade={(sessionId) => void journal.handleConvertPlannedTrade(sessionId)}
            onDeletePlanned={(sessionId) => void journal.handleDeletePlannedSession(sessionId)}
            onNewCoach={() => void journal.handleOpenCoach(buildEmptyPlannedContext())}
            onEditTrade={journal.handleEditTrade}
            onDeleteTrade={journal.handleDeleteClick}
            onViewTrade={(trade) => journal.setSelectedTrade(trade)}
            onScreenshotClick={(trade) =>
              journal.setScreenshotViewer({ url: trade?.screenshot_url ?? null, label: trade?.pair ?? "Trade" })
            }
            onClearJournalCsvDay={(dateKey) => void journal.handleClearJournalCsvDay(dateKey)}
            onLogTrade={journal.openManualTrade}
            headerActions={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => journal.setIsJournalImportOpen(true)}
                  className="h-9 w-full border border-[var(--border-subtle)] bg-transparent text-text-secondary hover:bg-white/[0.04] sm:w-auto"
                >
                  <FileUp className="mr-2 size-4" />
                  Import CSV
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => journal.openPlanTrade()}
                  className="h-9 w-full border border-[var(--border-subtle)] bg-transparent text-text-secondary hover:bg-white/[0.04] sm:w-auto"
                >
                  <ClipboardCheck className="mr-2 size-4" />
                  Setup scoring
                </Button>
                <Button
                  type="button"
                  onClick={() => journal.openManualTrade()}
                  className="h-9 w-full btn-primary sm:w-auto"
                >
                  <Plus className="mr-2 size-4" />
                  New trade
                </Button>
              </div>
            }
          />
        </div>
      </AppTabShell>

      <TradeRiskGuardModal
        open={journal.riskGuardOpen}
        result={journal.riskGuardResult}
        pairLabel={journal.form.pair ? `${journal.form.pair} ${journal.form.direction}` : undefined}
        isSubmitting={journal.isSubmitting}
        onCancel={journal.handleRiskGuardCancel}
        onConfirm={journal.handleRiskGuardConfirm}
      />

      <JournalImportModal
        open={journal.isJournalImportOpen}
        onClose={() => journal.setIsJournalImportOpen(false)}
        onImported={() => {
          if (chrome.user?.id) void data.refetchTrades(chrome.user.id)
        }}
      />

      <AddTradeModal
        open={journal.isModalOpen}
        onClose={journal.closeModal}
        form={journal.form}
        onFormChange={(updates) => journal.setForm((prev) => ({ ...prev, ...updates }))}
        onSubmit={journal.handleSubmit}
        isSubmitting={journal.isSubmitting}
        isEditing={!!journal.editingTrade}
        journalMode={journal.editingTrade ? "edit" : journal.tradeJournalMode}
        onJournalModeChange={journal.setTradeJournalMode}
        existingStrategyNames={collectStrategyNamesFromTrades(data.accountTrades)}
        startingBalance={startingBalance}
        maxRiskPerTrade={journal.maxRiskPerTrade}
        isUploading={journal.isUploading}
        uploadProgress={journal.uploadProgress}
        isDragging={journal.isDragging}
        onDragOver={journal.handleDragOver}
        onDragLeave={journal.handleDragLeave}
        onDrop={journal.handleDrop}
        onScreenshotUpload={journal.handleScreenshotUpload}
        onScreenshotRemove={() => journal.setForm((prev) => ({ ...prev, screenshot_url: "" }))}
        onScreenshotPreview={() =>
          journal.setScreenshotViewer({ url: journal.form.screenshot_url, label: `${journal.form.pair || "Trade"} · MT5` })
        }
        onReflectionChartUpload={(file) => void journal.handleReflectionChartUpload(file)}
        onReflectionChartRemove={() => journal.setForm((prev) => ({ ...prev, reflection_chart_url: "" }))}
        onReflectionChartPreview={() =>
          journal.setScreenshotViewer({
            url: journal.form.reflection_chart_url,
            label: `${journal.form.pair || "Trade"} · TradingView reflection`,
          })
        }
        onMt5Autofill={() => void journal.handleMt5ScreenshotAutofill()}
        isMt5Autofilling={journal.isMt5Autofilling}
        mt5AutofillSignal={journal.mt5AutofillSignal}
        onOpenCoach={() => void journal.handleOpenCoach(buildPlannedContextFromForm(journal.form, journal.maxRiskPerTrade))}
        canRepeatLast={!journal.editingTrade && data.accountTrades.length > 0}
        repeatSourceLabel={getMostRecentTradeForRepeat(data.accountTrades)?.pair}
        onRepeatLast={() => {
          const source = getMostRecentTradeForRepeat(data.accountTrades)
          if (!source) return
          journal.setForm(buildRepeatTradeDraft(source))
        }}
        linkedPlan={journal.linkedPlan}
        onLinkedPlanChange={journal.setLinkedPlan}
        postSaveDiscipline={journal.postSaveDiscipline}
      />

      <ScreenshotViewerModal
        open={!!journal.screenshotViewer}
        imageUrl={journal.screenshotViewer?.url ?? null}
        title={journal.screenshotViewer?.label}
        onClose={() => journal.setScreenshotViewer(null)}
      />

      <TradeDetailsModal
        trade={journal.selectedTrade}
        maxRiskPerTrade={journal.maxRiskPerTrade}
        coachFeedbackRefreshKey={journal.coachFeedbackRefreshKey}
        onClose={() => journal.setSelectedTrade(null)}
        onEdit={(trade) => journal.handleEditTrade(trade as unknown as Parameters<typeof journal.handleEditTrade>[0])}
        isScreenshotOpen={!!journal.screenshotViewer}
        onScreenshotClick={(trade) =>
          journal.setScreenshotViewer({ url: trade.screenshot_url ?? null, label: `${trade.pair} · MT5` })
        }
        onReflectionChartClick={(trade) =>
          journal.setScreenshotViewer({
            url: trade.reflection_chart_url ?? null,
            label: `${trade.pair} · TradingView reflection`,
          })
        }
        onReflectionChartUpload={(trade, file) =>
          void journal.handleReflectionChartUploadForTrade(
            trade as unknown as Parameters<typeof journal.handleReflectionChartUploadForTrade>[0],
            file,
          )
        }
        isReflectionUploading={journal.isUploading}
      />

      <VyronisScoreResultModal
        open={journal.vyronisResultOpen}
        evaluation={journal.lastVyronisEvaluation}
        pairLabel={journal.lastVyronisPairLabel}
        onClose={() => journal.setVyronisResultOpen(false)}
      />

      {journal.isDeleteModalOpen && journal.tradeToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="dashboard-modal-backdrop"
            onClick={() => {
              journal.setIsDeleteModalOpen(false)
              journal.setTradeToDelete(null)
            }}
          />
          <div className="dashboard-modal-panel relative mx-4 w-full max-w-md border-loss/20">
            <div className="relative border-b border-white/[0.06] px-6 py-5">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-loss/[0.08] via-transparent to-transparent" />
              <div className="relative flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-[10px] border border-loss/20 bg-loss/[0.08]">
                  <Trash2 className="size-4 text-loss" />
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Delete Trade</h2>
                  <p className="text-[11px] text-muted-foreground/70">This action cannot be undone</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="mb-4 text-[13px] text-muted-foreground">Are you sure you want to delete this trade?</p>
              <div className="dashboard-inset-panel space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">{journal.tradeToDelete.pair}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      journal.tradeToDelete.result === "WIN"
                        ? "bg-profit/20 text-profit"
                        : journal.tradeToDelete.result === "LOSS"
                          ? "bg-loss/20 text-loss"
                          : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {journal.tradeToDelete.result}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Direction:</span>
                    <span className={`ml-1 ${journal.tradeToDelete.direction === "BUY" ? "text-profit" : "text-loss"}`}>
                      {journal.tradeToDelete.direction}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">P&L:</span>
                    <span
                      className={`ml-1 font-medium ${getPnLTextClass(journal.tradeToDelete.pnl, journal.tradeToDelete.result)}`}
                    >
                      {formatPnL(journal.tradeToDelete.pnl, journal.tradeToDelete.result)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    journal.setIsDeleteModalOpen(false)
                    journal.setTradeToDelete(null)
                  }}
                  className="flex-1 h-11 border-border/50 hover:bg-secondary/50"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={journal.confirmDeleteTrade}
                  disabled={journal.isDeleting}
                  className="flex-1 h-11 bg-loss hover:bg-loss/90 text-white"
                >
                  {journal.isDeleting ? (
                    <div className="flex items-center gap-2">
                      <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deleting...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Trash2 className="size-4" />
                      Delete Trade
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {chrome.tradingRulesModal}
      <VyronisCommandCenter />
      <Toaster />
    </AIContextProvider>
  )
}
