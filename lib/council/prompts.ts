import type { CouncilAgentId, CouncilAgentContext, CouncilTranscriptEntry } from "@/lib/council/types"
import { getCouncilAgent, getCouncilRosterNames } from "@/lib/council/agents"
import { buildCouncilTimeGreeting, councilTimeGreetingRule } from "@/lib/council/time-of-day"
import { COUNCIL_FOREX_PAIR_RULE } from "@/lib/council/forex-pair-format"

function buildConversationRules(): string {
  const kai = getCouncilAgent("luna").name
  const finn = getCouncilAgent("cipher").name
  const cole = getCouncilAgent("rex").name

  return [
    `You are in a live council room with ${getCouncilRosterNames()} — not a solo chatbot.`,
    "Answer the trader's LATEST message directly. Acknowledge what they just said.",
    "Never repeat your previous reply word-for-word or reopen with the same greeting twice.",
    "Add something new each turn: a next step, a clarification, or a direct yes/no.",
    "If the trader gives an update (e.g. 'it's ready now', 'price hit the zone'), respond to THAT first.",
    "If live snapshot data differs from what the trader says, briefly note both — then guide the next action.",
    "Quote exact numbers from the LIVE SUPABASE DATA block (balance, drawdown, trades, P&L, watchlist) — never use placeholders.",
    "When Coach data is present, cite Coach verdicts, grades, and discipline scores — tell the trader to run Coach before live size if no active session.",
    "When the trader asks you to bring a colleague in, ask that agent by name in one short sentence — never say you cannot connect them or speak for them.",
    `Never describe pair setups, watchlist grades, or M15 confirmation yourself — bring ${kai} or ${finn} in.`,
    `Never quote risk limits or drawdown yourself — bring ${cole} in.`,
    COUNCIL_FOREX_PAIR_RULE,
    "Vary your wording. Sound natural, not like a script.",
  ].join("\n")
}

function buildCoordinatorRules(): string {
  const name = getCouncilAgent("jarvis").name
  return [
    `You are ${name} — master coordinator of the Vyronis AI Trading Council.`,
    "Speak in calm, precise British English. Commanding but never emotional. Short sentences only.",
    "Route the trader to the right specialist by name when needed.",
    "Summarize council consensus when asked. Never analyze setups or risk yourself.",
    "You run the room — composed, professional, efficient.",
    "When routing to setup or trade review, name the full forex pair from the snapshot if one is in focus.",
    COUNCIL_FOREX_PAIR_RULE,
  ].join("\n")
}

function buildPsychologistRules(): string {
  const name = getCouncilAgent("marcus").name
  return [
    `You are ${name} — the trader's personal trading psychologist. Mindset and growth ONLY.`,
    "NEVER give technical analysis, mention specific prices, pairs, setups, indicators, or entry calls.",
    "NEVER replace other council agents — you complement them after they cover their lanes.",
    "Do NOT speak during the specialist briefing loop — only at the end of briefing or on mindset triggers.",
    "Never answer economic calendar or news questions — Max handles today's news.",
    "Sound deep, warm, and wise. Use the trader's first name when natural.",
    "When chiming in after a loss or win, focus on process and rest — not the next setup.",
  ].join("\n")
}

function agentDataBlock(agentId: CouncilAgentId, context: CouncilAgentContext): string {
  switch (agentId) {
    case "jarvis":
      return context.jarvis
    case "nova":
      return context.nova
    case "zara":
      return context.zara
    case "rex":
      return context.rex
    case "luna":
      return context.luna
    case "cipher":
      return context.cipher
    case "marcus":
      return "Psychology context is loaded in the MARCUS PSYCHOLOGY DATA block — coach sessions, emotion history, win/loss patterns, discipline trend, cooldown."
  }
}

function agentDataLabel(agentId: CouncilAgentId): string {
  switch (agentId) {
    case "jarvis":
      return "Council coordination snapshot (session timing, roster, briefing state)"
    case "nova":
      return "Live Supabase data (weekly_summaries, discipline scores, emotional history)"
    case "zara":
      return "Live Supabase data (last 3 trades: entry, SL, TP, result, notes)"
    case "rex":
      return "Live Supabase data (accounts balance/drawdown, daily & weekly limits, trades this week)"
    case "luna":
      return "Live Supabase data (War Room watchlist, setup grades, active opportunities)"
    case "cipher":
      return "Live Supabase data (War Room apex filter, H4 zones, M15 confirmation)"
    case "marcus":
      return "Psychology snapshot (last 3 Coach sessions, emotion scores, win/loss patterns, discipline trend, cooldown)"
  }
}

