export type UserProfileRecord = {
  id?: string
  user_id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  country: string | null
  timezone: string | null
  trading_style: string | null
  created_at?: string
  updated_at?: string
}

export type UserProfileForm = {
  first_name: string
  last_name: string
  phone: string
  country: string
  timezone: string
  trading_style: string
}

export const DEFAULT_USER_PROFILE: UserProfileForm = {
  first_name: "",
  last_name: "",
  phone: "",
  country: "",
  timezone: "America/New_York",
  trading_style: "",
}

export const TRADING_STYLES = [
  "Scalping",
  "Day Trading",
  "Swing Trading",
  "Position Trading",
  "Price Action",
  "Algorithmic",
] as const

export const PROFILE_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
] as const

export function normalizeUserProfile(
  data: Partial<UserProfileRecord> | null | undefined,
): UserProfileForm {
  return {
    first_name: data?.first_name?.trim() ?? "",
    last_name: data?.last_name?.trim() ?? "",
    phone: data?.phone?.trim() ?? "",
    country: data?.country?.trim() ?? "",
    timezone: data?.timezone?.trim() || DEFAULT_USER_PROFILE.timezone,
    trading_style: data?.trading_style?.trim() ?? "",
  }
}

export function getProfileDisplayName(
  profile: Pick<UserProfileForm, "first_name" | "last_name"> | null | undefined,
  email?: string | null,
): string {
  const first = profile?.first_name?.trim()
  const last = profile?.last_name?.trim()

  if (first && last) return `${first} ${last}`
  if (first) return first
  if (last) return last
  if (email) return email

  return "Trader"
}

export function getProfileSubtitle(propFirmSize?: string | null): string {
  const size = propFirmSize?.trim()
  if (size) return `${size} prop firm account`
  return "Logged in as trader"
}

export function getProfileInitials(
  profile: Pick<UserProfileForm, "first_name" | "last_name"> | null | undefined,
  email?: string | null,
): string {
  const first = profile?.first_name?.trim()
  const last = profile?.last_name?.trim()

  if (first && last) return `${first[0]}${last[0]}`.toUpperCase()
  if (first) return first.slice(0, 2).toUpperCase()
  if (last) return last.slice(0, 2).toUpperCase()
  if (email) return email.slice(0, 2).toUpperCase()
  return "VT"
}

export const PROFILE_CACHE_KEY = "vyronis-user-profile"

type ProfileCacheEnvelope = {
  userId: string
  profile: UserProfileForm
  updatedAt: string
}

function isProfileEnvelope(value: unknown): value is ProfileCacheEnvelope {
  if (!value || typeof value !== "object") return false
  const record = value as ProfileCacheEnvelope
  return typeof record.userId === "string" && !!record.profile
}

/** Never returns a profile unless cache belongs to the given user. */
export function readCachedUserProfile(userId: string | null | undefined): UserProfileForm | null {
  if (!userId || typeof window === "undefined") return null

  try {
    const raw = sessionStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (!isProfileEnvelope(parsed)) {
      sessionStorage.removeItem(PROFILE_CACHE_KEY)
      return null
    }

    if (parsed.userId !== userId) return null
    return normalizeUserProfile(parsed.profile as Partial<UserProfileRecord>)
  } catch {
    sessionStorage.removeItem(PROFILE_CACHE_KEY)
    return null
  }
}

export function writeCachedUserProfile(userId: string, profile: UserProfileForm) {
  if (!userId || typeof window === "undefined") return

  const envelope: ProfileCacheEnvelope = {
    userId,
    profile,
    updatedAt: new Date().toISOString(),
  }
  sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(envelope))
}

export function clearCachedUserProfile() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(PROFILE_CACHE_KEY)
}

export function extractProfileFromAuthMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Pick<UserProfileForm, "first_name" | "last_name"> {
  const meta = metadata ?? {}
  const directFirst = typeof meta.first_name === "string" ? meta.first_name.trim() : ""
  const directLast = typeof meta.last_name === "string" ? meta.last_name.trim() : ""

  if (directFirst || directLast) {
    return { first_name: directFirst, last_name: directLast }
  }

  const fullName =
    typeof meta.full_name === "string"
      ? meta.full_name.trim()
      : typeof meta.name === "string"
        ? meta.name.trim()
        : ""

  if (!fullName) {
    return { first_name: "", last_name: "" }
  }

  const parts = fullName.split(/\s+/).filter(Boolean)
  return {
    first_name: parts[0] ?? "",
    last_name: parts.slice(1).join(" "),
  }
}

export function mergeProfileWithMetadata(
  profile: UserProfileForm,
  metadata: Record<string, unknown> | null | undefined,
): UserProfileForm {
  const fromMeta = extractProfileFromAuthMetadata(metadata)

  return {
    ...profile,
    first_name: profile.first_name || fromMeta.first_name,
    last_name: profile.last_name || fromMeta.last_name,
  }
}

export function isMissingProfileTableError(message: string) {
  return /relation|schema cache|does not exist|user_profiles/i.test(message)
}

export type LoadedUserProfile = {
  profile: UserProfileForm
  missingTable: boolean
  errorMessage: string | null
}

export async function loadUserProfile(
  supabase: {
    from: (
      table: string,
    ) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{
            data: UserProfileRecord | null
            error: { message: string; code?: string } | null
          }>
        }
      }
      upsert: (
        values: Record<string, unknown>,
        options: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>
    }
  },
  userId: string,
  metadata?: Record<string, unknown> | null,
): Promise<LoadedUserProfile> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("first_name, last_name, phone, country, timezone, trading_style")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    if (isMissingProfileTableError(error.message)) {
      return {
        profile: mergeProfileWithMetadata(DEFAULT_USER_PROFILE, metadata),
        missingTable: true,
        errorMessage: error.message,
      }
    }

    return {
      profile: mergeProfileWithMetadata(DEFAULT_USER_PROFILE, metadata),
      missingTable: false,
      errorMessage: error.message,
    }
  }

  if (data) {
    const profile = mergeProfileWithMetadata(normalizeUserProfile(data), metadata)
    writeCachedUserProfile(userId, profile)
    return {
      profile,
      missingTable: false,
      errorMessage: null,
    }
  }

  const { error: upsertError } = await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )

  if (upsertError && isMissingProfileTableError(upsertError.message)) {
    return {
      profile: mergeProfileWithMetadata(DEFAULT_USER_PROFILE, metadata),
      missingTable: true,
      errorMessage: upsertError.message,
    }
  }

  const profile = mergeProfileWithMetadata(DEFAULT_USER_PROFILE, metadata)
  writeCachedUserProfile(userId, profile)

  return {
    profile,
    missingTable: false,
    errorMessage: upsertError?.message ?? null,
  }
}
