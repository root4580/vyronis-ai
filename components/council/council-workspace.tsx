"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Brain, Crown, Loader2, Mic, RotateCcw, Send, Sparkles, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { COUNCIL_AGENTS, getCouncilAgent } from "@/lib/council/agents"
import {
  askCouncil,
  clearCouncilSession,
  fetchCouncilSession,
  fetchCouncilVisualContext,
  runCouncilBriefing,
  runCouncilOpen,
  fetchCouncilVoiceCheck,
} from "@/lib/council/api-client"
import { findChartForMessage } from "@/lib/council/pair-chart-match"
import { readFreshChatOnOpen } from "@/lib/council/fresh-chat-preference"
import {
  readFullCouncilParticipation,
} from "@/lib/council/full-council-preference"
import type {
  CouncilAgentId,
  CouncilMemoryHighlight,
  CouncilSettingsRecord,
  CouncilTranscriptEntry,
  CouncilVisualContext,
} from "@/lib/council/types"
import {
  detectCouncilAgentByName,
  isCouncilDelegationRequest,
  resolveCouncilAffirmativeHandoff,
  resolveCouncilPronounTarget,
} from "@/lib/council/router"
import { cn } from "@/lib/utils"
import { useCouncilVoiceSession } from "@/hooks/use-council-voice-session"
import { CouncilBriefingContext } from "@/components/council/council-briefing-context"
import { CouncilInlineStatsCard } from "@/components/council/council-inline-stats-card"
import { CouncilLiveStatsStrip } from "@/components/council/council-live-stats-strip"
import { CouncilHistoryPanel } from "@/components/council/council-history-panel"
import { CouncilMessageBubble } from "@/components/council/council-message-bubble"
import { CouncilSettingsPanel } from "@/components/council/council-settings-panel"
import { CouncilSpeakingWave } from "@/components/council/council-speaking-wave"
import { ScreenshotViewerModal } from "@/components/dashboard/screenshot-viewer-modal"

type CouncilWorkspaceProps = {
  accountId: string | null
  traderFirstName?: string | null
}

function isAgentEntry(entry: CouncilTranscriptEntry): entry is CouncilTranscriptEntry & {
  agent: CouncilAgentId
} {
  return entry.agent !== "user" && entry.agent !== "system"
}

