import Link from "next/link"
import { ArrowRight, Clock } from "lucide-react"
import { BLOG_POSTS } from "@/lib/marketing/blog-posts"

export function BlogTeaserSection() {
  const posts = BLOG_POSTS.slice(0, 2)

  return (
    <section id="journal-insights" className="border-t border-white/[0.06] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-glow/80">
              Vyronis Journal
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Guides for disciplined traders
            </h2>
            <p className="mt-2 max-w-xl text-[13px] text-muted-foreground">
              SEO articles on AI trade journaling, smart money concepts, and Precision Flow — written
              for funded and independent traders.
            </p>
          </div>
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-cyan-glow hover:underline"
          >
            View all articles
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {posts.map((post) => (
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
              <h3 className="mt-2 text-lg font-semibold leading-snug">
                <Link href={`/blog/${post.slug}`} className="hover:text-cyan-glow">
                  {post.title}
                </Link>
              </h3>
              <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">
                {post.description}
              </p>
              <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-foreground/70">
                {post.body[0]}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] text-muted-foreground/80"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-cyan-glow hover:underline"
              >
                Read full article
                <ArrowRight className="size-3.5" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
