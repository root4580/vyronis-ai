-- Account isolation: link plans + coach sessions to accounts, add accent colors
-- Idempotent — safe to re-run.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS accent_color text;

ALTER TABLE public.trade_plans
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.trade_coach_sessions
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trade_plans_user_account_created_idx
  ON public.trade_plans (user_id, account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS coach_sessions_user_account_updated_idx
  ON public.trade_coach_sessions (user_id, account_id, updated_at DESC);

-- Backfill to each user's default account
UPDATE public.trade_plans tp
SET account_id = a.id
FROM public.accounts a
WHERE tp.account_id IS NULL
  AND tp.user_id = a.user_id
  AND a.is_default = true;

UPDATE public.trade_coach_sessions cs
SET account_id = a.id
FROM public.accounts a
WHERE cs.account_id IS NULL
  AND cs.user_id = a.user_id
  AND a.is_default = true;

-- Deterministic accent colors for existing accounts (palette index by row number)
WITH numbered AS (
  SELECT
    id,
    (row_number() OVER (PARTITION BY user_id ORDER BY created_at, id) - 1) % 6 AS palette_idx
  FROM public.accounts
  WHERE accent_color IS NULL
)
UPDATE public.accounts ac
SET accent_color = (
  ARRAY['cyan', 'violet', 'amber', 'emerald', 'rose', 'sky']
)[numbered.palette_idx + 1]
FROM numbered
WHERE ac.id = numbered.id;
