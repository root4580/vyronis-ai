import { COACH_VERDICT_SCENARIOS } from "@/lib/coach/coach-verdict-scenarios"
import { resolveCoachExecutionVerdict } from "@/lib/coach/coach-execution-verdict"
import {
  buildCoachDecisionView,
  mapFinalVerdictToPrimaryAction,
} from "@/lib/coach/coach-decision-view"

let passed = 0

for (const scenario of COACH_VERDICT_SCENARIOS) {
  const verdict = resolveCoachExecutionVerdict({
    context: scenario.context,
    playbook: scenario.playbook,
    mtf: scenario.mtf,
    discipline: scenario.discipline,
    now: scenario.now,
  })
  const view = buildCoachDecisionView({
    verdict,
    mtf: scenario.mtf,
    context: scenario.context,
  })

  const expectedAction =
    scenario.expectedVerdict === "A_PLUS_READY"
      ? "TAKE"
      : scenario.expectedVerdict === "WAIT_FOR_CONFIRMATION" ||
          scenario.expectedVerdict === "COACH_WARNING"
        ? "WAIT"
        : "SKIP"

  const actionOk = view.primaryAction === expectedAction
  const factorsOk = view.decisionFactors.length === 7
  const nextActionOk = view.nextAction.length > 0

  const ok = actionOk && factorsOk && nextActionOk
  if (ok) passed += 1

  console.log(
    `${ok ? "PASS" : "FAIL"} — ${scenario.name}: ${view.primaryAction} (${mapFinalVerdictToPrimaryAction(verdict.finalVerdict)})`,
  )
  if (!actionOk) {
    console.log(`  expected action ${expectedAction}, got ${view.primaryAction}`)
  }
  if (!factorsOk) {
    console.log(`  expected 7 decision factors, got ${view.decisionFactors.length}`)
  }
}

console.log(`\n${passed}/${COACH_VERDICT_SCENARIOS.length} coach decision view checks passed`)
if (passed !== COACH_VERDICT_SCENARIOS.length) {
  process.exit(1)
}
