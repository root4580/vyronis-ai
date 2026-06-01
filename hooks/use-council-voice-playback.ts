"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CouncilAgentId, CouncilTranscriptEntry } from "@/lib/council/types"
import { fetchCouncilSpeech } from "@/lib/council/api-client"
import {
  readCouncilVoiceEnabledPreference,
  writeCouncilVoiceEnabledPreference,
} from "@/lib/council/voice-playback"

export function useCouncilVoicePlayback(voiceConfigured: boolean) {
  const [voiceEnabled, setVoiceEnabledState] = useState(true)
  const [speakingAgent, setSpeakingAgent] = useState<CouncilAgentId | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setVoiceEnabledState(readCouncilVoiceEnabledPreference())
  }, [])

  const setVoiceEnabled = useCallback((enabled: boolean) => {
    setVoiceEnabledState(enabled)
    writeCouncilVoiceEnabledPreference(enabled)
    if (!enabled) {
      abortRef.current?.abort()
      abortRef.current = null
      setSpeakingAgent(null)
      setIsSpeaking(false)
    }
  }, [])

  const stopPlayback = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setSpeakingAgent(null)
    setIsSpeaking(false)
  }, [])

  const speakEntries = useCallback(
    async (entries: CouncilTranscriptEntry[]) => {
      if (!voiceConfigured || !voiceEnabled) return

      const queue = entries.filter(
        (entry): entry is CouncilTranscriptEntry & { agent: CouncilAgentId } =>
          entry.agent !== "user" && entry.agent !== "system" && Boolean(entry.content.trim()),
      )
      if (queue.length === 0) return

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setIsSpeaking(true)

      for (const entry of queue) {
        if (controller.signal.aborted) break

        let objectUrl: string | null = null
        try {
          setSpeakingAgent(entry.agent)
          const blob = await fetchCouncilSpeech({
            agent: entry.agent,
            text: entry.content,
          })
          if (controller.signal.aborted) break

          objectUrl = URL.createObjectURL(blob)
          await playAudioUrl(objectUrl, controller.signal)
        } catch {
          break
        } finally {
          if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
      }

      if (abortRef.current === controller) {
        abortRef.current = null
      }
      setSpeakingAgent(null)
      setIsSpeaking(false)
    },
    [voiceConfigured, voiceEnabled],
  )

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  return {
    voiceEnabled,
    setVoiceEnabled,
    voiceAvailable: voiceConfigured,
    speakingAgent,
    isSpeaking,
    speakEntries,
    stopPlayback,
  }
}

function playAudioUrl(url: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url)

    const cleanup = () => {
      signal.removeEventListener("abort", onAbort)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("error", onError)
      audio.pause()
    }

    const onEnded = () => {
      cleanup()
      resolve()
    }

    const onError = () => {
      cleanup()
      reject(new Error("Audio playback failed"))
    }

    const onAbort = () => {
      cleanup()
      resolve()
    }

    audio.addEventListener("ended", onEnded)
    audio.addEventListener("error", onError)
    signal.addEventListener("abort", onAbort)

    void audio.play().catch((error) => {
      cleanup()
      reject(error instanceof Error ? error : new Error("Could not start audio"))
    })
  })
}
