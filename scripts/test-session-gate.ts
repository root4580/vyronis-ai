import { evaluateSessionGate, estWallInstant } from "@/lib/coach/session-gate"

const LONDON_TUESDAY_10 = estWallInstant("2026-06-10", 10, 0)
const TUESDAY_2130 = estWallInstant("2026-06-10", 21, 30)

const cases = [
  {
    name: "London hours, logged London",
    input: { loggedSession: "London", now: LONDON_TUESDAY_10 },
    expectValid: true,
  },
  {
    name: "London hours, no logged session",
    input: { loggedSession: null, now: LONDON_TUESDAY_10 },
    expectValid: true,
  },
  {
    name: "After hours Asia, logged mismatch",
    input: { loggedSession: "Asian", now: TUESDAY_2130 },
    expectValid: false,
  },
  {
    name: "London hours, logged Sydney conflicts",
    input: { loggedSession: "Sydney", now: LONDON_TUESDAY_10 },
    expectValid: false,
  },
]

let passed = 0
console.log("\nSession gate unit checks\n")
for (const testCase of cases) {
  const result = evaluateSessionGate(testCase.input)
  const ok = result.passed === testCase.expectValid
  if (ok) passed += 1
  console.log(`${ok ? "PASS" : "FAIL"} — ${testCase.name}`)
  console.log(`  Time: ${result.debug.currentTimeLabel}`)
  console.log(`  Detected: ${result.debug.detectedSession}`)
  console.log(`  Valid: ${result.debug.sessionValid ? "✅" : "❌"}`)
  if (result.debug.failureReason) console.log(`  Reason: ${result.debug.failureReason}`)
}

console.log(`\n${passed}/${cases.length} passed\n`)
if (passed !== cases.length) process.exitCode = 1
