import type { Metadata } from "next"
import { CouncilRoute } from "@/components/council/council-route"

export const metadata: Metadata = {
  title: "AI Trading Council",
  description: "Morning council briefing — Nova, Rex, Luna, Cipher, and Zara on your real trading data.",
}

export default function CouncilPage() {
  return <CouncilRoute />
}
