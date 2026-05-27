/** Map Supabase Auth errors to user-friendly copy for auth pages. */
export function formatAuthError(message: string): string {
  const normalized = message.trim().toLowerCase()

  if (normalized.includes("email not confirmed")) {
    return "Confirm your email before signing in. Check your inbox or resend the verification link."
  }

  if (normalized.includes("invalid login credentials")) {
    return "Invalid email or password. Try again or reset your password."
  }

  if (normalized.includes("user already registered")) {
    return "An account with this email already exists. Sign in or reset your password."
  }

  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Too many attempts. Wait a minute and try again."
  }

  if (normalized.includes("email address invalid")) {
    return "Enter a valid email address."
  }

  if (normalized.includes("signup is disabled")) {
    return "New sign-ups are temporarily disabled. Contact support."
  }

  if (normalized.includes("redirect") && normalized.includes("url")) {
    return "Email could not be sent — redirect URL is not configured. Contact support."
  }

  return message
}

export function isEmailNotConfirmedError(message: string): boolean {
  return message.trim().toLowerCase().includes("email not confirmed")
}
