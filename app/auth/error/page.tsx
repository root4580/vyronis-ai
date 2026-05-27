import Link from "next/link"
import { ArrowRight, Mail } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"

type AuthErrorPageProps = {
  searchParams: Promise<{ reason?: string }>
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const { reason } = await searchParams

  const message =
    reason === "expired"
      ? "This link has expired. Request a new verification or password reset email."
      : reason === "access_denied"
        ? "Sign-in was cancelled or the link is no longer valid."
        : "Something went wrong during sign-in or email confirmation."

  return (
    <AuthShell
      title="Authentication Error"
      subtitle="We could not complete sign-in"
      accent="loss"
    >
      <p className="text-center text-sm leading-relaxed text-muted-foreground">{message}</p>
      <div className="mt-6 space-y-2">
        <Link
          href="/auth/login"
          className="auth-submit-btn inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-glow to-cyan-glow/80 py-3 font-semibold text-background"
        >
          Back to Login
          <ArrowRight className="size-4" />
        </Link>
        <Link
          href="/auth/verify-email"
          className="inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl border border-cyan-glow/25 bg-cyan-glow/[0.06] py-3 text-sm font-medium text-cyan-glow hover:bg-cyan-glow/[0.1]"
        >
          <Mail className="size-4" />
          Resend verification email
        </Link>
        <Link
          href="/auth/forgot-password"
          className="block py-2 text-center text-sm font-medium text-muted-foreground hover:text-cyan-glow"
        >
          Reset password instead
        </Link>
      </div>
    </AuthShell>
  )
}
