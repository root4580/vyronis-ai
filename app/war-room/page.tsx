import type { Metadata } from "next"
import { WarRoomRoute } from "@/components/journal/war-room-route"

export const metadata: Metadata = {
  title: "Council",
  description: "News and risk, daily mission, HTF bias, watchlist, AOI zones, coach, and reviews.",
}

export default function WarRoomPage() {
  return <WarRoomRoute />
}
