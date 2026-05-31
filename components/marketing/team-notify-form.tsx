"use client"

import { useState } from "react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function TeamNotifyForm() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error")
      setMessage("Enter a valid email address.")
      return
    }

    setStatus("loading")
    setMessage(null)

    try {
      const response = await fetch("/api/marketing/team-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source: "pricing" }),
      })

      const data = (await response.json().catch(() => null)) as { message?: string; error?: string } | null

      if (!response.ok) {
        setStatus("error")
        setMessage(data?.error ?? "Could not save your email. Try again.")
        return
      }

      setStatus("success")
      setMessage(data?.message ?? "You're on the list — we'll email you when Team launches.")
      setEmail("")
    } catch {
      setStatus("error")
      setMessage("Network error. Try again in a moment.")
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-2">
      <Input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@desk.com"
        disabled={status === "loading" || status === "success"}
        className="h-10 border-white/[0.12] bg-black/20"
        aria-label="Email for Team plan notifications"
      />
      <Button
        type="submit"
        variant="outline"
        disabled={status === "loading" || status === "success"}
        className="w-full border-white/[0.12]"
      >
        Notify me
        <ArrowRight className="ml-1.5 size-3.5" />
      </Button>
      {message ? (
        <p
          className={`text-[11px] leading-relaxed ${
            status === "error" ? "text-loss" : "text-muted-foreground"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  )
}