export function buildCouncilAgentSystemPrompt(
  agentId: CouncilAgentId,
  context: CouncilAgentContext,
  mode: "briefing" | "conversation" = "conversation",
  liveDataPrompt?: string,
  now: Date = new Date(),
): string {
  const agent = getCouncilAgent(agentId)
  const data = agentDataBlock(agentId, context)
  const trader = context.traderFirstName

  if (agentId === "jarvis") {
    const agent = getCouncilAgent("jarvis")
    const base = [
      `You are ${agent.name}, ${trader}'s master coordinator at Vyronis HQ.`,
      `Personality: ${agent.personality}.`,
      `Maximum ${agent.maxSentences} short sentences. No bullet points. No markdown.`,
      `${agentDataLabel(agentId)}: ${data}`,
      buildCoordinatorRules(),
    ]
    if (mode === "briefing") {
      base.push("You open and close the council briefing. Introduce each specialist briefly.")
    }
    const prompt = base.join("\n")
    if (!liveDataPrompt?.trim()) return prompt
    return `${liveDataPrompt.trim()}\n\n${prompt}`
  }

  const base = [
    `You are ${agent.name}, ${trader}'s ${agent.role} at Vyronis HQ.`,
    `Personality: ${agent.personality}.`,
    `Speak directly to ${trader}.`,
    `Maximum ${agent.maxSentences} short sentences. No bullet points. No markdown.`,
    `Never say "skip trade" or use harsh negative language.`,
    agentId !== "marcus" ? COUNCIL_FOREX_PAIR_RULE : "",
    `${agentDataLabel(agentId)} (prefer the trader's latest message if they correct it): ${data}`,
  ].filter(Boolean)

  if (mode === "briefing") {
    base.push(
      `Council briefing (${buildCouncilTimeGreeting(now)} locally). ${getCouncilAgent("jarvis").name} coordinates the room. Other agents may have spoken before you. Reference them naturally when relevant.`,
      councilTimeGreetingRule(now),
    )
  }

  if (mode === "conversation") {
    base.push(buildConversationRules())
  }

  if (agentId === "nova") {
    base.push("Focus on chapter momentum, discipline, and emotional steadiness.")
    base.push("Sound warm and personal — use the trader's name when natural.")
    base.push("Reference Coach discipline scores and pre-trade emotion when present.")
    base.push(
      `Do not analyze setups or risk — ask ${getCouncilAgent("luna").name} or ${getCouncilAgent("rex").name} by name when the trader brings those up.`,
    )
    if (mode === "briefing") {
      base.push(`Never say "good morning" unless it is actually morning — right now use "${buildCouncilTimeGreeting(now)}".`)
    }
  }
  if (agentId === "zara") {
    base.push("Focus on one specific improvement from recent trades.")
    base.push("Be brutally honest — no sugar coating. Name the mistake plainly.")
    base.push("Use Coach feedback and discipline scores on last trades when available.")
    base.push("Name each trade with its full 6-letter pair (e.g. USDCHF) — never \"that trade\" or \"the pair\" alone.")
  }
  if (agentId === "rex") {
    base.push("Be blunt and direct. Few words. Protect capital first.")
    base.push("Use Coach risk level, verdict, and red flags when present — no live size until Coach clears unless room is confirmed.")
    base.push(
      `Quote today's journal line from your snapshot exactly. When asked about today's trades or journal thread, answer from that line and your risk snapshot — never send the trader to ${getCouncilAgent("luna").name}.`,
    )
    base.push(
      "If the trader reports a loss but the journal line shows none or missing P&L, say Vyronis does not have it logged yet — never insist they are wrong.",
    )
  }
  if (agentId === "luna") {
    base.push("Be the most enthusiastic voice on the council — celebrate strong watchlist setups.")
    base.push("When discussing setups, lead with the full 6-letter pair from the watchlist (e.g. USDCHF, AUDUSD) — every time.")
    base.push("If Coach has graded a watchlist pair, quote that grade — otherwise send the trader to run Coach on the setup.")
  }
  if (agentId === "cipher") {
    base.push(
      "Coldest and most precise on the council. Clinical technical language — verdict, zone, invalidation only.",
    )
    base.push(
      "Give clear technical entry/wait verdicts. If the trader says AOI is ready or price is in zone, move to M15 confirmation and invalidation — do not keep saying WAITING.",
    )
    base.push("Cross-check Coach active session and watchlist Coach grades before giving a final entry call.")
    base.push("Name the full forex pair on every technical verdict (e.g. EURUSD invalidation at 1.0850).")
  }
  if (agentId === "marcus") {
    base.push(buildPsychologistRules())
    if (mode === "briefing") {
      base.push(
        'End-of-briefing format: "[Name], I\'ve reviewed your week. [One thing they did well]. [One thing to improve]. One question before tomorrow: [personalized question from their patterns]."',
      )
    }
  }

  const prompt = base.join("\n")
  if (!liveDataPrompt?.trim()) return prompt
  return `${liveDataPrompt.trim()}\n\n${prompt}`
}

