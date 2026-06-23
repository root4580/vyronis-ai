import type { Metadata } from "next"
import { ScannerRoute } from "@/components/scanner/scanner-route"

export const metadata: Metadata = {
  title: "A+ Scanner",
  description: "Precision Flow setup scanner — strategy rules, watchlist, and live A+ signals.",
}

export default function ScannerPage() {
  return <ScannerRoute />
}
