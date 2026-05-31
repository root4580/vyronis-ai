import Link from "next/link"
import { ArrowLeft, ArrowRight, Clock } from "lucide-react"
import { BLOG_POSTS } from "@/lib/marketing/blog-posts"
import { APP_NAME } from "@/lib/branding"

export default function BlogIndexPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-white/[0.06] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-cyan-glow"
          >
            <ArrowLeft className="size-3.5" />
            {APP_NAME}
          </Link>
          <Link href="/auth/sign-up" className="text-[12px] font-medium text-cyan-glow hover:underline">
            Start free beta
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-glow/80">
          Vyronis Journal
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Trading discipline &amp; journal insights</h1>
        <p className="mt-3 text-muted-foreground">
          Guides on AI trade journaling, smart money concepts, and Precision Flow setup review.
        </p>

        <div className="mt-10 space-y-4">
          {BLOG_POSTS.map((post) => (
            <article
              key={post.slug}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 transition-colors hover:border-cyan-glow/20"
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/70">
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  {post.readMinutes} min read
                </span>
              </div>
              <h2 className="mt-2 text-lg font-semibold">
                <Link href={`/blog/${post.slug}`} className="hover:text-cyan-glow">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                {post.description}
              </p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-cyan-glow hover:underline"
              >
                Read article
                <ArrowRight className="size-3.5" />
              </Link>
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}
