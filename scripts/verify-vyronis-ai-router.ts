/**
 * Quick local check: npx tsx scripts/verify-vyronis-ai-router.ts
 * Uses mock responses when API keys are absent.
 */
import { runVyronisAI, getConfiguredVyronisAIProviders } from "../lib/ai/ai-router"

async function main() {
  const configured = getConfiguredVyronisAIProviders()
  console.log("Configured providers:", configured.length ? configured.join(", ") : "(none — mocks)")

  const result = await runVyronisAI({
    taskType: "trading_setup_grading",
    prompt: "Grade NZDJPY BUY breakout against weekly War Room plan.",
    data: { pair: "NZDJPY", direction: "BUY", aoi_status: "CONFIRMING" },
  })

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
