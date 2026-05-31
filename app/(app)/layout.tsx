import type { Metadata } from "next"
import { APP_DESCRIPTION, APP_NAME } from "@/lib/branding"

export const metadata: Metadata = {
  title: "Command Center",
  description: APP_DESCRIPTION,
  robots: { index: false, follow: false },
}

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return children
}
