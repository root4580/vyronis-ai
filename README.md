# Vyronis HQ

**Vyronis AI** prop trading command center for serious funded traders. Track psychology, discipline, and execution with War Room planning, setup alerts, coach, **Vyronis journal intelligence**, and weekly debriefs.

**Production (LIVE):** [vyronishq.com](https://vyronishq.com) · QA checklist: [`docs/PRODUCTION-QA-LAUNCH.md`](docs/PRODUCTION-QA-LAUNCH.md)

## Features

- Trading journal with P&L, win rate, and equity analytics
- **Vyronis AI** trade coach with chart vision and multi-timeframe analysis
- **Vyronis Core Model** strategy playbooks with **Vyronis strategy scoring**
- **Vyronis journal intelligence** — pattern memory and trade-level learning
- Weekly debriefs and learning memory
- Supabase auth with per-user data isolation

## Intelligence docs

- [`docs/VYRONIS-CORE-MODEL.md`](docs/VYRONIS-CORE-MODEL.md) — Vyronis Core Model doctrine & scoring
- [`docs/JOURNAL-INTELLIGENCE.md`](docs/JOURNAL-INTELLIGENCE.md) — Vyronis journal intelligence workflow
- [`docs/STRATEGY-BRAIN.md`](docs/STRATEGY-BRAIN.md) — Strategy Brain UI & evaluate API

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill in your keys:

   ```bash
   cp .env.example .env.local
   ```

3. Run database migrations in order — see [`supabase/MIGRATION_ORDER.md`](supabase/MIGRATION_ORDER.md).

4. Start the development server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

See [`.env.example`](.env.example) for the full list. At minimum you need:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `AI_PROVIDER` and the matching provider API key

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Start development server |
| `npm run build`| Production build         |
| `npm run start`| Start production server  |
| `npm run lint` | Run ESLint               |
