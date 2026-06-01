"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CouncilAgentId, CouncilTranscriptEntry } from "@/lib/council/types"
import { fetchCouncilSpeech } from "@/lib/council/api-client"
import { unlockCouncilAudio } from "@/lib/council/audio-unlock"
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
  onVoiceError?: (message: string | null) => void
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
  const onVoiceErrorRef = useRef(options?.onVoiceError ?? null)

  useEffect(() => {
    sessionRef.current = options?.session ?? null
  }, [options?.session])

  useEffect(() => {
    conversationActiveRef.current = options?.conversationActiveRef ?? null
  }, [options?.conversationActiveRef])

  useEffect(() => {
    onVoiceErrorRef.current = options?.onVoiceError ?? null
  }, [options?.onVoiceError])

  const reportVoiceError = useCallback((message: string | null) => {
    onVoiceErrorRef.current?.(message)
  }, [])

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

  const playAgentClip = useCallback(
    async (
      entry: CouncilTranscriptEntry & { agent: CouncilAgentId },
      controller: AbortController,
      objectUrls: string[],
    ) => {
      const blob = await fetchCouncilSpeech({
        agent: entry.agent,
        text: entry.content,
      })
      if (controller.signal.aborted) return

      const objectUrl = URL.createObjectURL(blob)
      objectUrls.push(objectUrl)
      setSpeakingAgent(entry.agent)
      await playAudioUrl(objectUrl, controller.signal, volumeRef.current)
    },
    [],
  )

  const speakEntries = useCallback(
    async (entries: CouncilTranscriptEntry[]) => {
      const session = sessionRef.current
      const agentEntries = entries.filter(
        (entry): entry is CouncilTranscriptEntry & { agent: CouncilAgentId } =>
          entry.agent !== "user" && entry.agent !== "system" && Boolean(entry.content.trim()),
      )

      if (!voiceConfigured) {
        reportVoiceError(
          "Spoken replies need ELEVENLABS_API_KEY on the server. Add it in your hosting env and redeploy.",
        )
        if (conversationActiveRef.current?.current) {
          session?.beginListening()
        }
        return
      }

      if (!voiceEnabled || agentEntries.length === 0) {
        if (conversationActiveRef.current?.current) {
          session?.beginListening()
        }
        return
      }

      unlockCouncilAudio()
      reportVoiceError(null)

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setIsSpeaking(true)
      session?.beginSpeaking()

      const audioQueue = new AsyncSpeechQueue()
      const objectUrls: string[] = []
      let playbackError: string | null = null

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
        } catch (error) {
          playbackError =
            error instanceof Error
              ? error.message
              : "Could not load agent voice. Check ELEVENLABS_API_KEY and voice IDs."
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
          } catch (error) {
            playbackError =
              error instanceof Error
                ? error.message.includes("NotAllowedError") || error.message.includes("user didn't interact")
                  ? "Browser blocked audio — tap a message speaker icon or send a reply to enable voice."
                  : error.message
                : "Audio playback failed. Check your device volume and browser permissions."
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
        if (playbackError && !controller.signal.aborted) {
          reportVoiceError(playbackError)
        }
        if (controller.signal.aborted) {
          session?.reset()
        } else if (conversationActiveRef.current?.current) {
          session?.beginListening()
        } else {
          session?.setPhase("idle")
        }
      }
    },
    [voiceConfigured, voiceEnabled, reportVoiceError],
  )

  const speakEntry = useCallback(
    async (entry: CouncilTranscriptEntry) => {
      if (
        entry.agent === "user" ||
        entry.agent === "system" ||
        !entry.content.trim() ||
        !voiceConfigured ||
        !voiceEnabled
      ) {
        if (!voiceConfigured) {
          reportVoiceError(
            "Spoken replies need ELEVENLABS_API_KEY on the server. Add it in your hosting env and redeploy.",
          )
        }
        return
      }

      unlockCouncilAudio()
      reportVoiceError(null)
      stopPlayback()

      const controller = new AbortController()
      abortRef.current = controller
      setIsSpeaking(true)
      sessionRef.current?.beginSpeaking()

      const objectUrls: string[] = []
      try {
        await playAgentClip(
          entry as CouncilTranscriptEntry & { agent: CouncilAgentId },
          controller,
          objectUrls,
        )
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message.includes("NotAllowedError")
              ? "Browser blocked audio — try again after interacting with the page."
              : error.message
            : "Could not play agent voice."
        reportVoiceError(message)
      } finally {
        for (const url of objectUrls) {
          URL.revokeObjectURL(url)
        }
        if (abortRef.current === controller) {
          abortRef.current = null
        }
        setSpeakingAgent(null)
        setIsSpeaking(false)
        sessionRef.current?.setPhase("idle")
      }
    },
    [playAgentClip, reportVoiceError, stopPlayback, voiceConfigured, voiceEnabled],
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
    speakEntry,
    stopPlayback,
    unlockAudio: unlockCouncilAudio,
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

    void audio.play().catch((error: unknown) => {
      cleanup()
      const name = error instanceof DOMException ? error.name : ""
      if (name === "NotAllowedError") {
        reject(new Error("NotAllowedError: browser blocked autoplay"))
        return
      }
      reject(error instanceof Error ? error : new Error("Could not start audio"))
    })
  })
}
