import type { User } from "@supabase/supabase-js"

/** Supabase returns an empty identities array when the email is already registered. */
export function isDuplicateSignupUser(user: User | null | undefined): boolean {
  return Boolean(user && (!user.identities || user.identities.length === 0))
}
