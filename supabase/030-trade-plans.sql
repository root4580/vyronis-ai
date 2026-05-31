-- Pre-trade plans (separate from post-trade journal trades)
-- Safe to re-run: uses IF NOT EXISTS + DROP POLICY IF EXISTS

CREATE TABLE IF NOT EXISTS public.trade_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  account_size numeric NOT NULL,
  risk_percent numeric NOT NULL,
  entry_price numeric NOT NULL,
  stop_loss numeric NOT NULL,
  take_profit numeric NOT NULL,
  sl_pips numeric,
  tp_pips numeric,
  rr numeric,
  risk_amount numeric,
  recommended_lots numeric,
  pip_value_per_lot numeric,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_action text NOT NULL DEFAULT 'adjust_plan',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_plans_user_created_idx
  ON public.trade_plans (user_id, created_at DESC);

ALTER TABLE public.trade_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trade_plans_select_own ON public.trade_plans;
CREATE POLICY trade_plans_select_own ON public.trade_plans
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS trade_plans_insert_own ON public.trade_plans;
CREATE POLICY trade_plans_insert_own ON public.trade_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS trade_plans_update_own ON public.trade_plans;
CREATE POLICY trade_plans_update_own ON public.trade_plans
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS trade_plans_delete_own ON public.trade_plans;
CREATE POLICY trade_plans_delete_own ON public.trade_plans
  FOR DELETE USING (auth.uid() = user_id);

-- Status lifecycle (active | executed | skipped | expired)
UPDATE public.trade_plans SET status = 'active' WHERE status = 'planned';

ALTER TABLE public.trade_plans DROP CONSTRAINT IF EXISTS trade_plans_status_check;

ALTER TABLE public.trade_plans
  ADD CONSTRAINT trade_plans_status_check
  CHECK (status IN ('active', 'executed', 'skipped', 'expired'));

ALTER TABLE public.trade_plans ALTER COLUMN status SET DEFAULT 'active';
