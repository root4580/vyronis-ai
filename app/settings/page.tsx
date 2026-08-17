"use client"

import { useEffect, useMemo, useState } from "react"
import { Save, Settings as SettingsIcon, UserRound } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Toaster } from "@/components/ui/toaster"
import { SigningOutScreen } from "@/components/auth/signing-out-screen"
import { AppTabShell } from "@/components/shell/app-tab-shell"
import { AccountSettingsModal } from "@/components/dashboard/account-settings-modal"
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { UserProfileCardSkeleton } from "@/components/dashboard/user-profile-card"
import { StrategyPlaybookMain } from "@/components/strategy/strategy-playbook-main"
import { useToast } from "@/hooks/use-toast"
import { useAccountSettingsModal } from "@/hooks/use-account-settings-modal"
import { useDashboardChrome } from "@/hooks/use-dashboard-chrome"
import {
  DEFAULT_USER_PROFILE,
  getProfileDisplayName,
  normalizeUserProfile,
  PROFILE_TIMEZONES,
  TRADING_STYLES,
  writeCachedUserProfile,
  type UserProfileForm,
  type UserProfileRecord,
} from "@/lib/user-profile"

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground/80">
      {children}
    </Label>
  )
}

/**
 * Settings tab — consolidates trader profile (old /profile), account &
 * risk settings (the existing AccountSettingsModal, opened from a summary
 * card here instead of a header gear icon), and the My Strategy playbook
 * (old /strategy) into one screen. All three sections reuse their existing
 * data layer and components verbatim; /profile and /strategy stay reachable
 * at their old URLs until the redesign fully retires them.
 */
