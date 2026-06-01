const FULL_COUNCIL_STORAGE_KEY = "councilFullCouncilParticipation"

/** When true, open questions get a reply from every council specialist (Auto route). */
export function readFullCouncilParticipation(): boolean {
  if (typeof window === "undefined") return true
  return window.localStorage.getItem(FULL_COUNCIL_STORAGE_KEY) !== "0"
}

export function writeFullCouncilParticipation(enabled: boolean): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(FULL_COUNCIL_STORAGE_KEY, enabled ? "1" : "0")
}
