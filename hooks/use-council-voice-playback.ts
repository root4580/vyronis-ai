"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CouncilAgentId, CouncilTranscriptEntry } from "@/lib/council/types"
import { fetchCouncilSpeech } from "@/lib/council/api-client"
import type { RefObject } from "react"
import {
  AsyncSpeechQueue,
  type CouncilVoiceSessionController,
} from "@/lib/council/voice-session"
import {
  readCouncilVoiceEnabledPreference,
  readCouncilVoiceVolumePreference,
  writeCouncilVoiceEnabledPreference,
  writeCouncilVoiceVolumePreference,
} from "@/lib/council/voice-playback"

type UseCouncilVoicePlaybackOptions = {
  session?: CouncilVoiceSessionController | null
  conversationActiveRef?: RefObject<boolean>
}

export function useCouncilVoicePlayback(
  voiceConfigured: boolean,
  options?: UseCouncilVoicePlaybackOptions,
) {
  const [voiceEnabled, setVoiceEnabledState] = useState(true)
  const [volume, setVolumeState] = useState(1)
  const [speakingAgent, setSpeakingAgent] = useState<CouncilAgentId | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const volumeRef = useRef(1)
  const sessionRef = useRef(options?.session ?? null)
  const conversationActiveRef = useRef(options?.conversationActiveRef ?? null)

  useEffect(() => {
    sessionRef.current = options?.session ?? null
  }, [options?.session])

  useEffect(() => {
    conversationActiveRef.current = options?.conversationActiveRef ?? null
  }, [options?.conversationActiveRef])

  useEffect(() => {
    setVoiceEnabledState(readCouncilVoiceEnabledPreference())
    const storedVolume = readCouncilVoiceVolumePreference()
    setVolumeState(storedVolume)
    volumeRef.current = storedVolume
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

  const setVolume = useCallback((nextVolume: number) => {
    const clamped = Math.min(1, Math.max(0, nextVolume))
    setVolumeState(clamped)
    volumeRef.current = clamped
    writeCouncilVoiceVolumePreference(clamped)
  }, [])

  const stopPlayback = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setSpeakingAgent(null)
    setIsSpeaking(false)
  }, [])

  const speakEntries = useCallback(
    async (entries: CouncilTranscriptEntry[]) => {
      const session = sessionRef.current
      const agentEntries = entries.filter(
        (entry): entry is CouncilTranscriptEntry & { agent: CouncilAgentId } =>
          entry.agent !== "user" && entry.agent !== "system" && Boolean(entry.content.trim()),
      )

      if (!voiceConfigured || !voiceEnabled || agentEntries.length === 0) {
        if (conversationActiveRef.current?.current) {
          session?.beginListening()
        }
        return
      }

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setIsSpeaking(true)
      session?.beginSpeaking()

      const audioQueue = new AsyncSpeechQueue()
      const objectUrls: string[] = []

      const producer = async () => {
        try {
          for (const entry of agentEntries) {
            if (controller.signal.aborted) break
            const blob = await fetchCouncilSpeech({
              agent: entry.agent,
              text: entry.content,
            })
            if (controller.signal.aborted) break
            const objectUrl = URL.createObjectURL(blob)
            objectUrls.push(objectUrl)
            audioQueue.push({ agent: entry.agent, objectUrl })
          }
        } finally {
          audioQueue.close()
        }
      }

      const consumer = async () => {
        while (!controller.signal.aborted) {
          let clip
          try {
            clip = await audioQueue.pop(controller.signal)
          } catch {
            break
          }
          if (!clip) break

          try {
            setSpeakingAgent(clip.agent)
            await playAudioUrl(clip.objectUrl, controller.signal, volumeRef.current)
          } catch {
            break
          }
        }
      }

      try {
        await Promise.all([producer(), consumer()])
      } finally {
        for (const url of objectUrls) {
          URL.revokeObjectURL(url)
        }
        if (abortRef.current === controller) {
          abortRef.current = null
        }
        setSpeakingAgent(null)
        setIsSpeaking(false)
        if (controller.signal.aborted) {
          session?.reset()
        } else if (conversationActiveRef.current?.current) {
          session?.beginListening()
        } else {
          session?.setPhase("idle")
        }
      }
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
    volume,
    setVolume,
    voiceAvailable: voiceConfigured,
    speakingAgent,
    isSpeaking,
    speakEntries,
    stopPlayback,
  }
}

function playAudioUrl(url: string, signal: AbortSignal, volume: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url)
    audio.volume = volume

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
