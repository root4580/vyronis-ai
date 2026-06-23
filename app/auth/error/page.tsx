import Link from "next/link"
import { ArrowRight, Mail } from "lucide-react"
import { AuthErrorBanner, AuthShell } from "@/components/auth/auth-shell"

type AuthErrorPageProps = {
  searchParams: Promise<{
    reason?: string
    detail?: string
    method?: string
    type?: string
  }>
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const { reason, detail, method, type } = await searchParams

  const fallbackMessage =
    reason === "expired"
      ? "This link has expired. Request a new verification or password reset email."
      : reason === "access_denied"
        ? "Sign-in was cancelled or the link is no longer valid."
        : reason === "missing_params"
          ? "This link is incomplete. Request a new verification email."
          : "Something went wrong during sign-in or email confirmation."

  const message = detail?.trim() ? detail.trim() : fallbackMessage

  return (
    <AuthShell
      title="Authentication Error"
      subtitle="We could not complete sign-in"
      accent="loss"
    >
      <div className="space-y-3">
        <AuthErrorBanner message={message} />
        {detail?.trim() ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/90">
            <p className="font-medium text-amber-300">Debug (temporary)</p>
            <p className="mt-1 break-all font-mono text-[10px] text-foreground/80">{detail}</p>
            {(method || type || reason) && (
              <p className="mt-2 text-muted-foreground">
                {reason ? `reason=${reason}` : null}
                {method ? ` · method=${method}` : null}
                {type ? ` · type=${type}` : null}
              </p>
            )}
          </div>
        ) : null}
      </div>
      <div className="mt-6 space-y-2">
        <Link
          href="/auth/login"
          className="auth-submit-btn inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl btn-primary py-3"
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
