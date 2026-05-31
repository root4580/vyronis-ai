# Day 1 — Linux Dojo (1 hour)

## Today's skills

1. **The terminal is a place** — you type commands, computer answers  
2. **Navigation** — `pwd` · `ls` · `cd`

**Metaphor:** Terminal = texting your Mac **as admin**. No mouse needed. Feels hacker; actually just efficient.

---

## Skill 1: Terminal exists (15 min)

### Explain

- **GUI** (icons, Chrome) = restaurant menu with pictures  
- **CLI** (Terminal) = same kitchen, verbal orders — faster when you know the words  

**Shell** = the program that reads your commands (on Mac, usually **zsh**).

**Prompt** looks like:

```
yourname@MacBook vyronis-dojo %
```

You type after it. Press **Enter** to send.

### Show

Open **Terminal** (Spotlight → `Terminal`).

```bash
whoami
date
echo "I control the shell"
```

Each line is one **command**. Order matters if you use output later (tomorrow).

---

## Skill 2: Navigation (35 min)

| Command | What it does | Memory trick |
|---------|--------------|--------------|
| `pwd` | **P**rint **w**orking **d**irectory (where am I?) | "Where am I?" |
| `ls` | **L**i**s**t files here | "What's here?" |
| `cd folder` | **C**hange **d**irectory | "Go into room" |
| `cd ..` | Go up one level | "Leave room" |
| `cd ~` | Go home | `~` = your house |

### Exercise A — The maze (copy one block at a time)

```bash
cd ~/Downloads/vyronis-ai-dashboard/vyronis-dojo
pwd
ls
ls programming
cd programming/day-01/exercises
ls
pwd
cd ../../../linux/day-01
pwd
ls
cd ~
pwd
```

**Expected:** `pwd` always shows a path that makes sense; `ls` shows files you recognize (`lesson.md`, etc.).

### Exercise B — Flags (spice level)

```bash
ls -l          # long format (permissions, size)
ls -la         # include hidden dot files
ls -lh         # human-readable sizes
```

Don't memorize everything. Notice: **`-l`** = more detail.

---

## Boss fight (10 min) — "Find the sensei"

Timer: **90 seconds**. No Google.

Starting from `~`:

1. Land in `vyronis-dojo/programming/day-01/exercises`  
2. Run `ls` and confirm you see `01-hello.ts`  
3. Run: `echo "BOSS_CLEAR" >> ~/dojo-boss-day1.txt`  
4. `cat ~/dojo-boss-day1.txt` — must show `BOSS_CLEAR`  

If you create the file in the wrong place, `rm ~/dojo-boss-day1.txt` and retry.

---

## Fun challenge (optional)

```bash
touch ~/dojo-trophy.txt
echo "Day 1 — $(date)" >> ~/dojo-trophy.txt
cat ~/dojo-trophy.txt
```

You left a **trophy file** on your machine. Real Linux users do this with logs and scripts.

---

## When done

- [ ] I can explain `pwd` vs `ls` vs `cd` out loud  
- [ ] Boss file created  
- [ ] Check Linux box in `PROGRESS.md`

**Tomorrow:** create folders & files with `mkdir` `touch` `cat` — you'll build a "dojo" on disk.
