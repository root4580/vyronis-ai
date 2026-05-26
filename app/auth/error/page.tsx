import Link from "next/link"
import { AlertTriangle, ArrowRight } from "lucide-react"

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.1),transparent_50%)]" />
      <div className="w-full max-w-md relative">
        <div className="relative">
          <div className="absolute -inset-[1px] bg-gradient-to-r from-loss/50 via-loss/20 to-loss/50 rounded-2xl blur-sm" />
          <div className="relative bg-card/80 backdrop-blur-xl rounded-2xl border border-loss/30 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-loss/10 rounded-full mb-4">
              <AlertTriangle className="size-8 text-loss" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Authentication Error</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Something went wrong during authentication. Please try again.
            </p>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-glow to-cyan-600 text-background font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              Back to Login
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
