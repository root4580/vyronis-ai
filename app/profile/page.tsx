"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, UserRound } from "lucide-react"
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
import { DashboardInsetPanel } from "@/components/dashboard/dashboard-primitives"
import { UserProfileCardSkeleton } from "@/components/dashboard/user-profile-card"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
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

export default function ProfileSettingsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  const [email, setEmail] = useState<string>("")
  const [profileRecord, setProfileRecord] = useState<UserProfileRecord | null>(null)
  const [form, setForm] = useState<UserProfileForm>(DEFAULT_USER_PROFILE)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (cancelled) return

      if (!user) {
        router.replace("/auth/login?next=/profile")
        return
      }

      setEmail(user.email ?? "")

      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()

      if (error && !/relation|schema cache|does not exist/i.test(error.message)) {
        console.log(error)
      }

      if (data) {
        setProfileRecord(data)
        setForm(normalizeUserProfile(data))
        writeCachedUserProfile(normalizeUserProfile(data))
      } else {
        const { error: upsertError } = await supabase.from("user_profiles").upsert(
          {
            user_id: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        )

        if (upsertError) {
          toast({
            title: "Profile unavailable",
            description: upsertError.message.includes("user_profiles")
              ? "Run supabase/user-profiles-migration.sql in Supabase first."
              : upsertError.message,
            variant: "destructive",
          })
        }

        setForm(DEFAULT_USER_PROFILE)
      }

      setIsLoading(false)
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [router, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.replace("/auth/login?next=/profile")
      return
    }

    setIsSaving(true)

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
      setIsSaving(false)
      return
    }

    setProfileRecord(data)
    const savedProfile = normalizeUserProfile(data)
    setForm(savedProfile)
    writeCachedUserProfile(savedProfile)
    toast({
      title: "Profile updated",
      description: "Your trader profile has been saved.",
    })
    setIsSaving(false)
    router.push("/")
    router.refresh()
  }

  const previewName = getProfileDisplayName(form, email)

  return (
    <div className="dashboard-shell min-h-screen">
      <div className="dashboard-container px-4 py-5 md:px-6 md:py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:border-cyan-glow/20 hover:text-cyan-glow"
            >
              <ArrowLeft className="size-4" />
              Back to Dashboard
            </Link>
          </div>

          <div className="add-trade-modal glass-card relative overflow-hidden rounded-2xl border border-cyan-glow/15">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-glow/[0.06] via-transparent to-profit/[0.04]" />

            <div className="relative border-b border-white/[0.06] px-5 py-5 md:px-6">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl border border-cyan-glow/25 bg-cyan-glow/[0.1]">
                  <UserRound className="size-5 text-cyan-glow" />
                </div>
                <div>
                  <h1 className="text-[18px] font-semibold tracking-tight">Profile Settings</h1>
                  <p className="text-[11px] text-muted-foreground/75">
                    Update your trader identity and preferences
                  </p>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="relative px-5 py-8 md:px-6">
                <UserProfileCardSkeleton />
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="skeleton-shimmer h-10 rounded-xl" />
                  ))}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="relative px-5 py-5 md:px-6 md:py-6">
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

                <Button
                  type="submit"
                  disabled={isSaving}
                  className="mt-6 h-11 w-full bg-gradient-to-r from-cyan-glow to-cyan-glow/80 text-background"
                >
                  {isSaving ? (
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
        </div>
      </div>

      <Toaster />
    </div>
  )
}
