import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const day = Number(process.argv[2] ?? "1")
const root = path.join(import.meta.dirname, "..")

function runTsx(file: string): { ok: boolean; out: string } {
  const full = path.join(root, file)
  const r = spawnSync("npx", ["tsx", full], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  })
  const out = (r.stdout ?? "") + (r.stderr ?? "")
  return { ok: r.status === 0, out }
}

function checkDay1(): boolean {
  let pass = true

  const hello = runTsx("programming/day-01/exercises/01-hello.ts")
  if (!hello.ok || !hello.out.includes("Dojo")) {
    console.log("❌ 01-hello.ts — run failed or wrong message")
    pass = false
  } else {
    console.log("✅ 01-hello.ts")
  }

  const statsPath = path.join(root, "programming/day-01/exercises/03-your-stats.ts")
  const statsSrc = readFileSync(statsPath, "utf8")
  if (statsSrc.includes("TODO 1") && !statsSrc.match(/const\s+firstName\s*=/)) {
    console.log("❌ 03-your-stats.ts — finish TODOs (firstName, hoursTrained, isCommitted, TRAIN line)")
    pass = false
  } else {
    const stats = runTsx("programming/day-01/exercises/03-your-stats.ts")
    const line = stats.out.trim().split("\n").pop() ?? ""
    const m = line.match(/^TRAIN:(.+)\|(\d+)\|(true|false)$/)
    if (!stats.ok || !m) {
      console.log("❌ 03-your-stats.ts — output must be: TRAIN:name|hours|true|false")
      console.log("   Got:", line || "(empty)")
      pass = false
    } else {
      console.log("✅ 03-your-stats.ts —", line)
    }
  }

  const idPath = path.join(root, "programming/day-01/exercises/04-id-card.ts")
  const idSrc = readFileSync(idPath, "utf8")
  if (idSrc.includes("CHANGE_ME")) {
    console.log("⚠️  04-id-card.ts — set heroName (optional for check, do it anyway)")
  } else {
    console.log("✅ 04-id-card.ts — name set")
  }

  const bossFile = path.join(process.env.HOME ?? "", "dojo-boss-day1.txt")
  if (!existsSync(bossFile) || !readFileSync(bossFile, "utf8").includes("BOSS_CLEAR")) {
    console.log("❌ Linux boss — create ~/dojo-boss-day1.txt with BOSS_CLEAR (see linux/day-01/lesson.md)")
    pass = false
  } else {
    console.log("✅ Linux Day 1 boss")
  }

  return pass
}

const checks: Record<number, () => boolean> = {
  1: checkDay1,
}

console.log(`\n🥋 Checking Day ${day}...\n`)

const fn = checks[day]
if (!fn) {
  console.log(`Day ${day} auto-check not wired yet — complete lesson + self-check, or ask sensei.\n`)
  process.exit(0)
}

const ok = fn()
console.log(ok ? "\n🏆 DAY COMPLETE — update PROGRESS.md\n" : "\n💪 Not yet — fix items above and rerun.\n")
process.exit(ok ? 0 : 1)
