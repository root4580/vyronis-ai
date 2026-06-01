const VOICE_ENABLED_KEY = "vyronis-council-voice-enabled"
const VOICE_VOLUME_KEY = "vyronis-council-voice-volume"

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

export function readCouncilVoiceVolumePreference(): number {
  if (typeof window === "undefined") return 1
  const stored = window.localStorage.getItem(VOICE_VOLUME_KEY)
  if (!stored) return 1
  const parsed = Number(stored)
  if (!Number.isFinite(parsed)) return 1
  return Math.min(1, Math.max(0, parsed))
}

export function writeCouncilVoiceVolumePreference(volume: number): void {
  if (typeof window === "undefined") return
  const clamped = Math.min(1, Math.max(0, volume))
  window.localStorage.setItem(VOICE_VOLUME_KEY, String(clamped))
}
