import type { Metadata } from "next"
import { ChapterReviewRoute } from "@/components/weekly-chapters/chapter-review-route"

type PageProps = {
  params: Promise<{ weekStart: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { weekStart } = await params
  return {
    title: `Chapter review · ${decodeURIComponent(weekStart)}`,
    description: "Weekly chapter recap — trades, lessons, and carry forward.",
  }
}

export default async function ChapterReviewPage({ params }: PageProps) {
  const { weekStart } = await params
  return <ChapterReviewRoute weekStart={decodeURIComponent(weekStart)} />
}
