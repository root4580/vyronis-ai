export type BlogPost = {
  slug: string
  title: string
  description: string
  publishedAt: string
  readMinutes: number
  tags: string[]
  body: string[]
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "ai-trade-journal-smart-money-concepts",
    title: "How to Journal Smart Money Concepts Trades with AI Scoring",
    description:
      "A practical framework for logging SMC setups with HTF bias, AOI, confirmation, and automated A+/Skip grades — without turning your journal into noise.",
    publishedAt: "2026-05-28",
    readMinutes: 6,
    tags: ["AI trade journal", "smart money concepts", "trade scoring"],
    body: [
      "Most trading journals fail because they capture outcomes, not process. Smart money concepts traders need structure: weekly bias, daily structure, H4 confirmation, and a clear area of interest before entry.",
      "Vyronis treats every setup as a scored decision. Before you risk capital, Plan mode walks through HTF alignment, AOI quality, confirmation type, entry timing, emotion state, and minimum risk-reward.",
      "The AI layer does not replace your edge — it enforces discipline. Hard skip rules block revenge and impulsive entries. Grades A+ through Skip give you a desk-style verdict with one improvement to focus on.",
      "After the trade, Log mode captures result and P&L fast — especially on mobile — while keeping optional setup fields for post-trade review.",
      "If you are building consistency as a funded or independent trader, the goal is not more notes. It is repeatable review. Score the setup, log the result, review the leak.",
    ],
  },
  {
    slug: "precision-flow-pre-trade-checklist",
    title: "Precision Flow: A Pre-Trade Checklist for Forex and Gold",
    description:
      "Weekly → Daily → H4 alignment, AOI, structure confirmation, emotion gate, and 1:2 R:R minimum — the Precision Flow framework serious traders use before every entry.",
    publishedAt: "2026-05-25",
    readMinutes: 5,
    tags: ["forex journal", "gold trading", "trading discipline"],
    body: [
      "Precision Flow is Vyronis's structured setup framework. It mirrors how institutional desks review risk: context first, location second, confirmation third, execution last.",
      "Step one is HTF bias alignment across weekly, daily, and H4. Trading against higher-timeframe structure is the fastest way to bleed accounts — Vyronis flags missing alignment as a hard skip.",
      "Step two is your area of interest: supply, demand, or liquidity pool. A setup without a defined AOI is speculation, not a plan.",
      "Step three is confirmation — CHoCH, BOS, or retest at the AOI. Step four is the gate: calm emotion state and at least 1:2 risk-reward. Below 1:2 triggers a warning even when other criteria pass.",
      "Use this checklist before every entry. Vyronis automates it in Plan mode so you stop negotiating with yourself at the chart.",
    ],
  },
  {
    slug: "prop-firm-trading-discipline-journal",
    title: "Prop Firm Trading: Why Discipline Beats More Indicators",
    description:
      "Funded traders lose accounts on process — not strategy. How Vyronis enforces daily limits, emotion gates, and A+ setup review before every entry.",
    publishedAt: "2026-05-22",
    readMinutes: 5,
    tags: ["prop firm trading", "trading discipline", "funded trader"],
    body: [
      "Prop firm challenges fail for one reason: traders know the rules but break them under pressure. More indicators do not fix revenge trades, oversizing, or skipping the weekly plan.",
      "Vyronis treats discipline as infrastructure. Plan mode scores every setup before entry. Hard skip rules block impulsive and revenge states. War Room forces Sunday context before Monday execution.",
      "Analytics surfaces leaks — session timing, emotion patterns, setups below 1:2 R:R — so review is data-driven, not emotional.",
      "If you are on a funded account or challenge, your edge is only as good as your process. Vyronis is built to protect that process when willpower fails.",
    ],
  },
]

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug)
}
