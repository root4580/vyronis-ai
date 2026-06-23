import { NextResponse } from "next/server"
import { deliverPasswordResetEmail } from "@/lib/auth-password-reset-delivery"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim() : ""

    if (!email) {
      return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 })
    }

    const result = await deliverPasswordResetEmail(email)

    if (!result.sent) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "Could not send password reset email." },
        { status: result.error?.includes("not configured") ? 503 : 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      message: `If an account exists for ${email}, a reset link was sent.`,
      via: result.via,
    })
  } catch (error) {
    console.error("[auth/send-password-reset]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Send failed." },
      { status: 500 },
    )
  }
}
