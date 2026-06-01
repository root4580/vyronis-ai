export type CouncilTimeOfDay = "morning" | "afternoon" | "evening"

export function getCouncilTimeOfDay(now = new Date()): CouncilTimeOfDay {
  const hour = now.getHours()
  if (hour < 12) return "morning"
  if (hour < 17) return "afternoon"
  return "evening"
}

export function buildCouncilTimeGreeting(now = new Date()): string {
  return `Good ${getCouncilTimeOfDay(now)}`
}

export function councilTimeGreetingRule(now = new Date()): string {
  const greeting = buildCouncilTimeGreeting(now)
  return `Open with "${greeting}" if you greet the room — never say good morning in the afternoon or evening.`
}
