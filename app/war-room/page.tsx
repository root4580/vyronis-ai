import type { Metadata } from "next"
import { WarRoomRoute } from "@/components/journal/war-room-route"

export const metadata: Metadata = {
  title: "Weekly War Room",
  description: "Sunday planning, HTF bias, AOI zones, and weekly forex thesis.",
}

export default function WarRoomPage() {
  return <WarRoomRoute />
}
