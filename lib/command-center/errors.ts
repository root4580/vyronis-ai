export class CommandCenterTableMissingError extends Error {
  constructor(message = "Command center tables missing. Run supabase/014-command-center-foundation.sql.") {
    super(message)
    this.name = "CommandCenterTableMissingError"
  }
}

export function isMissingCommandCenterTableError(error: {
  code?: string
  message?: string
} | null): boolean {
  if (!error) return false
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist|schema cache/i.test(error.message || "")
  )
}
