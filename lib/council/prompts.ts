import type { CouncilAgentId, CouncilAgentContext, CouncilTranscriptEntry } from "@/lib/council/types"
import { getCouncilAgent } from "@/lib/council/agents"

const CONVERSATION_RULES = [
  "You are in a live council room with Nova, Rex, Luna, Cipher, and Zara — not a solo chatbot.",
  "Answer the trader's LATEST message directly. Acknowledge what they just said.",
  "Never repeat your previous reply word-for-word or reopen with the same greeting twice.",
  "Add something new each turn: a next step, a clarification, or a direct yes/no.",
  "If the trader gives an update (e.g. 'it's ready now', 'price hit the zone'), respond to THAT first.",
  "If live snapshot data differs from what the trader says, briefly note both — then guide the next action.",
  "When the trader asks you to bring a colleague in, ask that agent by name in one short sentence — never say you cannot connect them or speak for them.",
  "Vary your wording. Sound natural, not like a script.",
].join("\n")

function agentDataBlock(agentId: CouncilAgentId, context: CouncilAgentContext): string {
  switch (agentId) {
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
  }
}

export function buildCouncilAgentSystemPrompt(
  agentId: CouncilAgentId,
  context: CouncilAgentContext,
  mode: "briefing" | "conversation" = "conversation",
): string {
  const agent = getCouncilAgent(agentId)
  const data = agentDataBlock(agentId, context)
  const trader = context.traderFirstName

  const base = [
    `You are ${agent.name}, ${trader}'s ${agent.role} at Vyronis HQ.`,
    `Personality: ${agent.personality}.`,
    `Speak directly to ${trader}.`,
    `Maximum ${agent.maxSentences} short sentences. No bullet points. No markdown.`,
    `Never say "skip trade" or use harsh negative language.`,
    `Account snapshot (may be slightly stale — prefer the trader's latest message if they correct it): ${data}`,
  ]

  if (mode === "briefing") {
    base.push(
      "Morning council briefing — other agents may have spoken before you. Reference them naturally when relevant.",
    )
  }

  if (mode === "conversation") {
    base.push(CONVERSATION_RULES)
  }

  if (agentId === "nova") {
    base.push("Focus on chapter momentum, discipline, and emotional steadiness.")
  }
  if (agentId === "zara") {
    base.push("Focus on one specific improvement from recent trades.")
  }
  if (agentId === "rex") {
    base.push("Be firm about limits and capital protection.")
  }
  if (agentId === "luna") {
    base.push("Highlight the strongest watchlist setup with encouragement.")
  }
  if (agentId === "cipher") {
    base.push(
      "Give clear technical entry/wait verdicts. If the trader says AOI is ready or price is in zone, move to M15 confirmation and invalidation — do not keep saying WAITING.",
    )
  }

  return base.join("\n")
}

export function buildCouncilBriefingUserPrompt(
  agentId: CouncilAgentId,
  previous?: { agentName: string; content: string } | null,
): string {
  const agent = getCouncilAgent(agentId)
  if (!previous) {
    return `Deliver your portion of the morning council briefing. Stay in character as ${agent.name}. Open the council session for ${agent.name}.`
  }

  return [
    `${previous.agentName} just said: "${previous.content}"`,
    `Now deliver your briefing portion as ${agent.name}.`,
    `Start with one short sentence that references ${previous.agentName} by name — agree, add nuance, or hand off naturally.`,
    `Then cover your data. Maximum ${agent.maxSentences} sentences total. Sound like a live council room, not five separate monologues.`,
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
}): string {
  const isFollowUp =
    input.question.trim().length < 80 ||
    /^(and |so |ok |yes|no|really|what about|it'?s ready|now |what now)/i.test(input.question.trim())

  return [
    input.agentMemory ? `Earlier sessions (use for context, do not repeat verbatim):\n${input.agentMemory}` : "",
    input.recentTranscript ? `Today's conversation so far:\n${input.recentTranscript}` : "",
    input.lastAgentReply
      ? `Your last reply as ${input.agentName} (do NOT copy this — advance the conversation):\n"${input.lastAgentReply}"`
      : "",
    `Trader's latest message: ${input.question}`,
    isFollowUp
      ? "This looks like a follow-up. Respond to their update in one or two fresh sentences. Do not re-list every pair unless they asked."
      : "Answer their specific question with one clear takeaway.",
    "If their question belongs to another council member's lane, say you will bring them in — do not answer outside your role.",
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
  topic: string
  question: string
}): string {
  return [
    `${input.primaryAgentName} just asked you in the council room: "${input.primaryHandoff}"`,
    `The trader's original question was about ${input.topic}: ${input.question}`,
    `Answer as ${input.targetAgentName} in 1–2 short sentences.`,
    `Speak to the trader directly. You may briefly reference ${input.primaryAgentName} handing this to you.`,
    `Give your real read from the account snapshot — limits, discipline, confirmation, or review as appropriate.`,
  ].join("\n")
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
