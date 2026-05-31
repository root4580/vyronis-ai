# Vyronis Dojo

**3 hours/day. 2 programming skills. 1–2 Linux skills. Zero boredom policy.**

You are not “watching tutorials.” You are leveling up in a game where the final boss is **Vyronis production** and, later, **any codebase you touch**.

## Daily schedule (3 hours)

| Block | Time | What |
|-------|------|------|
| **Programming Dojo** | **2h** | Read lesson → type exercises → run checks → optional mini-project |
| **Linux Dojo** | **1h** | Read lesson → terminal challenges → boss command |

**Rule:** No skipping exercises. Reading without typing = XP lost.

## How to start each day

```bash
cd vyronis-dojo
npm install          # once
npm run day -- 1     # prints today's path + checks when done
```

Then open:

- `programming/day-01/lesson.md`
- `linux/day-01/lesson.md`

## Belt system

| Belt | Days | You can… |
|------|------|----------|
| White | 1–7 | Terminal, variables, files, git basics |
| Yellow | 8–14 | Functions, loops, pipes, permissions |
| Orange | 15–21 | Objects, APIs, processes, SSH |
| Green | 22–30 | Build a tiny app + deploy + debug like a pro |

Track belts in [`PROGRESS.md`](./PROGRESS.md).

## Folder map

```
vyronis-dojo/
├── README.md              ← you are here
├── PROGRESS.md            ← streaks, belts, checkbox glory
├── curriculum/30-day-map.md
├── programming/day-XX/    ← 2 skills per day
├── linux/day-XX/
└── scripts/               ← auto-check your work
```

## Fun rules

1. **Nickname your terminal** — prompt is `dojo$` in lessons (cosmetic, optional).
2. **Boss fights** are timed challenges — fail, retry, no shame.
3. **No copy-paste from solutions** until you tried 15 minutes — then peek one hint.
4. **End of day:** one sentence in `PROGRESS.md` — what clicked today?

## After 30 days

You merge skills back into **Vyronis HQ**: read real files, fix real bugs, ship real features.

---

**Start now:** Day 1 → `programming/day-01/lesson.md` + `linux/day-01/lesson.md`
