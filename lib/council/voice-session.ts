/** Council voice loop: LISTENING → THINKING → SPEAKING → LISTENING */

export type CouncilVoicePhase = "idle" | "listening" | "thinking" | "speaking"

export class CouncilVoiceSessionController {
  private phase: CouncilVoicePhase = "idle"
  private phaseListeners = new Set<(phase: CouncilVoicePhase) => void>()
  private turnCompleteWaiters: Array<() => void> = []

  getPhase(): CouncilVoicePhase {
    return this.phase
  }

  /** Mic only captures in LISTENING — blocks during THINKING and SPEAKING (echo guard). */
  isMicAllowed(): boolean {
    return this.phase === "listening"
  }

  isAgentSpeaking(): boolean {
    return this.phase === "speaking"
  }

  setPhase(next: CouncilVoicePhase): void {
    if (this.phase === next) return
    this.phase = next
    for (const listener of this.phaseListeners) {
      listener(next)
    }
    if (next === "listening" || next === "idle") {
      this.resolveTurnCompleteWaiters()
    }
  }

  beginListening(): void {
    this.setPhase("listening")
  }

  beginThinking(): void {
    this.setPhase("thinking")
  }

  beginSpeaking(): void {
    this.setPhase("speaking")
  }

  reset(): void {
    this.setPhase("idle")
  }

  subscribePhase(listener: (phase: CouncilVoicePhase) => void): () => void {
    this.phaseListeners.add(listener)
    listener(this.phase)
    return () => {
      this.phaseListeners.delete(listener)
    }
  }

  /** Resolves when agents finish speaking and phase returns to LISTENING/idle. */
  waitForTurnComplete(signal?: AbortSignal): Promise<void> {
    if (this.phase === "listening" || this.phase === "idle") {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const finish = () => {
        signal?.removeEventListener("abort", onAbort)
        resolve()
      }
      const onAbort = () => {
        const index = this.turnCompleteWaiters.indexOf(finish)
        if (index >= 0) this.turnCompleteWaiters.splice(index, 1)
        reject(new DOMException("Voice session aborted", "AbortError"))
      }

      this.turnCompleteWaiters.push(finish)
      signal?.addEventListener("abort", onAbort, { once: true })
    })
  }

  private resolveTurnCompleteWaiters(): void {
    const waiters = this.turnCompleteWaiters
    this.turnCompleteWaiters = []
    for (const resolve of waiters) {
      resolve()
    }
  }
}

export type QueuedSpeechClip = {
  agent: import("@/lib/council/types").CouncilAgentId
  objectUrl: string
}

/** Buffered speech clips — producer fetches TTS, consumer plays in order. */
export class AsyncSpeechQueue {
  private queue: QueuedSpeechClip[] = []
  private closed = false
  private waiters: Array<(item: QueuedSpeechClip | null) => void> = []

  push(item: QueuedSpeechClip): void {
    if (this.closed) return
    const waiter = this.waiters.shift()
    if (waiter) {
      waiter(item)
      return
    }
    this.queue.push(item)
  }

  close(): void {
    this.closed = true
    while (this.waiters.length > 0) {
      this.waiters.shift()?.(null)
    }
  }

  clear(): void {
    this.queue = []
    this.closed = false
    for (const waiter of this.waiters) {
      waiter(null)
    }
    this.waiters = []
  }

  async pop(signal?: AbortSignal): Promise<QueuedSpeechClip | null> {
    if (this.queue.length > 0) {
      return this.queue.shift() ?? null
    }
    if (this.closed) return null

    return new Promise((resolve, reject) => {
      const deliver = (item: QueuedSpeechClip | null) => {
        signal?.removeEventListener("abort", onAbort)
        resolve(item)
      }
      const onAbort = () => {
        const index = this.waiters.indexOf(deliver)
        if (index >= 0) this.waiters.splice(index, 1)
        reject(new DOMException("Speech queue aborted", "AbortError"))
      }

      this.waiters.push(deliver)
      signal?.addEventListener("abort", onAbort, { once: true })
    })
  }
}
