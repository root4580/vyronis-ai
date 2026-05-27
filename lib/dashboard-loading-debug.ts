export const DASHBOARD_LOAD_TIMEOUT_MS = 3000

export function logDashboardLoading(
  event: string,
  payload?: Record<string, unknown>,
) {
  if (typeof window === "undefined") return
  console.log(`[Vyronis Dashboard] ${event}`, payload ?? "")
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then((value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      })
      .catch((error) => {
        window.clearTimeout(timeoutId)
        reject(error)
      })
  })
}
