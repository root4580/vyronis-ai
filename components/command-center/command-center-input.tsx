"use client"

import { FormEvent, useState } from "react"
import { Loader2, SendHorizonal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CommandCenterInputProps = {
  onSend: (content: string) => Promise<void>
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function CommandCenterInput({
  onSend,
  disabled,
  placeholder = "Ask about setups, patterns, or how you're feeling…",
  className,
}: CommandCenterInputProps) {
  const [value, setValue] = useState("")
  const [isSending, setIsSending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || isSending || disabled) return

    setIsSending(true)
    try {
      await onSend(trimmed)
      setValue("")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className={cn(
        "command-center-input flex items-end gap-2 rounded-xl border border-white/[0.08] bg-black/30 p-2",
        className,
      )}
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={2}
        placeholder={placeholder}
        disabled={disabled || isSending}
        className="max-h-24 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            void handleSubmit(event)
          }
        }}
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || isSending || !value.trim()}
        className="size-9 shrink-0 rounded-lg bg-cyan-glow/90 text-background hover:bg-cyan-glow"
      >
        {isSending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <SendHorizonal className="size-4" />
        )}
      </Button>
    </form>
  )
}
