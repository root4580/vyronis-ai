-- Multi-account support: trading accounts + account_id on trades
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  broker text NOT NULL DEFAULT '',
  starting_balance numeric NOT NULL CHECK (starting_balance >= 0),
  account_type text NOT NULL DEFAULT 'prop_firm'
    CHECK (account_type IN ('prop_firm', 'personal')),
  currency text NOT NULL DEFAULT 'USD',
  max_drawdown_pct numeric NOT NULL DEFAULT 10
    CHECK (max_drawdown_pct > 0 AND max_drawdown_pct <= 100),
  starting_balance_locked boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  accent_color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_user_name_lower_idx
  ON public.accounts (user_id, lower(name));

CREATE INDEX IF NOT EXISTS accounts_user_id_idx
  ON public.accounts (user_id);

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trades_user_account_created_idx
  ON public.trades (user_id, account_id, created_at DESC);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounts_select_own ON public.accounts;
CREATE POLICY accounts_select_own ON public.accounts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS accounts_insert_own ON public.accounts;
CREATE POLICY accounts_insert_own ON public.accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS accounts_update_own ON public.accounts;
CREATE POLICY accounts_update_own ON public.accounts
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS accounts_delete_own ON public.accounts;
CREATE POLICY accounts_delete_own ON public.accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Backfill: one default account per user from user_settings
INSERT INTO public.accounts (
  user_id,
  name,
  broker,
  starting_balance,
  account_type,
  currency,
  max_drawdown_pct,
  is_default,
  starting_balance_locked
)
SELECT
  us.user_id,
  COALESCE(NULLIF(trim(us.prop_firm_size), ''), '10K') || ' Account',
  '',
  us.starting_balance,
  'prop_firm',
  'USD',
  10,
  true,
  EXISTS (SELECT 1 FROM public.trades t WHERE t.user_id = us.user_id LIMIT 1)
FROM public.user_settings us
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounts a WHERE a.user_id = us.user_id
);

-- Link orphan trades to each user's default account
UPDATE public.trades t
SET account_id = a.id
FROM public.accounts a
WHERE t.account_id IS NULL
  AND t.user_id = a.user_id
  AND a.is_default = true;
