"use client"

import { useEffect, useRef } from "react"
import { Bot, Sparkles, User } from "lucide-react"
import type { CommandCenterMessageRecord } from "@/lib/command-center/types"
import { cn } from "@/lib/utils"

type AiMessageThreadProps = {
  messages: CommandCenterMessageRecord[]
  isSending?: boolean
  className?: string
}

function MessageBubble({ message }: { message: CommandCenterMessageRecord }) {
  const isUser = message.role === "user"
  const isGreeting = message.message_type === "greeting"

  return (
    <div
      className={cn(
        "command-center-message flex gap-2.5",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg border",
          isUser
            ? "border-white/10 bg-white/[0.06]"
            : "border-cyan-glow/20 bg-cyan-glow/[0.08]",
        )}
      >
        {isUser ? (
          <User className="size-3.5 text-muted-foreground" />
        ) : (
          <Bot className="size-3.5 text-cyan-glow" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl border px-3 py-2.5 text-[12px] leading-relaxed",
          isUser
            ? "border-white/[0.08] bg-white/[0.05] text-foreground/90"
            : isGreeting
              ? "border-cyan-glow/25 bg-gradient-to-br from-cyan-glow/[0.1] to-transparent text-foreground/90"
              : "border-white/[0.07] bg-black/20 text-foreground/85",
        )}
      >
        {isGreeting ? (
          <div className="mb-1 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-glow/80">
            <Sparkles className="size-3" />
            Contextual greeting
          </div>
        ) : null}
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  )
}

export function AiMessageThread({ messages, isSending, className }: AiMessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, isSending])

  return (
    <div className={cn("command-center-thread flex min-h-0 flex-1 flex-col", className)}>
      <div className="command-center-thread-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isSending ? (
          <div className="flex items-center gap-2 px-2 text-[11px] text-muted-foreground/70">
            <span className="command-center-typing flex gap-1">
              <span />
              <span />
              <span />
            </span>
            Vyronis is thinking…
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
