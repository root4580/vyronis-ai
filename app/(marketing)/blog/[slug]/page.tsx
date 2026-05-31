import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Clock } from "lucide-react"
import { BLOG_POSTS, getBlogPost } from "@/lib/marketing/blog-posts"
import { APP_NAME } from "@/lib/branding"
import { canonicalPath } from "@/lib/site-url"

type PageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) return {}

  return {
    title: post.title,
    description: post.description,
    keywords: post.tags,
    alternates: { canonical: canonicalPath(`/blog/${post.slug}`) },
    openGraph: {
      title: post.title,
      description: post.description,
      url: canonicalPath(`/blog/${post.slug}`),
      type: "article",
      publishedTime: post.publishedAt,
    },
    robots: { index: true, follow: true },
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) notFound()

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-white/[0.06] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-cyan-glow"
          >
            <ArrowLeft className="size-3.5" />
            Journal
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/70">
          <time dateTime={post.publishedAt}>
            {new Date(post.publishedAt).toLocaleDateString("en-US", {
              month: "long",
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
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{post.description}</p>

        <div className="prose prose-invert mt-10 max-w-none space-y-4">
          {post.body.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="text-[15px] leading-relaxed text-foreground/85">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-cyan-glow/20 bg-cyan-glow/[0.05] p-6 text-center">
          <p className="font-semibold">Try Vyronis scoring on your next setup</p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Free during closed beta — journal, War Room, and analytics included.
          </p>
          <Link
            href="/auth/sign-up"
            className="mt-4 inline-flex text-sm font-medium text-cyan-glow hover:underline"
          >
            Create free account →
          </Link>
        </div>
      </article>

      <footer className="border-t border-white/[0.06] px-4 py-6 text-center text-[12px] text-muted-foreground/70">
        © {new Date().getFullYear()} {APP_NAME}
      </footer>
    </div>
  )
}
