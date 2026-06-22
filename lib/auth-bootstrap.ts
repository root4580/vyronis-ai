import type { SupabaseClient } from "@supabase/supabase-js"
import { DEFAULT_DASHBOARD_PREFERENCES } from "@/lib/user-preferences"
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings"

export async function bootstrapNewUserRecords(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      ...DEFAULT_USER_SETTINGS,
      dashboard_preferences: DEFAULT_DASHBOARD_PREFERENCES,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id", ignoreDuplicates: true },
  )

  await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id", ignoreDuplicates: true },
  )
}
