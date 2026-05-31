-- Phase 2: link trade_plans ↔ trades (plan vs actual discipline)
-- Safe to re-run: IF NOT EXISTS + idempotent policies unchanged

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.trade_plans(id) ON DELETE SET NULL;

ALTER TABLE public.trade_plans
  ADD COLUMN IF NOT EXISTS executed_trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trades_plan_id_idx ON public.trades (plan_id);

CREATE INDEX IF NOT EXISTS trade_plans_status_idx ON public.trade_plans (status);

CREATE INDEX IF NOT EXISTS trade_plans_user_status_created_idx
  ON public.trade_plans (user_id, status, created_at DESC);
