# Supabase migration order — Vyronis AI

Run migrations in **Supabase → SQL Editor** (or via Supabase CLI if you adopt `supabase db push` later). Each file is idempotent where noted.

## Greenfield (new project)

Run in this exact order:

| # | File | Purpose |
|---|------|---------|
| 1 | `trades-migration.sql` | Base journal table (`trades.id` = **uuid**) |
| 2 | `trade-fields-migration.sql` | Entry/SL/TP/RR/emotion_after/mistakes |
| 2b | `007-setup-score-columns.sql` | A+ setup score + classification on trades |
| 3 | `trade-coach-migration.sql` | Coach sessions, messages, feedback (**uuid** `trade_id`) |
| 4 | `chart-first-coach-migration.sql` | Legacy `chart_url` + `chart_analysis` |
| 5 | `chart-vision-ai-migration.sql` | `screenshot_url`, `vision_score` |
| 6 | `mtf-coach-migration.sql` | MTF screenshot URLs + scores |
| 7 | `visual-analysis-migration.sql` | Vision provider metadata |
| 8 | `chart-annotations-migration.sql` | Annotation overlays |
| 9 | `trade-quality-engine-migration.sql` | Quality scores (any time after #3) |
| 10 | `strategy-playbooks-migration.sql` | Strategy playbooks (any time after #3) |
| 11 | `trade-memory-migration.sql` | Learning tables + FKs |
| 12 | `user-profiles-migration.sql` | Profile + auth trigger |
| 13 | `user-settings-migration.sql` | Settings + auth trigger |
| 14 | `storage-setup.sql` | Screenshot bucket + policies |

Steps **4–8** are optional if you only use text coach (no chart vision). Step **11** requires **3**.

Repair migrations **001–004** are still recommended on greenfield to add audit views, enum CHECKs, and deprecation comments.

## Existing production (already on old bigint coach schema)

Run **all historical migrations** that were already applied (do not re-run CREATE TABLE blocks that already exist), then run repair migrations **in sequence**:

| # | File | When |
|---|------|------|
| **A** | `001-fix-coach-trade-id-uuid.sql` | **First repair** — fixes bigint/uuid mismatch |
| **B** | `002-trade-integrity.sql` | After 001 — FKs, session_id, enum CHECKs |
| **C** | `003-session-json-consolidation.sql` | After 002 — merge JSON into `planned_context` |
| **D** | `004-mark-deprecated-session-columns.sql` | After 003 — deprecation comments only |

**Do not skip order A → B → C → D.**

## Verification queries (after each repair step)

### After 001

```sql
-- All trade_id columns must be uuid
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'trade_id'
ORDER BY table_name;

-- FK constraints must exist
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE conname IN (
  'trade_coach_sessions_trade_id_fkey',
  'trade_coach_feedback_trade_id_fkey'
);

-- Rows still missing links (should be 0 or manually fixed)
SELECT * FROM public.vyronis_trade_id_migration_gaps;
```

### After 002

```sql
SELECT conname FROM pg_constraint
WHERE conname IN ('trade_memory_trade_id_fkey', 'trade_memory_session_id_fkey');

SELECT count(*) AS orphan_memory FROM public.trade_memory tm
WHERE NOT EXISTS (SELECT 1 FROM public.trades t WHERE t.id = tm.trade_id);

SELECT * FROM public.vyronis_trades_enum_violations;

SELECT count(*) AS memory_with_session
FROM public.trade_memory WHERE session_id IS NOT NULL;
```

### After 003

```sql
-- Should trend toward 0 after merge
SELECT count(*) FROM public.vyronis_session_json_drift;

-- Spot-check one linked session
SELECT id, planned_context ? 'chart_analysis' AS has_chart_analysis
FROM public.trade_coach_sessions
WHERE trade_id IS NOT NULL
LIMIT 5;
```

### After 004

```sql
SELECT col.column_name, pgd.description
FROM pg_catalog.pg_statio_all_tables AS st
JOIN information_schema.columns AS col
  ON col.table_schema = st.schemaname AND col.table_name = st.relname
LEFT JOIN pg_catalog.pg_description AS pgd
  ON pgd.objoid = st.relid AND pgd.objsubid = col.ordinal_position
WHERE st.schemaname = 'public'
  AND st.relname = 'trade_coach_sessions'
  AND col.column_name IN ('chart_url', 'chart_analysis', 'planned_context', 'screenshot_url');
```

## Local testing

1. **Supabase local** (recommended): `supabase start`, then paste migrations into SQL editor connected to local DB, or use `psql` against `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
2. **Dry run on staging**: Take a snapshot/backup, run 001→004, run verification queries above.
3. **App smoke test** after all four repairs:
   - Save a trade with screenshot
   - Run AI coach session → link to trade
   - Open execution replay for that trade
   - Trigger learning sync (`/api/learning/...` or save trade flow)
   - Confirm `trade_memory.session_id` populated for linked trades

## Rollback policy

- **001**: Manual — legacy columns preserved as `trade_id_legacy_bigint` when converted from bigint.
- **002**: Drop FKs + `session_id` column (see header in `002-trade-integrity.sql`).
- **003**: Restore `planned_context` from backup if needed; top-level columns unchanged.
- **004**: `COMMENT ON COLUMN ... IS NULL` to remove deprecation markers.

## Future cleanup (not in 001–004)

After app stops dual-writing top-level JSON columns, a future **005-drop-deprecated-session-columns.sql** may drop:
`chart_url`, `chart_analysis`, `mtf_analysis`, `visual_analysis`, `chart_annotations`, `trade_id_legacy_bigint`.

Do not run until dual-read fallbacks are removed from application code.
