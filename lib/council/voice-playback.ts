const VOICE_ENABLED_KEY = "vyronis-council-voice-enabled"

export function readCouncilVoiceEnabledPreference(): boolean {
  if (typeof window === "undefined") return true
  const stored = window.localStorage.getItem(VOICE_ENABLED_KEY)
  if (stored === "0") return false
  return true
}

export function writeCouncilVoiceEnabledPreference(enabled: boolean): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(VOICE_ENABLED_KEY, enabled ? "1" : "0")
}
