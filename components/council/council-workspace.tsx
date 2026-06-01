"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Mic, Send, Sparkles, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { COUNCIL_AGENTS, getCouncilAgent } from "@/lib/council/agents"
import {
  askCouncil,
  fetchCouncilSession,
  runCouncilBriefing,
} from "@/lib/council/api-client"
import type { CouncilAgentId, CouncilTranscriptEntry } from "@/lib/council/types"
import { cn } from "@/lib/utils"
import { useCouncilVoicePlayback } from "@/hooks/use-council-voice-playback"
import { useCouncilVoiceInput } from "@/hooks/use-council-voice-input"

type CouncilWorkspaceProps = {
  accountId: string | null
  traderFirstName?: string | null
}

function speakerLabel(entry: CouncilTranscriptEntry): string {
  if (entry.agent === "user") return "You"
  if (entry.agent === "system") return "Council"
  return getCouncilAgent(entry.agent).name
}

function isAgentEntry(entry: CouncilTranscriptEntry): entry is CouncilTranscriptEntry & {
  agent: CouncilAgentId
} {
  return entry.agent !== "user" && entry.agent !== "system"
}

export function CouncilWorkspace({ accountId, traderFirstName }: CouncilWorkspaceProps) {
  const [transcript, setTranscript] = useState<CouncilTranscriptEntry[]>([])
  const [activeAgent, setActiveAgent] = useState<CouncilAgentId | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<CouncilAgentId | "auto">("auto")
  const [question, setQuestion] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isBriefing, setIsBriefing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [migrationPending, setMigrationPending] = useState(false)
  const [briefingDone, setBriefingDone] = useState(false)
  const [isMorningWindow, setIsMorningWindow] = useState(false)
  const [voiceConfigured, setVoiceConfigured] = useState(false)
  const [listenConfigured, setListenConfigured] = useState(false)
  const autoBriefingAttempted = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const {
    voiceEnabled,
    setVoiceEnabled,
    voiceAvailable,
    speakingAgent,
    isSpeaking,
    speakEntries,
    stopPlayback,
  } = useCouncilVoicePlayback(voiceConfigured)

  const {
    isRecording,
    isTranscribing,
    micError,
    toggleRecording,
    clearMicError,
  } = useCouncilVoiceInput(listenConfigured)

  const greetingName = traderFirstName?.trim() || "Trader"

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  const loadSession = useCallback(async () => {
    if (!accountId) {
      setTranscript([])
      setIsLoading(false)
      setError("Select an account to open the council.")
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const state = await fetchCouncilSession(accountId)
      setMigrationPending(Boolean(state.migrationPending))
      setIsMorningWindow(state.isMorningWindow)
      setVoiceConfigured(Boolean(state.voiceConfigured))
      setListenConfigured(Boolean(state.listenConfigured))
      setTranscript(state.session?.full_transcript ?? [])
      setBriefingDone(Boolean(state.session?.briefing_completed))
      if (state.migrationPending) {
        setError("Run supabase/RUN-COUNCIL.sql in Supabase to enable the AI Council.")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load council")
    } finally {
      setIsLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  const handleBriefing = useCallback(
    async (force = false) => {
      if (!accountId || migrationPending) return
      stopPlayback()
      setIsBriefing(true)
      setError(null)
      try {
        const result = await runCouncilBriefing({ accountId, force })
        setTranscript((current) => {
          const ids = new Set(current.map((entry) => entry.id))
          const merged = [...current]
          for (const message of result.messages) {
            if (!ids.has(message.id)) merged.push(message)
          }
          return merged
        })
        setBriefingDone(true)
        if (result.messages.length > 0) {
          const lastMessage = result.messages[result.messages.length - 1]!
          if (isAgentEntry(lastMessage)) {
            setActiveAgent(lastMessage.agent)
          }
          void speakEntries(result.messages)
        }
        scrollToBottom()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Briefing failed")
      } finally {
        setIsBriefing(false)
      }
    },
    [accountId, migrationPending, scrollToBottom, speakEntries, stopPlayback],
  )

  useEffect(() => {
    if (
      !accountId ||
      migrationPending ||
      isLoading ||
      isBriefing ||
      briefingDone ||
      !isMorningWindow ||
      autoBriefingAttempted.current
    ) {
      return
    }
    autoBriefingAttempted.current = true
    void handleBriefing(false)
  }, [
    accountId,
    migrationPending,
    isLoading,
    isBriefing,
    briefingDone,
    isMorningWindow,
    handleBriefing,
  ])

  useEffect(() => {
    scrollToBottom()
  }, [transcript, scrollToBottom])

  const submitQuestion = useCallback(
    async (message: string) => {
      const trimmed = message.trim()
      if (!trimmed || !accountId || isSending || migrationPending) return

      stopPlayback()
      setIsSending(true)
      setError(null)
      clearMicError()

      const userEntry: CouncilTranscriptEntry = {
        id: `local-${Date.now()}`,
        agent: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      }
      setTranscript((current) => [...current, userEntry])

      try {
        const result = await askCouncil({
          accountId,
          message: trimmed,
          agent: selectedAgent === "auto" ? undefined : selectedAgent,
        })
        setActiveAgent(result.agent)
        setTranscript((current) => [...current, result.message])
        void speakEntries([result.message])
        scrollToBottom()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not reach the council")
      } finally {
        setIsSending(false)
      }
    },
    [
      accountId,
      isSending,
      migrationPending,
      selectedAgent,
      speakEntries,
      stopPlayback,
      scrollToBottom,
      clearMicError,
    ],
  )

  async function handleAsk(event?: React.FormEvent) {
    event?.preventDefault()
    const trimmed = question.trim()
    if (!trimmed) return
    setQuestion("")
    await submitQuestion(trimmed)
  }

  async function handleMicToggle() {
    if (isSending || isSpeaking || isTranscribing || migrationPending) return

    if (isRecording) {
      const text = await toggleRecording()
      if (text) {
        setQuestion("")
        await submitQuestion(text)
      }
      return
    }

    stopPlayback()
    await toggleRecording()
  }

  const headerLine = listenConfigured
    ? voiceAvailable && voiceEnabled
      ? "Speak or type — agents listen and reply by voice"
      : voiceAvailable
        ? "Mic ready — voice replies off, transcript only"
        : "Mic ready — add ELEVENLABS_API_KEY for spoken replies"
    : voiceAvailable && voiceEnabled
      ? "Council is ready — agents will speak their briefing"
      : voiceAvailable
        ? "Voice off — read the transcript below"
        : "Council is ready — add OPENAI + ElevenLabs keys for full voice"

  if (isLoading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-cyan-glow/80" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-44 md:pb-28">
      <header className="hq-surface-card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] bg-violet-500/[0.06] px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200/80">
                AI Trading Council
              </p>
              <h1 className="text-[20px] font-medium text-text-primary">
                Good morning, {greetingName}
              </h1>
              <p className="mt-1 text-[12px] text-text-muted">{headerLine}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {voiceAvailable ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-10"
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  disabled={isSpeaking}
                >
                  {voiceEnabled ? (
                    <Volume2 className="mr-2 size-4 text-cyan-glow" />
                  ) : (
                    <VolumeX className="mr-2 size-4" />
                  )}
                  {voiceEnabled ? "Voice on" : "Voice off"}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                className="min-h-10 bg-violet-600 text-white hover:bg-violet-500"
                disabled={isBriefing || migrationPending || !accountId || isSpeaking}
                onClick={() => void handleBriefing(true)}
              >
                {isBriefing ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 size-4" />
                )}
                {briefingDone ? "Replay briefing" : "Start briefing"}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto px-2 py-2">
          {COUNCIL_AGENTS.map((agent) => {
            const isSpeakingAgent = speakingAgent === agent.id
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => setSelectedAgent(agent.id)}
                className={cn(
                  "shrink-0 rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors",
                  agent.accentClass,
                  selectedAgent === agent.id && "ring-1 ring-white/20",
                  activeAgent === agent.id && "ring-2 ring-cyan-glow/40",
                  isSpeakingAgent && "animate-pulse ring-2 ring-cyan-glow/60",
                )}
              >
                <p className="text-[12px] font-semibold">{agent.name}</p>
                <p className="text-[10px] opacity-80">
                  {isSpeakingAgent ? "Speaking…" : agent.role}
                </p>
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setSelectedAgent("auto")}
            className={cn(
              "shrink-0 rounded-[var(--radius-md)] border border-white/[0.08] px-3 py-2 text-left",
              selectedAgent === "auto" && "bg-white/[0.06] ring-1 ring-white/15",
            )}
          >
            <p className="text-[12px] font-semibold text-text-primary">Auto</p>
            <p className="text-[10px] text-text-muted">Route question</p>
          </button>
        </div>
      </header>

      {error || micError ? (
        <div className="rounded-[var(--radius-md)] border border-loss/25 bg-loss/[0.08] px-4 py-3 text-[12px] text-loss">
          {error || micError}
        </div>
      ) : null}

      {isRecording ? (
        <div className="rounded-[var(--radius-md)] border border-cyan-glow/25 bg-cyan-glow/[0.08] px-4 py-3 text-center text-[12px] text-cyan-glow">
          Listening… tap the mic again when you are done.
        </div>
      ) : null}

      <section className="hq-surface-card min-h-[320px] px-4 py-4">
        {transcript.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
            <p className="text-[13px] text-text-secondary">
              Your council is standing by.
            </p>
            <p className="mt-1 max-w-sm text-[11px] text-text-muted">
              Before noon, briefing starts automatically once. Or tap Start briefing anytime.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transcript.map((entry) => {
              const isUser = entry.agent === "user"
              const agent =
                entry.agent !== "user" && entry.agent !== "system"
                  ? getCouncilAgent(entry.agent)
                  : null
              const isSpeakingLine = speakingAgent === entry.agent
              return (
                <article
                  key={entry.id}
                  className={cn(
                    "rounded-[var(--radius-md)] border px-3 py-2.5 transition-shadow",
                    isUser
                      ? "ml-8 border-cyan-glow/20 bg-cyan-glow/[0.06]"
                      : agent
                        ? agent.accentClass
                        : "border-white/[0.08] bg-white/[0.02]",
                    isSpeakingLine && "shadow-[0_0_20px_rgba(34,211,238,0.15)]",
                  )}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-80">
                    {speakerLabel(entry)}
                    {isSpeakingLine ? " · speaking" : ""}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-text-primary">
                    {entry.content}
                  </p>
                </article>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </section>

      <form
        onSubmit={(event) => void handleAsk(event)}
        className="hq-surface-card fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-30 border-t border-white/[0.06] bg-[var(--surface-page)]/95 p-4 backdrop-blur-md md:static md:bottom-auto md:rounded-[var(--radius-md)] md:border md:bg-[var(--surface-card)]"
      >
        <div className="mx-auto flex max-w-3xl gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={
              !listenConfigured ||
              migrationPending ||
              isSpeaking ||
              isSending ||
              isTranscribing
            }
            className={cn(
              "size-11 shrink-0",
              isRecording && "border-loss/40 bg-loss/10 text-loss",
            )}
            title={
              listenConfigured
                ? isRecording
                  ? "Stop and send"
                  : "Ask by voice"
                : "Voice input needs OPENAI_API_KEY"
            }
            onClick={() => void handleMicToggle()}
          >
            {isTranscribing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Mic className={cn("size-4", isRecording && "animate-pulse")} />
            )}
          </Button>
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask the council anything…"
            className="min-h-11 flex-1 resize-none text-[13px]"
            rows={1}
            disabled={isSpeaking || isRecording || isTranscribing}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void handleAsk()
              }
            }}
          />
          <Button
            type="submit"
            className="size-11 shrink-0 bg-cyan-glow text-[var(--surface-page)] hover:bg-cyan-glow/90"
            disabled={isSending || !question.trim() || migrationPending || isSpeaking || isRecording || isTranscribing}
          >
            {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-text-muted">
          {listenConfigured
            ? "Tap mic to speak · agents reply by voice when ElevenLabs is configured"
            : "Mic needs OPENAI_API_KEY · spoken replies need ELEVENLABS_API_KEY"}
        </p>
      </form>
    </div>
  )
}
