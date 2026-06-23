import { NextResponse } from "next/server"
import { deliverSignupConfirmationEmail } from "@/lib/auth-confirmation-delivery"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim() : ""
    const password = typeof body.password === "string" ? body.password : undefined

    if (!email) {
      return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 })
    }

    const result = await deliverSignupConfirmationEmail(email, password)

    if (!result.sent) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "Could not send confirmation email." },
        { status: result.error?.includes("not configured") ? 503 : 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      message: `Confirmation email sent to ${email}.`,
      via: result.via,
    })
  } catch (error) {
    console.error("[auth/send-confirmation]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Send failed." },
      { status: 500 },
    )
  }
}
