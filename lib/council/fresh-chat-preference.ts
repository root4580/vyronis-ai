const FRESH_CHAT_STORAGE_KEY = "councilFreshChatOnOpen"

/** When true, Council opens with an empty chat UI but agents keep memory + server transcript. */
export function readFreshChatOnOpen(): boolean {
  if (typeof window === "undefined") return true
  return window.localStorage.getItem(FRESH_CHAT_STORAGE_KEY) !== "0"
}

export function writeFreshChatOnOpen(enabled: boolean): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(FRESH_CHAT_STORAGE_KEY, enabled ? "1" : "0")
}
