# Vyronis AI

AI-powered trading intelligence platform for serious funded traders. Track psychology, discipline, and execution with institutional-grade analytics, trade coaching, and weekly debriefs.

**Production (LIVE):** [vyronis-ai.vercel.app](https://vyronis-ai.vercel.app) · QA checklist: [`docs/PRODUCTION-QA-LAUNCH.md`](docs/PRODUCTION-QA-LAUNCH.md)

## Features

- Trading journal with P&L, win rate, and equity analytics
- AI trade coach with chart vision and multi-timeframe analysis
- Strategy playbooks with rule-based scoring
- Weekly debriefs and learning memory
- Supabase auth with per-user data isolation

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
