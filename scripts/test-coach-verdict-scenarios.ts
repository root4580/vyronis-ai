import {
  COACH_VERDICT_SCENARIOS,
  buildPrecisionFlowForScenario,
} from "@/lib/coach/coach-verdict-scenarios"
import {
  resolveCoachExecutionVerdict,
  type CoachFinalVerdict,
} from "@/lib/coach/coach-execution-verdict"

type ScenarioResult = {
  id: number
  name: string
  passed: boolean
  expected: CoachFinalVerdict
  actual: CoachFinalVerdict
  label: string
  progress: string
  blockMessage: string | null
  mentorLine: string
}

function verdictMatches(
  actual: CoachFinalVerdict,
  expected: CoachFinalVerdict,
  acceptable?: CoachFinalVerdict[],
): boolean {
  if (actual === expected) return true
  return acceptable?.includes(actual) ?? false
}

function runScenario(
  scenario: (typeof COACH_VERDICT_SCENARIOS)[number],
): ScenarioResult {
  const precisionFlow = buildPrecisionFlowForScenario(scenario)
  const verdict = resolveCoachExecutionVerdict({
    context: {
      ...scenario.context,
      mtf_analysis: scenario.mtf,
      playbook_match: scenario.playbook,
    },
    mtf: scenario.mtf,
    playbook: scenario.playbook,
    precisionFlow,
    discipline: scenario.discipline,
  })

  const passed = verdictMatches(
    verdict.finalVerdict,
    scenario.expectedVerdict,
    scenario.acceptableVerdicts,
  )

  return {
    id: scenario.id,
    name: scenario.name,
    passed,
    expected: scenario.expectedVerdict,
    actual: verdict.finalVerdict,
    label: verdict.finalVerdictLabel,
    progress: verdict.entryGate.progressLabel,
    blockMessage: verdict.entryGate.blockMessage,
    mentorLine: verdict.mentorLine,
  }
}

function main() {
  const results = COACH_VERDICT_SCENARIOS.map(runScenario)
  const passedCount = results.filter((result) => result.passed).length

  console.log("\nVyronis Coach — Entry Gate Scenario Tests\n")
  console.log("=".repeat(72))

  for (const result of results) {
    const status = result.passed ? "PASS" : "FAIL"
    console.log(`\nCase ${result.id}: ${result.name}`)
    console.log(`  Status:   ${status}`)
    console.log(`  Expected: ${result.expected}`)
    console.log(`  Actual:   ${result.actual} (${result.label})`)
    console.log(`  Progress: ${result.progress}`)
    if (result.blockMessage) {
      console.log(`  Block:    ${result.blockMessage}`)
    }
    console.log(`  Mentor:   ${result.mentorLine}`)
  }

  console.log("\n" + "=".repeat(72))
  console.log(`\nResult: ${passedCount}/${results.length} scenarios passed\n`)

  if (passedCount !== results.length) {
    process.exitCode = 1
  }
}

main()
