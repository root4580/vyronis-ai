"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import {
  FOREX_TIMELINE_LABELS,
  getForexSessionSnapshots,
  getForexTimelineNowPercent,
  getLocalClock,
  localMinuteToTimelinePercent,
} from "@/lib/trading/forex-sessions"
import { cn } from "@/lib/utils"

type ForexSessionsWidgetProps = {
  className?: string
}

/** Forex Factory Sessions widget palette. */
const FF = {
  header: "#456ea6",
  body: "#e8edf2",
  border: "#9fb0bf",
  grid: "#bcc6d0",
  axisText: "#5f6b7a",
  open: "#5fad5f",
  closed: "#c4cad2",
  closedText: "#2a3441",
  now: "#5fad5f",
  tooltipBorder: "#c8cdd3",
} as const

const BAR_HEIGHT_PX = 14
const BAR_GAP_PX = 2
const TIMELINE_HEIGHT_PX = 15
const CLOSED_LABEL_HEIGHT_PX = 11
const SESSIONS_ENABLED_STORAGE_KEY = "vyronis:forex-sessions-enabled"

function getTimelineLabelStyle(
  index: number,
  total: number,
  leftPercent: number,
): { left: string; transform: string; textAlign: "left" | "center" | "right" } {
  if (index === 0) {
    return { left: `${leftPercent}%`, transform: "none", textAlign: "left" }
  }
  if (index === total - 1) {
    return { left: `${leftPercent}%`, transform: "translateX(-100%)", textAlign: "right" }
  }
  return { left: `${leftPercent}%`, transform: "translateX(-50%)", textAlign: "center" }
}

function readSessionsEnabledPreference(): boolean {
  if (typeof window === "undefined") return true
  const stored = window.localStorage.getItem(SESSIONS_ENABLED_STORAGE_KEY)
  if (stored === "0") return false
  if (stored === "1") return true
  return true
}

