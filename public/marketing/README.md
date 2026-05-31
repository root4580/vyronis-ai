# Marketing screenshots

Drop PNG or WebP files here. The landing page uses them automatically when present.

| File | What to capture |
|------|-----------------|
| `journal-plan.png` | `/hq?tab=journal` → Add Trade → **Plan** tab (with Vyronis score visible) |
| `war-room.png` | `/war-room` — weekly bias + watchlist |
| `analytics.png` | `/analytics` — charts / weekly review |
| `ai-coach.png` | `/hq` with AI Coach open — SKIP verdict + chart analysis visible |
| `weekly-debrief.png` | `/hq?tab=journal` — Weekly AI Debrief scorecard |
| `behavioral-leak.png` | `/hq` — Primary Behavioral Leak card |
| `hero-dashboard.png` | Optional hero image (defaults to `ai-coach.png`) |

## How to capture (Mac)

1. Run the app: `npm run dev` or use https://vyronishq.com
2. Sign in and open each page above
3. Hide browser bookmarks bar (Cmd+Shift+B)
4. Use **Cmd+Shift+4**, then **Space**, click the browser window — or drag a tight crop around the UI
5. Rename screenshots to match the table and move them into this folder
6. Commit and push — Vercel redeploys automatically

**Tips:** Use dark mode, 1440px window width, real (or demo) data that looks polished. Avoid personal emails in the profile card.
