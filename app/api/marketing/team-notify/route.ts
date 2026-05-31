import { NextResponse } from "next/server"
import { sendResendEmail } from "@/lib/alerts/resend-config"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; source?: string }
    const email = body.email?.trim().toLowerCase()
    const source = body.source?.trim() || "pricing"

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { error: insertError } = await supabase.from("waitlist").upsert(
      { email, source },
      { onConflict: "email", ignoreDuplicates: false },
    )

    if (insertError && insertError.code !== "23505") {
      console.error("waitlist insert failed:", insertError)
      return NextResponse.json({ error: "Could not save your email." }, { status: 500 })
    }

    const inbox =
      process.env.TEAM_NOTIFY_INBOX?.trim() ||
      process.env.RESEND_FROM_EMAIL?.trim() ||
      ""

    if (inbox) {
      void sendResendEmail({
        to: inbox,
        subject: `Team plan interest — ${email}`,
        html: `<p>New Team plan notify request:</p><p><strong>${email}</strong></p><p>Source: ${source}</p>`,
      }).catch(() => undefined)
    }

    return NextResponse.json({
      ok: true,
      message: "You're on the list — we'll email you when Team launches.",
    })
  } catch (error) {
    console.error("team-notify failed:", error)
    return NextResponse.json({ error: "Could not save your email." }, { status: 500 })
  }
}
