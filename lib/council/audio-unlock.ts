let audioUnlocked = false

/** Browsers block autoplay until the user interacts with the page. Call from click handlers. */
export function unlockCouncilAudio(): void {
  if (typeof window === "undefined" || audioUnlocked) return

  try {
    const audio = new Audio(
      "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T/hMmSAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T/hMmSAAAAAAAAAAAAAAAAAAAA",
    )
    audio.volume = 0.001
    void audio.play().then(() => {
      audioUnlocked = true
      audio.pause()
    }).catch(() => undefined)
  } catch {
    // ignore
  }
}

export function isCouncilAudioUnlocked(): boolean {
  return audioUnlocked
}