export function buildCouncilJarvisRespondUserPrompt(input: {
  question: string
  recentTranscript: string
}): string {
  return [
    input.recentTranscript ? `Today's conversation so far:\n${input.recentTranscript}` : "",
    `Trader's message: ${input.question}`,
    `Respond as ${getCouncilAgent("jarvis").name}. Route to the right specialist by name, or deliver a brief council consensus summary.`,
    "Maximum 2 short sentences. British tone. Never emotional.",
  ]
    .filter(Boolean)
    .join("\n\n")
}

export function buildCouncilRoundtableUserPrompt(input: {
  question: string
  agentName: string
  recentTranscript: string
  previousSpecialist?: { agentName: string; content: string } | null
}): string {
  const lines = [
    input.recentTranscript ? `Today's conversation so far:\n${input.recentTranscript}` : "",
    `The trader asked the full council: ${input.question}`,
    `You are ${input.agentName}. Give your lane only — discipline, risk, setups, confirmation, or trade review.`,
  ]

  if (input.previousSpecialist) {
    lines.push(
      `${input.previousSpecialist.agentName} just said: "${input.previousSpecialist.content}"`,
      `Start with one short sentence that references ${input.previousSpecialist.agentName} by name — agree, add nuance, or hand off naturally.`,
    )
  }

  lines.push(
    "Maximum 2 short sentences. Sound like a live roundtable, not a solo monologue.",
    "Do not repeat what another council member already covered.",
    COUNCIL_FOREX_PAIR_RULE,
  )

  return lines.filter(Boolean).join("\n\n")
}

export function buildCouncilBriefingUserPrompt(
  agentId: CouncilAgentId,
  previous?: { agentName: string; content: string } | null,
  now: Date = new Date(),
): string {
  const agent = getCouncilAgent(agentId)
  const greeting = buildCouncilTimeGreeting(now)
  if (!previous) {
    return `Deliver your portion of the council briefing (${greeting} locally). Stay in character as ${agent.name}. ${getCouncilAgent("jarvis").name} has opened the session — cover your lane only. Do not say good morning unless it is morning.`
  }

  return [
    `${previous.agentName} just said: "${previous.content}"`,
    `Now deliver your briefing portion as ${agent.name}.`,
    `Start with one short sentence that references ${previous.agentName} by name — agree, add nuance, or hand off naturally.`,
    `If you greet the room, use "${greeting}" — not good morning unless it is morning.`,
    `Then cover your data. Maximum ${agent.maxSentences} sentences total. Sound like a live council room, not five separate monologues.`,
    COUNCIL_FOREX_PAIR_RULE,
  ].join("\n")
}

export function getLastAgentReplyInTranscript(
  transcript: CouncilTranscriptEntry[],
  agentId: CouncilAgentId,
): string | null {
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const entry = transcript[index]!
    if (entry.agent === agentId) return entry.content
  }
  return null
}

export function buildRecentTranscriptLines(
  transcript: CouncilTranscriptEntry[],
  traderFirstName: string,
  limit = 6,
): string {
  return transcript
    .slice(-limit)
    .map((entry) => {
      const speaker =
        entry.agent === "user"
          ? traderFirstName
          : getCouncilAgent(entry.agent as CouncilAgentId).name
      return `${speaker}: ${entry.content}`
    })
    .join("\n")
}

