"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { transcribeCouncilAudio } from "@/lib/council/api-client"
import type { CouncilVoiceSessionController } from "@/lib/council/voice-session"

const SILENCE_THRESHOLD = 0.018
const SILENCE_MS = 1300
const MIN_SPEECH_MS = 700
const MAX_UTTERANCE_MS = 18000
const POLL_MS = 120
const LOCK_POLL_MS = 80

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate))
}

function readAudioLevel(analyser: AnalyserNode, buffer: Uint8Array): number {
  analyser.getByteTimeDomainData(buffer)
  let sum = 0
  for (let index = 0; index < buffer.length; index += 1) {
    const normalized = (buffer[index]! - 128) / 128
    sum += normalized * normalized
  }
  return Math.sqrt(sum / buffer.length)
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      window.clearTimeout(timer)
      resolve()
    }
    signal.addEventListener("abort", onAbort)
  })
}

async function waitUntilMicAllowed(
  session: CouncilVoiceSessionController | null | undefined,
  signal: AbortSignal,
): Promise<boolean> {
  while (!signal.aborted) {
    if (!session || session.isMicAllowed()) return true
    await sleep(LOCK_POLL_MS, signal)
  }
  return false
}

async function waitForSpeechStart(
  analyser: AnalyserNode,
  buffer: Uint8Array,
  signal: AbortSignal,
  session: CouncilVoiceSessionController | null | undefined,
): Promise<boolean> {
  while (!signal.aborted) {
    if (session && !session.isMicAllowed()) return false
    if (readAudioLevel(analyser, buffer) >= SILENCE_THRESHOLD) {
      return true
    }
    await sleep(POLL_MS, signal)
  }
  return false
}

async function recordUtterance(input: {
  stream: MediaStream
  analyser: AnalyserNode
  buffer: Uint8Array
  signal: AbortSignal
  session: CouncilVoiceSessionController | null | undefined
  onRecordingChange: (recording: boolean) => void
}): Promise<Blob | null> {
  const mimeType = pickRecorderMimeType()
  const recorder = mimeType
    ? new MediaRecorder(input.stream, { mimeType })
    : new MediaRecorder(input.stream)

  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  const startedAt = Date.now()
  let speechStartedAt: number | null = null
  let lastSpeechAt = Date.now()

  input.onRecordingChange(true)
  recorder.start(250)

  while (!input.signal.aborted) {
    if (input.session && !input.session.isMicAllowed()) {
      break
    }

    const level = readAudioLevel(input.analyser, input.buffer)
    const now = Date.now()

    if (level >= SILENCE_THRESHOLD) {
      if (speechStartedAt == null) speechStartedAt = now
      lastSpeechAt = now
    }

    const speechDuration = speechStartedAt != null ? now - speechStartedAt : 0
    const silentFor = now - lastSpeechAt

    if (
      speechStartedAt != null &&
      speechDuration >= MIN_SPEECH_MS &&
      silentFor >= SILENCE_MS
    ) {
      break
    }

    if (now - startedAt >= MAX_UTTERANCE_MS) {
      break
    }

    await sleep(POLL_MS, input.signal)
  }

  if (input.signal.aborted || (input.session && !input.session.isMicAllowed())) {
    if (recorder.state !== "inactive") recorder.stop()
    input.onRecordingChange(false)
    return null
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    recorder.onstop = () => {
      input.onRecordingChange(false)
      const recorded = new Blob(chunks, { type: recorder.mimeType || "audio/webm" })
      resolve(recorded.size >= 800 ? recorded : null)
    }
    recorder.stop()
  })

  return blob
}

type UseCouncilVoiceInputOptions = {
  session?: CouncilVoiceSessionController | null
}

