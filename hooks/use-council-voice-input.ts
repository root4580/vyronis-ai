"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { transcribeCouncilAudio } from "@/lib/council/api-client"

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate))
}

export function useCouncilVoiceInput(listenConfigured: boolean) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null
      recorder.stop()
    }
    mediaRecorderRef.current = null
    chunksRef.current = []
    stopStream()
    setIsRecording(false)
  }, [stopStream])

  const startRecording = useCallback(async () => {
    if (!listenConfigured) {
      setMicError("Voice input needs OPENAI_API_KEY configured on the server.")
      return
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicError("Microphone is not supported in this browser.")
      return
    }

    setMicError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickRecorderMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch {
      setMicError("Microphone access denied. Allow mic access in browser settings.")
    }
  }, [listenConfigured])

  const stopAndTranscribe = useCallback(async (): Promise<string | null> => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === "inactive") {
      setIsRecording(false)
      stopStream()
      return null
    }

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        setIsRecording(false)
        stopStream()
        mediaRecorderRef.current = null

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        })
        chunksRef.current = []

        if (blob.size < 800) {
          setMicError("Didn't catch that — try speaking a bit longer.")
          resolve(null)
          return
        }

        setIsTranscribing(true)
        setMicError(null)
        try {
          const text = await transcribeCouncilAudio(blob)
          resolve(text.trim() || null)
        } catch (error) {
          setMicError(error instanceof Error ? error.message : "Could not transcribe audio")
          resolve(null)
        } finally {
          setIsTranscribing(false)
        }
      }

      recorder.stop()
    })
  }, [stopStream])

  const toggleRecording = useCallback(async (): Promise<string | null> => {
    if (isTranscribing) return null
    if (isRecording) {
      return stopAndTranscribe()
    }
    await startRecording()
    return null
  }, [isRecording, isTranscribing, startRecording, stopAndTranscribe])

  useEffect(() => {
    return () => {
      cancelRecording()
    }
  }, [cancelRecording])

  return {
    isRecording,
    isTranscribing,
    micError,
    toggleRecording,
    cancelRecording,
    clearMicError: () => setMicError(null),
  }
}