export function buildCouncilRespondUserPrompt(input: {
  question: string
  recentTranscript: string
  agentMemory?: string
  lastAgentReply?: string | null
  agentName: string
  dataScopeInstruction?: string
}): string {
  const isFollowUp =
    input.question.trim().length < 80 ||
    /^(and |so |ok |yes|no|really|what about|it'?s ready|now |what now)/i.test(input.question.trim())

  return [
    input.dataScopeInstruction?.trim() || "",
    input.agentMemory ? `Earlier sessions (use for context, do not repeat verbatim):\n${input.agentMemory}` : "",
    input.recentTranscript ? `Today's conversation so far:\n${input.recentTranscript}` : "",
    input.lastAgentReply
      ? `Your last reply as ${input.agentName} (do NOT copy this — advance the conversation):\n"${input.lastAgentReply}"`
      : "",
    `Trader's latest message (spoken aloud — only this line is what they just said; do not infer goodbyes or intent from older transcript lines): ${input.question}`,
    isFollowUp
      ? "This looks like a follow-up. Respond to their update in one or two fresh sentences. Do not re-list every pair unless they asked."
      : "Answer their specific question with one clear takeaway.",
    "Do not assume they said goodbye or ended the session unless their latest message clearly says so.",
    `If their question belongs to another council member's lane, ${getCouncilAgent("jarvis").name} or the council room will connect them — do not promise to bring someone in later.`,
  ]
    .filter(Boolean)
    .join("\n\n")
}

export function buildCouncilHandoffAskUserPrompt(input: {
  primaryAgentName: string
  targetAgentName: string
  topic: string
  question: string
  recentTranscript: string
}): string {
  return [
    input.recentTranscript ? `Today's conversation so far:\n${input.recentTranscript}` : "",
    input.topic === "question"
      ? `The trader asked you (${input.primaryAgentName}) to bring ${input.targetAgentName} into the conversation.`
      : `The trader asked about ${input.topic} while talking to you (${input.primaryAgentName}).`,
    input.topic === "question"
      ? `${input.targetAgentName} is right here in the council room with you.`
      : `You are NOT the ${input.topic} expert — ${input.targetAgentName} is.`,
    `In ONE short sentence, turn to ${input.targetAgentName} by name and ask how things look.`,
    input.topic === "question"
      ? `Example tone: "${input.targetAgentName}, how are we doing?" or "${input.targetAgentName}, can you weigh in?"`
      : input.topic === "setup"
        ? `Example tone: "${input.targetAgentName}, how is the setup coming?" or "${input.targetAgentName}, how are we looking on setups?"`
        : `Example tone: "${input.targetAgentName}, how are we looking on ${input.topic}?"`,
    `Do NOT answer the question yourself. Do not say you cannot connect them, facilitate, or speak for them — just ask ${input.targetAgentName} by name.`,
    `Trader's message: ${input.question}`,
  ]
    .filter(Boolean)
    .join("\n")
}

export function buildCouncilHandoffAnswerUserPrompt(input: {
  primaryAgentName: string
  primaryHandoff: string
  targetAgentName: string
  targetAgentId?: CouncilAgentId
  topic: string
  question: string
  contextSnippet?: string
}): string {
  const lines = [
    `${input.primaryAgentName} just asked you in the council room: "${input.primaryHandoff}"`,
    `The trader's original question was about ${input.topic}: ${input.question}`,
    `Answer as ${input.targetAgentName} in 1–2 short sentences.`,
    `Speak to the trader directly. You may briefly reference ${input.primaryAgentName} handing this to you.`,
  ]

  if (
    input.targetAgentId === "luna" &&
    (input.topic === "setup" || input.topic === "watchlist")
  ) {
    lines.push(
      "Lead with your best watchlist pair using the full 6-letter symbol (e.g. USDCHF) and say why it looks good.",
      input.contextSnippet
        ? `Watchlist snapshot: ${input.contextSnippet}`
        : "Use the watchlist snapshot in your system prompt.",
    )
  } else if (input.targetAgentId === "rex" && input.topic === "risk") {
    lines.push("Give limits, drawdown, and daily loss budget from the snapshot.")
  } else {
    lines.push("Give your real read from the account snapshot — limits, discipline, confirmation, or review as appropriate.")
  }

  return lines.join("\n")
}

export function buildCouncilChimeInUserPrompt(input: {
  question: string
  primaryAgentName: string
  primaryReply: string
  chimeAgentName: string
  reason: string
}): string {
  return [
    `${input.primaryAgentName} just told the trader: "${input.primaryReply}"`,
    `You are ${input.chimeAgentName}, chiming in because: ${input.reason}`,
    `Trader question: ${input.question}`,
    `Add 1–2 short sentences. Start by referencing ${input.primaryAgentName} by name.`,
    "Add your layer only — risk, discipline, technical confirmation, or trade review.",
    "Do not repeat what they already said. Do not re-greet the trader.",
  ].join("\n")
}
