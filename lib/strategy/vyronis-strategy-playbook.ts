import { rule } from "@/lib/strategy/playbook-rule-utils"
import type { StrategyPlaybookInput } from "@/lib/strategy/types"

/** Canonical unified strategy (Vyronis + trader doctrine). */
export const VYRONIS_STRATEGY_NAME = "Multi-Timeframe FX Continuation Setup"

/** Legacy name — still matched when consolidating duplicate playbooks. */
export const LEGACY_STRATEGY_NAMES = [
  "Top-Down AOI Strategy",
  "Strategy 2",
  "Strategy 3",
] as const

export const VYRONIS_STRATEGY_DESCRIPTION =
  "Discretionary forex continuation: top-down Weekly → Daily → H4 bias, Sunday 3–5 pair focus list, " +
  "pre-defined AOI only, H1 setup + M15 confirmation (break/retest or LTF structure shift). " +
  "Small number of A-grade setups — no touch-and-go entries, no chase, no forced RR."

/** Full strategy document for coach / War Room context (plain text). */
export const STRATEGY_FULL_DOCUMENT = `
STRATEGY NAME
Multi-Timeframe FX Continuation Setup

OVERVIEW
Discretionary forex setup based on top-down alignment across Weekly, Daily, and H4. Select 3–5 pairs every Sunday; monitor through the week; trade only when price reaches a planned AOI and confirms continuation (structure, momentum, clear invalidation).

MARKET UNIVERSE
- Forex pairs only
- Weekly focus: 3–5 pairs selected Sunday
- Only aligned pairs are traded that week

CORE IDEA
Trade in the direction of HTF bias after price reaches a planned AOI and confirms via LTF behavior (break/retest, structure shift, momentum, EMA confluence).

TOP-DOWN PROCESS (Every Sunday)
- Scan pairs; select 3–5 aligned with weekly directional idea
- Mark HTF structure and key AOI
- Build weekly thesis; wait for price at AOI during the week

HIGHER TIMEFRAME (Required)
- Weekly bias aligned
- Daily aligned
- H4 aligned
If any TF clearly conflicts → invalid.

AREA OF INTEREST
Price must reach pre-defined AOI before entry: S/R, supply/demand, pullback into structure, discount/premium within thesis. No AOI touch → no trade.

ENTRY (All required)
- AOI reached
- Break/retest confirmed OR LTF structure shift in trade direction
- Momentum confirmation visible
- EMA as supporting confluence (H1/M15)
- Not late or overextended
- Clear invalidation and acceptable R:R

INVALIDATION
- HTF misalignment
- AOI not reached
- No clear break/retest or LTF shift
- Weak/unclear momentum
- Late/chased entry
- Unclear stop or poor R:R
- Major news risk
- Unstable emotion / FOMO / impatience

STOP / TARGET
- SL beyond structure that invalidates the idea — not arbitrary
- TP: next structure, opposing liquidity, logical continuation within weekly thesis
- Minimum R:R enforced before entry

TRADE MANAGEMENT
- Enter only after confirmation; do not chase
- Do not widen stop after entry
- Let original thesis guide management; accept loss if invalidated

PSYCHOLOGY (Pre-entry)
- Emotion stable, no FOMO, patience maintained — else no trade

SETUP GRADES
A: All conditions clearly met
B: Core met, 1–2 borderline items — acceptable not ideal
C: One required condition stretched — likely skip
D: Rule break / emotional / forced
Borderline rule: 2+ borderline items → pass

EXECUTION STANDARD
Few high-quality MTF-aligned setups at planned locations — not high trade count.

FINAL RULE
If confirmation, invalidation, or process is unclear → skip.
`.trim()