export function CouncilWorkspace({ accountId, traderFirstName }: CouncilWorkspaceProps) {
  const [transcript, setTranscript] = useState<CouncilTranscriptEntry[]>([])
  const [activeAgent, setActiveAgent] = useState<CouncilAgentId | null>(null)
  const [conversationAgent, setConversationAgent] = useState<CouncilAgentId | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<CouncilAgentId | "auto">("auto")
  const [question, setQuestion] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isContextLoading, setIsContextLoading] = useState(false)
  const [isBriefing, setIsBriefing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [migrationPending, setMigrationPending] = useState(false)
  const [briefingDone, setBriefingDone] = useState(false)
  const [isMorningWindow, setIsMorningWindow] = useState(false)
  const [voiceConfigured, setVoiceConfigured] = useState(false)
  const [listenConfigured, setListenConfigured] = useState(false)
  const [visualContext, setVisualContext] = useState<CouncilVisualContext | null>(null)
  const [keyInsights, setKeyInsights] = useState<string[]>([])
  const [memoryHighlights, setMemoryHighlights] = useState<CouncilMemoryHighlight[]>([])
  const [councilSettings, setCouncilSettings] = useState<CouncilSettingsRecord | null>(null)
  const [freshChatOnOpen, setFreshChatOnOpen] = useState(true)
  const [fullCouncilParticipation, setFullCouncilParticipation] = useState(true)
  const [chartViewer, setChartViewer] = useState<{ url: string; title: string } | null>(null)
  const autoBriefingAttempted = useRef(false)
  const openRitualAttempted = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const conversationAgentRef = useRef<CouncilAgentId | null>(null)
  const selectedAgentRef = useRef<CouncilAgentId | "auto">("auto")
  const submitQuestionRef = useRef<(message: string) => Promise<void>>(async () => {})
  const transcriptRef = useRef<CouncilTranscriptEntry[]>([])

  const {
    voiceEnabled,
    setVoiceEnabled,
    volume,
    setVolume,
    voiceAvailable,
    speakingAgent,
    isSpeaking,
    speakEntries,
    speakEntry,
    stopPlayback,
    unlockAudio,
    session: voiceSession,
    isConversationMode,
    isListening,
    isRecording,
    isTranscribing,
    micError,
    voicePhase,
    startConversation,
    stopConversation,
    clearMicError,
  } = useCouncilVoiceSession(voiceConfigured, listenConfigured, {
    onVoiceError: setVoiceError,
  })

  useEffect(() => {
    conversationAgentRef.current = conversationAgent
  }, [conversationAgent])

  useEffect(() => {
    selectedAgentRef.current = selectedAgent
  }, [selectedAgent])

  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  const greetingName = traderFirstName?.trim() || "Trader"

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    setFreshChatOnOpen(readFreshChatOnOpen())
    setFullCouncilParticipation(readFullCouncilParticipation())
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
      if (state.voiceConfigured) {
        void fetchCouncilVoiceCheck()
          .then((check) => {
            if (!check.ok) {
              setVoiceConfigured(false)
              setVoiceError(
                check.error ??
                  "Voice check failed on the server. Confirm ELEVENLABS_API_KEY in Vercel Production and redeploy.",
              )
            }
          })
          .catch(() => undefined)
      } else {
        setVoiceError(
          "Spoken replies need ELEVENLABS_API_KEY on the server (Vercel → Environment Variables → Production). Redeploy after saving.",
        )
      }
      setVisualContext(state.visual ?? null)
      setKeyInsights(state.keyInsights ?? state.session?.key_insights ?? [])
      setMemoryHighlights(state.memoryHighlights ?? [])
      setCouncilSettings(state.settings ?? null)
      const useFreshChat = readFreshChatOnOpen()
      setFreshChatOnOpen(useFreshChat)
      setTranscript(useFreshChat ? [] : (state.session?.full_transcript ?? []))
      setBriefingDone(Boolean(state.session?.briefing_completed))
      const stickyAgent = state.conversationAgent ?? null
      if (stickyAgent) {
        setConversationAgent(stickyAgent)
        conversationAgentRef.current = stickyAgent
        setActiveAgent(stickyAgent)
        setSelectedAgent(stickyAgent)
        selectedAgentRef.current = stickyAgent
      } else {
        setConversationAgent(null)
        conversationAgentRef.current = null
        setActiveAgent(null)
        setSelectedAgent("auto")
        selectedAgentRef.current = "auto"
      }
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

  useEffect(() => {
    if (!accountId || migrationPending || isLoading) return

    let cancelled = false
    setIsContextLoading(true)

    void fetchCouncilVisualContext(accountId, { refresh: true })
      .then((payload) => {
        if (!cancelled) setVisualContext(payload.visual ?? null)
      })
      .catch(() => {
        if (!cancelled) setVisualContext(null)
      })
      .finally(() => {
        if (!cancelled) setIsContextLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accountId, migrationPending, isLoading])

  const handleBriefing = useCallback(
    async (force = false) => {
      if (!accountId || migrationPending) return
      unlockAudio()
      stopConversation()
      stopPlayback()
      setIsBriefing(true)
      setActiveAgent("jarvis")
      setError(null)
      try {
        const result = await runCouncilBriefing({ accountId, force })
        const showBriefingInUi = !freshChatOnOpen || force
        if (showBriefingInUi) {
          setTranscript((current) => {
            const ids = new Set(current.map((entry) => entry.id))
            const merged = [...current]
            for (const message of result.messages) {
              if (!ids.has(message.id)) merged.push(message)
            }
            return merged
          })
        }
        setBriefingDone(true)
        if (result.keyInsights?.length) {
          setKeyInsights(result.keyInsights)
        }
        if (result.messages.length > 0) {
          const lastMessage = result.messages[result.messages.length - 1]!
          if (isAgentEntry(lastMessage)) {
            setActiveAgent(lastMessage.agent)
          }
          if (voiceEnabled) {
            void speakEntries(result.messages)
          }
        }
        if (showBriefingInUi) {
          scrollToBottom()
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Briefing failed")
      } finally {
        setIsBriefing(false)
      }
    },
    [accountId, migrationPending, freshChatOnOpen, scrollToBottom, speakEntries, stopPlayback, stopConversation, unlockAudio, voiceEnabled],
  )

  useEffect(() => {
    const autoBriefingEnabled = councilSettings?.auto_briefing_enabled !== false
    const manualOnly = councilSettings?.briefing_time === "manual"
    const willAutoBrief =
      isMorningWindow && autoBriefingEnabled && !manualOnly && !briefingDone

    if (
      !accountId ||
      migrationPending ||
      isLoading ||
      isBriefing ||
      openRitualAttempted.current ||
      willAutoBrief
    ) {
      return
    }

    openRitualAttempted.current = true
    void runCouncilOpen({ accountId })
      .then((result) => {
        if (result.messages.length === 0) return
        setTranscript((current) => {
          if (current.length > 0) return current
          return result.messages
        })
        setActiveAgent("nova")
        if (voiceEnabled) {
          void speakEntries(result.messages)
        }
        scrollToBottom()
      })
      .catch(() => undefined)
  }, [
    accountId,
    migrationPending,
    isLoading,
    isBriefing,
    scrollToBottom,
    speakEntries,
    voiceEnabled,
    isMorningWindow,
    councilSettings?.auto_briefing_enabled,
    councilSettings?.briefing_time,
    briefingDone,
  ])

  useEffect(() => {
    const autoBriefingEnabled = councilSettings?.auto_briefing_enabled !== false
    const manualOnly = councilSettings?.briefing_time === "manual"

    if (
      !accountId ||
      migrationPending ||
      isLoading ||
      isBriefing ||
      briefingDone ||
      !isMorningWindow ||
      !autoBriefingEnabled ||
      manualOnly ||
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
    councilSettings?.auto_briefing_enabled,
    councilSettings?.briefing_time,
    handleBriefing,
  ])

  useEffect(() => {
    scrollToBottom()
  }, [transcript, scrollToBottom])

  const transcriptRows = useMemo(() => {
    const shownChartUrls = new Set<string>()
    return transcript.map((entry) => {
      let inlineChart = null
      if (entry.agent !== "user" && entry.agent !== "system") {
        const chart = findChartForMessage(entry.agent, entry.content, visualContext)
        if (chart && !shownChartUrls.has(chart.url)) {
          shownChartUrls.add(chart.url)
          inlineChart = chart
        }
      }
      return { entry, inlineChart }
    })
  }, [transcript, visualContext])

  const handleClearScreen = useCallback(() => {
    stopConversation()
    stopPlayback()
    setTranscript([])
    setError(null)
  }, [stopConversation, stopPlayback])

  const handleClearConversation = useCallback(async () => {
    if (!accountId || migrationPending || isClearing) return
    stopConversation()
    stopPlayback()
    setIsClearing(true)
    setError(null)
    try {
      const state = await clearCouncilSession(accountId)
      setTranscript([])
      setBriefingDone(false)
      setKeyInsights(state.keyInsights ?? state.session?.key_insights ?? [])
      setConversationAgent(null)
      conversationAgentRef.current = null
      setActiveAgent(null)
      setSelectedAgent("auto")
      selectedAgentRef.current = "auto"
      autoBriefingAttempted.current = false
      openRitualAttempted.current = false
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear conversation")
    } finally {
      setIsClearing(false)
    }
  }, [accountId, migrationPending, isClearing, stopConversation, stopPlayback])

  const submitQuestion = useCallback(
    async (message: string) => {
      const trimmed = message.trim()
      if (!trimmed || !accountId || isSending || migrationPending) return

      unlockAudio()
      stopPlayback()
      setIsSending(true)
      voiceSession.beginThinking()
      setError(null)
      clearMicError()

      const namedAgent = detectCouncilAgentByName(trimmed)
      const delegating = isCouncilDelegationRequest(trimmed)
      const pronounTarget = resolveCouncilPronounTarget(trimmed, transcriptRef.current)
      const affirmativeTarget = resolveCouncilAffirmativeHandoff(trimmed, transcriptRef.current)
      const manualAgent =
        selectedAgentRef.current === "auto" ? null : selectedAgentRef.current
      const activeConversation = conversationAgentRef.current
      const directSwitch = namedAgent && !delegating && !pronounTarget && !affirmativeTarget
      const targetAgent =
        delegating || pronounTarget || affirmativeTarget
          ? activeConversation ?? manualAgent ?? undefined
          : namedAgent ?? manualAgent ?? activeConversation ?? undefined

      if (directSwitch) {
        setConversationAgent(namedAgent)
        conversationAgentRef.current = namedAgent
        setSelectedAgent(namedAgent)
        selectedAgentRef.current = namedAgent
        setActiveAgent(namedAgent)
      }

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
          agent: targetAgent,
          conversationAgent: activeConversation ?? undefined,
          fullCouncilParticipation,
        })
        if (!result.roundtable) {
          if (selectedAgentRef.current !== "auto") {
            setConversationAgent(result.agent)
            conversationAgentRef.current = result.agent
            setSelectedAgent(result.agent)
            selectedAgentRef.current = result.agent
          }
          setActiveAgent(result.agent)
        } else {
          setActiveAgent(null)
          if (selectedAgentRef.current === "auto") {
            setConversationAgent(null)
            conversationAgentRef.current = null
          }
        }
        const agentMessages =
          result.messages.length > 0 ? result.messages : [result.message]
        setTranscript((current) => [...current, ...agentMessages])
        await speakEntries(agentMessages)
        scrollToBottom()
        void fetchCouncilVisualContext(accountId, { refresh: true })
          .then((payload) => setVisualContext(payload.visual ?? null))
          .catch(() => undefined)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not reach the council")
        if (isConversationMode) {
          voiceSession.beginListening()
        } else {
          voiceSession.reset()
        }
      } finally {
        setIsSending(false)
      }
    },
    [
      accountId,
      isSending,
      migrationPending,
      speakEntries,
      stopPlayback,
      scrollToBottom,
      clearMicError,
      unlockAudio,
      voiceSession,
      isConversationMode,
      fullCouncilParticipation,
    ],
  )

  useEffect(() => {
    submitQuestionRef.current = submitQuestion
  }, [submitQuestion])

  const handleTestVoice = useCallback(async () => {
    unlockAudio()
    setVoiceError(null)
    stopPlayback()
    await speakEntry({
      id: `voice-test-${Date.now()}`,
      agent: "marcus",
      content: `${greetingName}, this is a council voice test.`,
      createdAt: new Date().toISOString(),
    })
  }, [greetingName, speakEntry, stopPlayback, unlockAudio])

  async function handleAsk(event?: React.FormEvent) {
    event?.preventDefault()
    const trimmed = question.trim()
    if (!trimmed) return
    setQuestion("")
    await submitQuestion(trimmed)
  }

  function handleMicToggle() {
    if (migrationPending || !listenConfigured) return
    unlockAudio()

    if (isConversationMode) {
      stopConversation()
      return
    }

    stopPlayback()
    startConversation(async (text) => {
      await submitQuestionRef.current(text)
    })
  }

  const headerLine = isConversationMode
    ? conversationAgent
      ? `Talking with ${getCouncilAgent(conversationAgent).name} — say another name to switch`
      : "Open conversation — speak naturally, tap mic when you are done"
    : conversationAgent
      ? `Continuing with ${getCouncilAgent(conversationAgent).name} — name someone else to switch`
      : listenConfigured
      ? voiceAvailable && voiceEnabled
        ? "Tap mic for open conversation — speak, pause, agents reply"
        : voiceAvailable
          ? "Tap mic to talk — voice replies off, transcript only"
          : "Tap mic to talk — add ELEVENLABS_API_KEY for spoken replies"
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
                variant="outline"
                size="sm"
                className="min-h-10"
                disabled={isSpeaking || migrationPending}
                onClick={() => void handleTestVoice()}
              >
                {isSpeaking ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Volume2 className="mr-2 size-4" />
                )}
                Test voice
              </Button>
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
          {COUNCIL_AGENTS.filter((agent) => !agent.isPsychologist).map((agent) => {
            const isSpeakingAgent = speakingAgent === agent.id
            const isThinkingAgent =
              isSending &&
              (conversationAgent === agent.id ||
                activeAgent === agent.id ||
                (agent.id === "jarvis" && voicePhase === "thinking"))
            const isJarvis = agent.isCoordinator === true
            const jarvisHighlighted =
              isJarvis && (isBriefing || isSpeakingAgent || activeAgent === "jarvis")
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  setSelectedAgent(agent.id)
                  selectedAgentRef.current = agent.id
                  setConversationAgent(agent.id)
                  conversationAgentRef.current = agent.id
                  setActiveAgent(agent.id)
                }}
                className={cn(
                  "shrink-0 rounded-[var(--radius-md)] border text-left transition-colors",
                  isJarvis ? "min-w-[132px] px-4 py-3" : "px-3 py-2",
                  agent.accentClass,
                  selectedAgent === agent.id && "ring-1 ring-white/20",
                  activeAgent === agent.id && "ring-2 ring-cyan-glow/40",
                  isSpeakingAgent && "ring-2 ring-cyan-glow/60 shadow-[0_0_18px_rgba(34,211,238,0.18)]",
                  isThinkingAgent && "council-agent-thinking ring-2 ring-violet-400/35",
                  jarvisHighlighted && "ring-2 ring-slate-300/50 shadow-[0_0_28px_rgba(148,163,184,0.25)]",
                )}
              >
                <div className="flex items-center gap-1.5">
                  {isJarvis ? <Crown className="size-3.5 shrink-0 text-slate-300" /> : null}
                  <p className={cn("font-semibold", isJarvis ? "text-[13px]" : "text-[12px]")}>
                    {agent.name}
                  </p>
                  {isSpeakingAgent ? <CouncilSpeakingWave className="ml-auto" bars={4} /> : null}
                </div>
                <p className="text-[10px] opacity-80">
                  {isSpeakingAgent ? "Speaking…" : isThinkingAgent ? "Thinking…" : agent.role}
                </p>
              </button>
            )
          })}
          <div className="mx-0.5 w-px shrink-0 self-stretch bg-purple-900/40" aria-hidden />
          {COUNCIL_AGENTS.filter((agent) => agent.isPsychologist).map((agent) => {
            const isSpeakingAgent = speakingAgent === agent.id
            const isThinkingAgent =
              isSending &&
              (conversationAgent === agent.id ||
                activeAgent === agent.id ||
                (agent.id === "jarvis" && voicePhase === "thinking"))
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  setSelectedAgent(agent.id)
                  selectedAgentRef.current = agent.id
                  setConversationAgent(agent.id)
                  conversationAgentRef.current = agent.id
                  setActiveAgent(agent.id)
                }}
                className={cn(
                  "shrink-0 min-w-[148px] rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors",
                  agent.accentClass,
                  selectedAgent === agent.id && "ring-1 ring-purple-300/25",
                  activeAgent === agent.id && "ring-2 ring-purple-400/45",
                  isSpeakingAgent &&
                    "ring-2 ring-purple-400/60 shadow-[0_0_22px_rgba(168,85,247,0.28)]",
                  isThinkingAgent && "council-agent-thinking ring-2 ring-purple-400/35",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Brain className="size-3.5 shrink-0 text-purple-200/90" />
                  <p className="text-[12px] font-semibold">{agent.name}</p>
                  {isSpeakingAgent ? <CouncilSpeakingWave className="ml-auto" bars={4} /> : null}
                </div>
                <p className="text-[10px] opacity-80">
                  {isSpeakingAgent ? "Speaking…" : isThinkingAgent ? "Thinking…" : agent.role}
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

        {isSpeaking && speakingAgent ? (
          <div className="border-t border-cyan-glow/15 bg-cyan-glow/[0.05] px-4 py-2">
            <div className="flex items-center justify-center gap-2">
              <CouncilSpeakingWave />
              <p className="text-[11px] font-medium text-cyan-glow">
                {getCouncilAgent(speakingAgent).name} speaking…
              </p>
            </div>
          </div>
        ) : null}
      </header>

      {voiceAvailable ? (
        <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] right-3 z-40 flex items-center gap-2 rounded-full border border-white/[0.08] bg-[var(--surface-page)]/95 px-3 py-2 shadow-lg backdrop-blur-md md:bottom-6">
          <Volume2 className="size-3.5 shrink-0 text-text-muted" />
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(event) => setVolume(Number(event.target.value) / 100)}
            aria-label="Council voice volume"
            className="h-1.5 w-24 cursor-pointer accent-cyan-400"
          />
        </div>
      ) : null}

      {error || micError || voiceError ? (
        <div className="rounded-[var(--radius-md)] border border-loss/25 bg-loss/[0.08] px-4 py-3 text-[12px] text-loss">
          {error || micError || voiceError}
        </div>
      ) : null}

      {!voiceAvailable && !isLoading ? (
        <div className="rounded-[var(--radius-md)] border border-amber-400/25 bg-amber-500/[0.08] px-4 py-3 text-[12px] text-amber-100/90">
          Voice is off until <code className="text-[11px]">ELEVENLABS_API_KEY</code> is set on the server
          (Vercel/hosting env) and the app is redeployed. Text replies work now — tap the speaker icon on any
          agent message once voice is enabled.
        </div>
      ) : null}

      {isConversationMode ? (
        <div className="rounded-[var(--radius-md)] border border-cyan-glow/25 bg-cyan-glow/[0.08] px-4 py-3 text-center text-[12px] text-cyan-glow">
          {voicePhase === "speaking" || isSpeaking
            ? `${speakingAgent ? getCouncilAgent(speakingAgent).name : "Council"} speaking — mic paused to prevent echo.`
            : voicePhase === "thinking" || isTranscribing || isSending
              ? "Council thinking… mic paused."
              : isRecording
                ? "Hearing you… pause when finished and I'll send it."
                : voicePhase === "listening" || isListening
                  ? "Listening — speak whenever you're ready."
                  : "Conversation on — tap mic to stop."}
        </div>
      ) : null}

      <CouncilBriefingContext
        visual={visualContext}
        insights={keyInsights}
        memoryHighlights={memoryHighlights}
        transcriptLength={transcript.length}
        isLoading={isContextLoading}
        onChartClick={(url, title) => setChartViewer({ url, title })}
      />

      <CouncilSettingsPanel
        settings={councilSettings}
        onSettingsChange={setCouncilSettings}
        onFreshChatChange={setFreshChatOnOpen}
        onFullCouncilChange={setFullCouncilParticipation}
      />
      <CouncilHistoryPanel accountId={accountId} />

      <CouncilLiveStatsStrip
        visual={visualContext}
        loading={isContextLoading}
        className="sticky top-0 z-20 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md"
      />

      <section className="chart-grid hq-surface-card relative min-h-[320px] overflow-hidden px-4 py-4">
        {transcript.length > 0 ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
            <div>
              <p className="text-[11px] font-medium text-text-primary">Today&apos;s conversation</p>
              <p className="text-[10px] text-text-muted">
                {transcript.length} message{transcript.length === 1 ? "" : "s"} · live stats stay pinned above
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-9 text-[11px]"
                disabled={isClearing || isBriefing || isSending}
                onClick={handleClearScreen}
              >
                Clear screen
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-9 text-[11px]"
                disabled={isClearing || isBriefing || isSending || migrationPending}
                onClick={() => void handleClearConversation()}
              >
                {isClearing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="mr-1.5 size-3.5" />
                )}
                Reset today
              </Button>
            </div>
          </div>
        ) : null}
        <div className="relative space-y-3">
        {transcript.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
            <p className="text-[13px] text-text-secondary">
              {freshChatOnOpen ? "Clean slate — agents still remember you." : "Your council is standing by."}
            </p>
            <p className="mt-1 max-w-sm text-[11px] text-text-muted">
              {fullCouncilParticipation && selectedAgent === "auto"
                ? "Auto routes open questions to every specialist — Nova, Rex, Luna, Cipher, and Zara — then Jarvis wraps up."
                : freshChatOnOpen
                  ? "Ask about your trades, mindset, or setups. Live stats stay pinned above while agents reply."
                  : "Before noon, briefing starts automatically once. Your conversation persists when you refresh."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <CouncilInlineStatsCard visual={visualContext} />
            {transcriptRows.map(({ entry, inlineChart }) => (
              <CouncilMessageBubble
                key={entry.id}
                entry={entry}
                visual={visualContext}
                inlineChart={inlineChart}
                speakingAgent={speakingAgent}
                voiceAvailable={voiceAvailable && voiceEnabled}
                onReplay={
                  voiceAvailable && voiceEnabled
                    ? () => {
                        unlockAudio()
                        void speakEntry(entry)
                      }
                    : undefined
                }
                onChartClick={(url, title) => setChartViewer({ url, title })}
              />
            ))}
            {isSending ? (
              <article className="mr-8 rounded-[var(--radius-md)] border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  {fullCouncilParticipation && selectedAgent === "auto" && !conversationAgent
                    ? "Council"
                    : getCouncilAgent(conversationAgent ?? activeAgent ?? "nova").name}
                </p>
                <p className="flex items-center gap-2 text-[12px] text-text-secondary">
                  <Loader2 className="size-3.5 animate-spin text-cyan-glow/80" />
                  Thinking…
                </p>
              </article>
            ) : null}
            <div ref={bottomRef} />
          </div>
        )}
        </div>
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
            disabled={!listenConfigured || migrationPending}
            className={cn(
              "size-11 shrink-0",
              isConversationMode && "border-cyan-glow/40 bg-cyan-glow/10 text-cyan-glow",
              isRecording && "border-loss/40 bg-loss/10 text-loss animate-pulse",
            )}
            title={
              listenConfigured
                ? isConversationMode
                  ? "Stop conversation"
                  : "Start open conversation"
                : "Voice input needs OPENAI_API_KEY"
            }
            onClick={handleMicToggle}
          >
            {isTranscribing || isSending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Mic className={cn("size-4", (isRecording || isListening) && "animate-pulse")} />
            )}
          </Button>
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask the council anything…"
            className="min-h-11 flex-1 resize-none text-[13px]"
            rows={1}
            disabled={isSpeaking || isRecording || isTranscribing || isConversationMode || voicePhase === "thinking"}
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
            disabled={isSending || !question.trim() || migrationPending || isSpeaking || isRecording || isTranscribing || voicePhase === "thinking"}
          >
            {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-text-muted">
          {listenConfigured
            ? "Phase 4 — another council member may chime in. Tap mic once to talk, tap again to stop."
            : "Mic needs OPENAI_API_KEY · spoken replies need ELEVENLABS_API_KEY"}
        </p>
      </form>

      <ScreenshotViewerModal
        open={Boolean(chartViewer)}
        imageUrl={chartViewer?.url ?? null}
        title={chartViewer?.title ?? "Council chart"}
        onClose={() => setChartViewer(null)}
      />
    </div>
  )
}