export function useCouncilVoiceInput(
  listenConfigured: boolean,
  options?: UseCouncilVoiceInputOptions,
) {
  const [isConversationMode, setIsConversationMode] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [voicePhase, setVoicePhase] = useState(options?.session?.getPhase() ?? "idle")

  const conversationAbortRef = useRef<AbortController | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sessionRef = useRef(options?.session ?? null)

  useEffect(() => {
    sessionRef.current = options?.session ?? null
  }, [options?.session])

  useEffect(() => {
    const session = sessionRef.current
    if (!session) return
    return session.subscribePhase(setVoicePhase)
  }, [options?.session])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    void audioContextRef.current?.close().catch(() => undefined)
    audioContextRef.current = null
  }, [])

  const stopConversation = useCallback(() => {
    conversationAbortRef.current?.abort()
    conversationAbortRef.current = null
    stopStream()
    sessionRef.current?.reset()
    setIsConversationMode(false)
    setIsListening(false)
    setIsRecording(false)
    setIsTranscribing(false)
  }, [stopStream])

  const startConversation = useCallback(
    (onUtterance: (text: string) => Promise<void>) => {
      if (!listenConfigured) {
        setMicError("Voice input needs OPENAI_API_KEY configured on the server.")
        return
      }

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setMicError("Microphone is not supported in this browser.")
        return
      }

      stopConversation()
      setMicError(null)
      setIsConversationMode(true)
      sessionRef.current?.beginListening()

      const controller = new AbortController()
      conversationAbortRef.current = controller

      void (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          if (controller.signal.aborted) {
            stream.getTracks().forEach((track) => track.stop())
            return
          }

          streamRef.current = stream
          const audioContext = new AudioContext()
          audioContextRef.current = audioContext
          const source = audioContext.createMediaStreamSource(stream)
          const analyser = audioContext.createAnalyser()
          analyser.fftSize = 2048
          source.connect(analyser)
          const buffer = new Uint8Array(analyser.fftSize)

          while (!controller.signal.aborted) {
            const micReady = await waitUntilMicAllowed(sessionRef.current, controller.signal)
            if (!micReady || controller.signal.aborted) break

            sessionRef.current?.beginListening()
            setIsListening(true)

            const heardSpeech = await waitForSpeechStart(
              analyser,
              buffer,
              controller.signal,
              sessionRef.current,
            )
            setIsListening(false)

            if (!heardSpeech || controller.signal.aborted) {
              if (sessionRef.current?.isMicAllowed()) {
                await sleep(LOCK_POLL_MS, controller.signal)
              }
              continue
            }

            if (!sessionRef.current?.isMicAllowed()) continue

            const blob = await recordUtterance({
              stream,
              analyser,
              buffer,
              signal: controller.signal,
              session: sessionRef.current,
              onRecordingChange: setIsRecording,
            })

            if (controller.signal.aborted) break
            if (!blob) continue

            sessionRef.current?.beginThinking()
            setIsTranscribing(true)
            try {
              const text = (await transcribeCouncilAudio(blob)).trim()
              if (text) {
                await onUtterance(text)
                await sessionRef.current?.waitForTurnComplete(controller.signal)
                sessionRef.current?.beginListening()
              } else {
                sessionRef.current?.beginListening()
              }
            } catch (error) {
              setMicError(error instanceof Error ? error.message : "Could not transcribe audio")
              sessionRef.current?.beginListening()
              await sleep(1200, controller.signal)
            } finally {
              setIsTranscribing(false)
            }
          }
        } catch {
          if (!controller.signal.aborted) {
            setMicError("Microphone access denied. Allow mic access in browser settings.")
          }
        } finally {
          if (conversationAbortRef.current === controller) {
            conversationAbortRef.current = null
          }
          stopStream()
          setIsConversationMode(false)
          setIsListening(false)
          setIsRecording(false)
          setIsTranscribing(false)
          sessionRef.current?.reset()
        }
      })()
    },
    [listenConfigured, stopConversation, stopStream],
  )

  useEffect(() => {
    return () => {
      stopConversation()
    }
  }, [stopConversation])

  return {
    isConversationMode,
    isListening,
    isRecording,
    isTranscribing,
    micError,
    voicePhase,
    startConversation,
    stopConversation,
    clearMicError: () => setMicError(null),
  }
}
