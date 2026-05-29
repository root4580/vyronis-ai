export const STRATEGY_BRAIN_MIGRATION_MESSAGE =
  "Run supabase/026-strategy-brain-foundation.sql to enable Strategy Brain."

export const WAR_ROOM_MIGRATION_FILES = [
  "supabase/026-strategy-brain-foundation.sql",
  "supabase/027-war-room-extension.sql",
] as const

export function isStrategyBrainSetupError(message: string | undefined): boolean {
  if (!message) return false
  return (
    /026-strategy-brain/i.test(message) ||
    /strategy_brain/i.test(message) ||
    /does not exist/i.test(message) ||
    /schema cache/i.test(message) ||
    /PGRST205/i.test(message) ||
    /42P01/i.test(message)
  )
}

export function formatStrategyBrainSetupError(message: string): string {
  if (isStrategyBrainSetupError(message)) {
    return STRATEGY_BRAIN_MIGRATION_MESSAGE
  }
  return message
}