export function createVyronisStrategyPlaybookInput(): StrategyPlaybookInput {
  return {
    strategy_name: VYRONIS_STRATEGY_NAME,
    description: VYRONIS_STRATEGY_DESCRIPTION,
    bias_rules: {
      weekly_bias: rule(
        "weekly_bias",
        "Weekly macro bias set Sunday (bullish/bearish/range) with structure + key S/R or S/D marked",
        true,
      ),
      daily_bias: rule(
        "daily_bias",
        "Daily aligns with Weekly — continuation or valid pullback within weekly thesis",
        true,
      ),
      h4_structure: rule(
        "h4_structure",
        "H4 structure supports direction (BOS/CHOCH) with valid AOI — zone, mitigation, or retest",
        true,
      ),
      htf_alignment: rule(
        "htf_alignment",
        "Weekly, Daily, and H4 agree — any clear HTF conflict invalidates the trade",
        true,
      ),
    },
    entry_rules: {
      h1_setup: rule(
        "h1_setup",
        "H1 setup at planned AOI — clean break/retest, pullback into structure, or LTF shift supporting H4",
        true,
      ),
      m15_confirmation: rule(
        "m15_confirmation",
        "M15 confirmation required — break/retest or structure shift; no entry on touch alone",
        true,
      ),
      aoi_supply_demand: rule(
        "aoi_supply_demand",
        "Price reached pre-defined AOI (S/R, supply/demand, discount/premium in thesis) — no AOI = no trade",
        true,
      ),
      break_and_retest: rule(
        "break_and_retest",
        "Break and retest confirmed at AOI OR clear lower-TF structure shift in trade direction",
        true,
      ),
      ema_alignment: rule(
        "ema_alignment",
        "EMA stack supports direction on H1/M15 as secondary confluence (not sole trigger)",
      ),
      liquidity_sweep: rule(
        "liquidity_sweep",
        "Liquidity sweep / stop hunt at AOI preferred before continuation entry",
      ),
      candle_confirmation: rule(
        "candle_confirmation",
        "Momentum candle / expansion in intended direction with M15 close confirmation",
        true,
      ),
    },
    invalidation_rules: {
      countertrend_warning: rule(
        "countertrend_warning",
        "Countertrend vs Weekly/Daily/H4 bias — stand down",
        true,
      ),
      no_confirmation_warning: rule(
        "no_confirmation_warning",
        "No break/retest, LTF shift, or M15 momentum confirmation at AOI",
        true,
      ),
      early_entry_warning: rule(
        "early_entry_warning",
        "Early, late, chased, or extended entry — price not at planned AOI or confirmation forced",
        true,
      ),
      custom: [
        "Weekly, Daily, or H4 clearly conflicts with trade direction",
        "Price has not reached the planned area of interest",
        "Entry taken only because price touched a level — no confirmation",
        "Momentum weak, unclear, or against intended direction",
        "Stop placement unclear or arbitrary — if invalidation unclear, no trade",
        "Risk-to-reward poor, forced, or below minimum",
        "Major news creates elevated risk",
        "Emotional state unstable, FOMO, revenge, or impatience",
        "Two or more borderline checklist items (pass on the trade)",
        "Entering after displacement / impulse without fresh confirmation",
        "H1 structure messy or choppy — no clean continuation setup",
        "Pair not on Sunday focus list or not aligned with weekly thesis",
        "Widening stop or emotional management after entry",
      ],
    },
    confluence_rules: {
      items: [
        rule("htf_bias", "Weekly + Daily + H4 directional permission aligned"),
        rule("sunday_focus", "Pair on Sunday 3–5 focus list with weekly thesis and AOI marked"),
        rule("aoi_reaction", "Reaction from planned AOI — not anticipatory"),
        rule("ltf_trigger", "M15 trigger: break/retest or structure shift with candle close"),
        rule("momentum", "Momentum confirmation visible in trade direction"),
        rule("ema_support", "EMA confluence supports direction (secondary)"),
        rule("clear_sl", "Stop beyond structure that invalidates idea — logically placed"),
        rule("acceptable_rr", "Reward justifies risk before entry — else skip"),
        rule("psychology_clear", "Emotion stable, no FOMO, patience maintained"),
      ],
    },
    forbidden_conditions: {
      items: [
        "Trading a pair not on the weekly focus list or against Sunday thesis",
        "Entering before price reaches planned AOI",
        "Entering on AOI touch without break/retest or LTF shift",
        "Trading against Weekly, Daily, or H4 bias",
        "Late, chased, or overextended entry",
        "Unclear stop loss or invalidation",
        "Risk-to-reward below minimum or forced",
        "Major news window without adjusted plan",
        "FOMO, revenge, impatience, or unstable emotion",
        "Widening stop loss after entry",
        "Forcing management based on emotion vs original thesis",
        "Grade C/D execution or two+ borderline items taken anyway",
        "High trade count / low-quality repetition vs few A/B setups",
      ],
    },
    rr_minimum: 2,
    example_notes: {
      winner_notes:
        "Grade A/B: Sunday pair aligned, W/D/H4 agree, price at planned AOI, H1 break/retest or LTF shift, " +
        "M15 momentum + close confirmation, EMA support, clear SL beyond invalidation, TP at logical structure, " +
        "R:R ≥ minimum. Process followed regardless of outcome.",
      loser_notes:
        "Grade C/D or strategy loss: HTF conflict, AOI not reached, touch-only entry, weak momentum, chased/late entry, " +
        "unclear SL, poor R:R, news ignored, emotional/FOMO entry, or 2+ borderline items rationalized. " +
        "Review: valid strategy loss vs execution loss; what to repeat vs tighten next week.",
    },
    is_default: true,
  }
}

/** Names treated as the same canonical playbook during merge. */
export function isCanonicalStrategyName(name: string): boolean {
  const n = name.trim().toLowerCase()
  if (n === VYRONIS_STRATEGY_NAME.toLowerCase()) return true
  return LEGACY_STRATEGY_NAMES.some((legacy) => legacy.toLowerCase() === n)
}
