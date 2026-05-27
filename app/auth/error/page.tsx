import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"

export default function AuthErrorPage() {
  return (
    <AuthShell
      title="Authentication Error"
      subtitle="Something went wrong during sign-in or email confirmation"
      accent="loss"
    >
      <p className="text-center text-sm leading-relaxed text-muted-foreground">
        Your session could not be established. Try signing in again or request a new confirmation email.
      </p>
      <Link
        href="/auth/login"
        className="auth-submit-btn mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-glow to-cyan-glow/80 py-3 font-semibold text-background"
      >
        Back to Login
        <ArrowRight className="size-4" />
      </Link>
    </AuthShell>
  )
}
