"use client"

import { useMemo, useRef } from "react"
import { CouncilVoiceSessionController } from "@/lib/council/voice-session"
import { useCouncilVoiceInput } from "@/hooks/use-council-voice-input"
import { useCouncilVoicePlayback } from "@/hooks/use-council-voice-playback"

type UseCouncilVoiceSessionOptions = {
  onVoiceError?: (message: string | null) => void
}

export function useCouncilVoiceSession(
  voiceConfigured: boolean,
  listenConfigured: boolean,
  options?: UseCouncilVoiceSessionOptions,
) {
  const session = useMemo(() => new CouncilVoiceSessionController(), [])
  const conversationActiveRef = useRef(false)

  const playback = useCouncilVoicePlayback(voiceConfigured, {
    session,
    conversationActiveRef,
    onVoiceError: options?.onVoiceError,
  })

  const input = useCouncilVoiceInput(listenConfigured, { session })

  const startConversation = (
    onUtterance: (text: string) => Promise<void>,
    onGoodbye?: () => void | Promise<void>,
  ) => {
    conversationActiveRef.current = true
    input.startConversation(onUtterance, onGoodbye)
  }

  const stopConversation = () => {
    conversationActiveRef.current = false
    input.stopConversation()
  }

  return {
    session,
    conversationActiveRef,
    ...playback,
    ...input,
    startConversation,
    stopConversation,
  }
}