export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()
  const chrome = useDashboardChrome({ loginNextPath: "/settings" })
  const settings = useAccountSettingsModal(chrome.supabase, chrome.user?.id)

  const [email, setEmail] = useState<string>("")
  const [profileRecord, setProfileRecord] = useState<UserProfileRecord | null>(null)
  const [form, setForm] = useState<UserProfileForm>(DEFAULT_USER_PROFILE)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (cancelled) return
      if (!user) return

      setEmail(user.email ?? "")

      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()

      if (cancelled) return

      if (error && !/relation|schema cache|does not exist/i.test(error.message)) {
        console.log(error)
      }

      if (data) {
        setProfileRecord(data)
        setForm(normalizeUserProfile(data))
        writeCachedUserProfile(user.id, normalizeUserProfile(data))
      } else {
        setForm(DEFAULT_USER_PROFILE)
      }

      setIsLoadingProfile(false)
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [supabase])

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    setIsSavingProfile(true)

    const payload = {
      user_id: user.id,
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      phone: form.phone.trim() || null,
      country: form.country.trim() || null,
      timezone: form.timezone.trim() || DEFAULT_USER_PROFILE.timezone,
      trading_style: form.trading_style.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single()

    if (error) {
      toast({
        title: "Could not save profile",
        description: error.message.includes("user_profiles")
          ? "Run supabase/user-profiles-migration.sql in Supabase first."
          : error.message,
        variant: "destructive",
      })
      setIsSavingProfile(false)
      return
    }

    setProfileRecord(data)
    const savedProfile = normalizeUserProfile(data)
    setForm(savedProfile)
    writeCachedUserProfile(user.id, savedProfile)
    toast({
      title: "Profile updated",
      description: "Your trader profile has been saved.",
    })
    setIsSavingProfile(false)
  }

  const previewName = getProfileDisplayName(form, email)

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
    <>
      <AppTabShell
        activeTab="settings"
        profileCard={chrome.profileCard}
        showProfileEmptyHint={chrome.showProfileEmptyHint}
        accountSwitcher={chrome.accountSwitcher}
        onOpenSettings={settings.openSettings}
        onLogout={() => void chrome.handleLogout()}
        isLoggingOut={chrome.isLoggingOut}
        banner={chrome.tradingRulesBanner}
      >
        <section className="dashboard-section">
          <p className="dashboard-section-title">Settings</p>
          <p className="max-w-2xl text-sm text-muted-foreground/75">
            Your trader profile, account &amp; risk limits, and the strategy your coach grades trades against.
          </p>
        </section>

        <div className="add-trade-modal glass-card relative overflow-hidden rounded-2xl border border-cyan-glow/15">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-glow/[0.06] via-transparent to-profit/[0.04]" />

          <div className="relative border-b border-white/[0.06] px-5 py-5 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl border border-cyan-glow/25 bg-cyan-glow/[0.1]">
                <UserRound className="size-5 text-cyan-glow" />
              </div>
              <div>
                <h2 className="text-[18px] font-semibold tracking-tight">Trader Profile</h2>
                <p className="text-[11px] text-muted-foreground/75">Update your identity and preferences</p>
              </div>
            </div>
          </div>

          {isLoadingProfile ? (
            <div className="relative px-5 py-8 md:px-6">
              <UserProfileCardSkeleton />
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="skeleton-shimmer h-10 rounded-xl" />
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleProfileSubmit} className="relative px-5 py-5 md:px-6 md:py-6">
              <DashboardInsetPanel className="glass mb-5 border-cyan-glow/15 bg-cyan-glow/[0.04]">
                <p className="text-[10px] uppercase tracking-[0.12em] text-cyan-glow/80">Preview</p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">{previewName}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/70">{email}</p>
              </DashboardInsetPanel>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>First Name</FieldLabel>
                  <Input
                    value={form.first_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))}
                    className="add-trade-input h-10"
                    placeholder="Alex"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Last Name</FieldLabel>
                  <Input
                    value={form.last_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))}
                    className="add-trade-input h-10"
                    placeholder="Rivera"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Phone</FieldLabel>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    className="add-trade-input h-10"
                    placeholder="+1 555 0100"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Country</FieldLabel>
                  <Input
                    value={form.country}
                    onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
                    className="add-trade-input h-10"
                    placeholder="United States"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Timezone</FieldLabel>
                  <Select
                    value={form.timezone}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, timezone: value }))}
                  >
                    <SelectTrigger className="add-trade-input h-10">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-white/[0.08]">
                      {PROFILE_TIMEZONES.map((timezone) => (
                        <SelectItem key={timezone} value={timezone}>
                          {timezone.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Trading Style</FieldLabel>
                  <Select
                    value={form.trading_style || undefined}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, trading_style: value }))}
                  >
                    <SelectTrigger className="add-trade-input h-10">
                      <SelectValue placeholder="Select style" />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-white/[0.08]">
                      {TRADING_STYLES.map((style) => (
                        <SelectItem key={style} value={style}>
                          {style}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {profileRecord?.updated_at && (
                <p className="mt-4 text-[10px] text-muted-foreground/60">
                  Last updated {new Date(profileRecord.updated_at).toLocaleString()}
                </p>
              )}

              <Button type="submit" disabled={isSavingProfile} className="mt-6 h-11 w-full btn-primary">
                {isSavingProfile ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                    Saving Profile...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save className="size-4" />
                    Save Profile
                  </span>
                )}
              </Button>
            </form>
          )}
        </div>

        <div className="hq-surface-card flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl border border-cyan-glow/25 bg-cyan-glow/[0.1]">
              <SettingsIcon className="size-5 text-cyan-glow" />
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-tight">Account &amp; Risk Settings</p>
              <p className="text-[11px] text-muted-foreground/75">
                Starting balance, risk limits, trading accounts, TradingView webhook, MT5 connection
              </p>
            </div>
          </div>
          <Button type="button" onClick={settings.openSettings} className="btn-primary">
            Edit account settings
          </Button>
        </div>

        <div>
          <p className="dashboard-section-title mb-3">My Strategy</p>
          <p className="mb-3 max-w-2xl text-sm text-muted-foreground/75">
            Explain your setup rules, bias filters, and invalidation conditions — your coach applies this when
            grading trades.
          </p>
          <StrategyPlaybookMain embedded />
        </div>
      </AppTabShell>

      <AccountSettingsModal
        open={settings.isOpen}
        onClose={settings.closeSettings}
        form={settings.form}
        onFormChange={(updates) => settings.setForm((prev) => ({ ...prev, ...updates }))}
        onSubmit={(event) => void settings.saveSettings(event)}
        isSaving={settings.isSaving}
        accountBalance={settings.form.starting_balance}
        totalPnL={0}
        accounts={chrome.accounts}
        activeAccountId={chrome.activeAccountId}
        accountsLoading={chrome.isLoading}
        accountsSaving={chrome.isSaving}
        accountsError={chrome.error}
        onCreateAccount={chrome.createAccount}
        onUpdateAccount={chrome.updateAccount}
        onDeleteAccount={chrome.deleteAccount}
        onSwitchAccount={(accountId) => void chrome.switchAccount(accountId)}
      />

      {chrome.tradingRulesModal}
      <Toaster />
    </>
  )
}
