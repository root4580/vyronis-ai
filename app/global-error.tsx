"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en" className="dark bg-background">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "24px",
            textAlign: "center",
            fontFamily: "sans-serif",
          }}
        >
          <h1 style={{ fontSize: "20px", fontWeight: 500 }}>Something went wrong</h1>
          <p style={{ color: "#888", fontSize: "14px", maxWidth: "420px" }}>
            The error has been reported. Try reloading the page.
          </p>
          <button
            onClick={() => reset()}
            style={{
              border: "1px solid #444",
              borderRadius: "8px",
              padding: "8px 16px",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
