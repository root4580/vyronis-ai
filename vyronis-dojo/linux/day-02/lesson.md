# Day 2 — Linux Dojo (1 hour)

## Skills today

1. **Paths** — absolute `/Users/...` vs relative `programming/day-01`  
2. **Create & read files** — `mkdir` · `touch` · `cat`

## Exercise — Build your dojo desk (30 min)

```bash
cd ~/Downloads/vyronis-ai-dashboard/vyronis-dojo
mkdir -p ~/dojo-desk/notes
touch ~/dojo-desk/notes/day-02.txt
echo "Linux skill: mkdir touch cat" >> ~/dojo-desk/notes/day-02.txt
cat ~/dojo-desk/notes/day-02.txt
```

## Boss (10 min)

Create `~/dojo-desk/BOSS.txt` containing exactly the word `DAY2` using only `echo` and `>>`.

## Learn

- What happens if you `cat` a folder? (try `cat .` — read the error, it's teaching you)

Tomorrow: `grep` and pipes — Linux starts feeling like magic.
