# Day 1 — Programming Dojo (2 hours)

## Today's skills

1. **Instructions** — programs run top → bottom, one step at a time  
2. **Variables** — named boxes that hold data

**Belt XP:** 100 per skill if exercises pass.

---

## Skill 1: Instructions & `console.log` (40 min)

### Explain

A program is a **recipe**. The computer follows lines **in order**.

`console.log("hello")` means: **show this in the terminal** when we run the file with Node.

### Show

Open `exercises/01-hello.ts` — it has one line. Run:

```bash
cd vyronis-dojo
npx tsx programming/day-01/exercises/01-hello.ts
```

You should see: `Welcome to the Dojo, warrior.`

### Try

Change the message to **your name**. Run again. **You just programmed.**

---

## Skill 2: Variables & types (50 min)

### Explain

A **variable** is a label on a box.

```ts
const name = "Alex"   // string (text)
let level = 1         // number
let isReady = true    // boolean
```

- `const` = don't reassign the box (use by default)  
- `let` = you may change the value later  
- **Type** = what kind of data (text, number, true/false)

### Show

Run `02-variables.ts` — read the output. Then open the file and see how boxes feed `console.log`.

### Exercise file

Edit `03-your-stats.ts` — follow the `TODO` comments. **Do not open `solutions/` until you tried.**

Check:

```bash
npm run check:day -- 1
```

---

## Mini-project (30 min) — "Dojo ID Card"

In `04-id-card.ts`, fill in variables so the output looks like:

```
=== DOJO ID ===
Name: (you)
Rank: White Belt
HP: 100
================
```

Run it. Smile. Screenshot optional.

---

## Boss fight (10 min)

Without looking at solutions, add **one more line** to `04-id-card.ts` that prints a motto you invent.

---

## When done

1. `npm run check:day -- 1`  
2. Check boxes in `PROGRESS.md`  
3. Reply to your sensei (Chat): paste output of `03-your-stats.ts`

**Tomorrow:** strings + `if` statements — your code will make decisions.
