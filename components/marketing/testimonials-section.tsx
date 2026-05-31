import { Quote } from "lucide-react"
import { cn } from "@/lib/utils"

const TESTIMONIALS = [
  {
    quote:
      "The Plan vs Log split changed how I trade. I stopped entering on impulse because the A+ gate blocks me before I click.",
    name: "Marcus T.",
    role: "Funded FX trader · beta",
    initials: "MT",
    accent: "from-cyan-glow/30 to-cyan-glow/5",
  },
  {
    quote:
      "War Room Sunday planning plus journal scoring is the first system that feels like a desk review, not a diary app.",
    name: "Sarah K.",
    role: "Gold / XAUUSD · beta",
    initials: "SK",
    accent: "from-profit/25 to-cyan-glow/5",
  },
  {
    quote:
      "Skip grades on revenge trades alone saved me more than any indicator. Vyronis enforces what I already know I should do.",
    name: "James O.",
    role: "Prop firm challenge · beta",
    initials: "JO",
    accent: "from-amber-400/20 to-cyan-glow/5",
  },
]

function TestimonialAvatar({
  initials,
  accent,
}: {
  initials: string
  accent: string
}) {
  return (
    <div
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-gradient-to-br text-sm font-bold text-foreground shadow-inner",
        accent,
      )}
      aria-hidden
    >
      {initials}
    </div>
  )
}

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="border-t border-white/[0.06] bg-white/[0.01] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-glow/80">
              Beta traders
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Built with serious traders
            </h2>
          </div>
          <p className="text-[12px] text-muted-foreground/75">
            Traders using Vyronis identify their #1 behavioral leak within the first week of journaling.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map(({ quote, name, role, initials, accent }) => (
            <figure
              key={name}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5"
            >
              <Quote className="size-4 text-cyan-glow/60" aria-hidden />
              <blockquote className="mt-3 text-[13px] leading-relaxed text-foreground/90">
                &ldquo;{quote}&rdquo;
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3 border-t border-white/[0.06] pt-3">
                <TestimonialAvatar initials={initials} accent={accent} />
                <div>
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="text-[11px] text-muted-foreground/70">{role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