export function ForexSessionsWidget({ className }: ForexSessionsWidgetProps) {
  const [now, setNow] = useState(() => new Date())
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    setEnabled(readSessionsEnabledPreference())
  }, [])

  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [enabled])

  const toggleEnabled = () => {
    setEnabled((current) => {
      const next = !current
      window.localStorage.setItem(SESSIONS_ENABLED_STORAGE_KEY, next ? "1" : "0")
      return next
    })
  }

  const local = getLocalClock(now)
  const sessions = getForexSessionSnapshots(now)
  const nowPercent = getForexTimelineNowPercent(local.totalMinutes)

  const rowHeight = (isOpen: boolean) =>
    (isOpen ? 0 : CLOSED_LABEL_HEIGHT_PX) + BAR_HEIGHT_PX

  const barsHeight = sessions.reduce(
    (total, session, index) =>
      total + rowHeight(session.isOpen) + (index < sessions.length - 1 ? BAR_GAP_PX : 0),
    0,
  )

  return (
    <div
      className={cn("ff-sessions-widget rounded-[3px] border font-sans", className)}
      style={{
        borderColor: FF.border,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        className="flex items-center justify-between px-2 py-[5px]"
        style={{ backgroundColor: FF.header }}
      >
        <span className="text-[11px] font-bold leading-none text-white">Sessions</span>
        <button
          type="button"
          onClick={toggleEnabled}
          aria-pressed={enabled}
          aria-label={enabled ? "Hide sessions timeline" : "Show sessions timeline"}
          className="flex size-[13px] shrink-0 items-center justify-center border transition-colors"
          style={{
            backgroundColor: enabled ? FF.open : "transparent",
            borderColor: enabled ? FF.open : "rgb(255 255 255 / 70%)",
          }}
        >
          {enabled ? <Check className="size-[9px] stroke-[3] text-white" /> : null}
        </button>
      </div>

      {enabled ? (
        <div className="px-[5px] pb-[5px] pt-[4px]" style={{ backgroundColor: FF.body }}>
          <div
            className="relative mx-[2px]"
            style={{ height: TIMELINE_HEIGHT_PX + 4 + barsHeight }}
          >
            {FOREX_TIMELINE_LABELS.map(({ localMinutes, label }) => {
              const left = localMinuteToTimelinePercent(localMinutes)
              return (
                <div
                  key={`grid-${label}`}
                  className="pointer-events-none absolute top-0 w-px"
                  style={{
                    left: `${left}%`,
                    height: TIMELINE_HEIGHT_PX + 4 + barsHeight,
                    backgroundColor: FF.grid,
                  }}
                  aria-hidden
                />
              )
            })}

            <div
              className="pointer-events-none absolute top-0 z-[3] w-px"
              style={{
                left: `${nowPercent}%`,
                height: TIMELINE_HEIGHT_PX + 4 + barsHeight,
                backgroundColor: FF.now,
              }}
              aria-hidden
            />

            <div
              className="relative border-b"
              style={{
                height: TIMELINE_HEIGHT_PX,
                borderColor: FF.grid,
              }}
            >
              {FOREX_TIMELINE_LABELS.map(({ localMinutes, label }, index) => {
                const left = localMinuteToTimelinePercent(localMinutes)
                const labelStyle = getTimelineLabelStyle(
                  index,
                  FOREX_TIMELINE_LABELS.length,
                  left,
                )

                return (
                  <span
                    key={label}
                    className="absolute top-[1px] whitespace-nowrap text-[9px] leading-none"
                    style={{
                      ...labelStyle,
                      color: FF.axisText,
                    }}
                  >
                    {label}
                  </span>
                )
              })}
            </div>

            <div
              className="relative flex flex-col"
              style={{
                marginTop: 4,
                gap: BAR_GAP_PX,
              }}
            >
              {sessions.map((session) => {
              const firstSegment = session.barSegments[0]
              const segmentLeft = firstSegment?.leftPercent ?? 0
              const tooltipLeft = firstSegment
                ? firstSegment.leftPercent + firstSegment.widthPercent / 2
                : 50

              return (
                <div
                  key={session.id}
                  className="group relative overflow-visible"
                  style={{ height: rowHeight(session.isOpen) }}
                >
                  {!session.isOpen ? (
                    <p
                      className="absolute top-0 max-w-[78%] truncate text-[10px] font-normal leading-none"
                      style={{
                        left: `${segmentLeft}%`,
                        color: FF.closedText,
                      }}
                    >
                      {session.barLabel}
                    </p>
                  ) : null}

                  <div
                    className="absolute left-0 right-0 overflow-visible"
                    style={{
                      top: session.isOpen ? 0 : CLOSED_LABEL_HEIGHT_PX,
                      height: BAR_HEIGHT_PX,
                    }}
                  >
                    {session.barSegments.map((segment, index) => (
                      <div
                        key={`${session.id}-${index}`}
                        className="absolute inset-y-0 rounded-[2px]"
                        style={{
                          left: `${segment.leftPercent}%`,
                          width: `${segment.widthPercent}%`,
                          backgroundColor: session.isOpen ? FF.open : FF.closed,
                        }}
                      />
                    ))}

                    {session.isOpen ? (
                      <span
                        className="pointer-events-none absolute inset-y-0 z-[2] flex max-w-[78%] items-center truncate pl-[3px] text-[10px] font-normal leading-none text-white"
                        style={{
                          left: `${segmentLeft}%`,
                          textShadow: "0 0 1px rgb(0 0 0 / 35%)",
                        }}
                      >
                        {session.barLabel}
                      </span>
                    ) : null}

                    {session.hoverLabel ? (
                      <div
                        role="tooltip"
                        className="pointer-events-none absolute bottom-[calc(100%+6px)] z-30 hidden -translate-x-1/2 group-hover:block"
                        style={{ left: `${tooltipLeft}%` }}
                      >
                        <div
                          className="relative whitespace-nowrap rounded-[2px] bg-white px-2 py-[3px] text-[10px] font-normal leading-tight text-[#222]"
                          style={{
                            border: `1px solid ${FF.tooltipBorder}`,
                            boxShadow: "0 1px 4px rgb(0 0 0 / 18%)",
                          }}
                        >
                          {session.hoverLabel}
                          <span
                            className="absolute left-1/2 top-full -translate-x-1/2 border-[4px] border-transparent border-t-white"
                            aria-hidden
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
