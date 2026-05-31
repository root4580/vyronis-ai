const day = Number(process.argv[2] ?? "1")

if (!Number.isFinite(day) || day < 1 || day > 30) {
  console.log("\n🥋 Usage: npm run day -- <1-30>\n")
  process.exit(1)
}

const pad = String(day).padStart(2, "0")
const prog = `programming/day-${pad}/lesson.md`
const linux = `linux/day-${pad}/lesson.md`

console.log(`
╔══════════════════════════════════════╗
║     VYRONIS DOJO — DAY ${String(day).padEnd(2)}              ║
╚══════════════════════════════════════╝

Schedule today (3h):
  • 2h → ${prog}
  • 1h → ${linux}

Start programming:
  npx tsx programming/day-${pad}/exercises/01-hello.ts

When finished:
  npm run check:day -- ${day}
  Update PROGRESS.md

Have fun. No boredom — only bosses.
`)
