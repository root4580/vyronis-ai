-- Optional patch if you ran an older 030 before status/policies were idempotent.
-- Safe to re-run.

UPDATE public.trade_plans SET status = 'active' WHERE status = 'planned';

ALTER TABLE public.trade_plans DROP CONSTRAINT IF EXISTS trade_plans_status_check;

ALTER TABLE public.trade_plans
  ADD CONSTRAINT trade_plans_status_check
  CHECK (status IN ('active', 'executed', 'skipped', 'expired'));

ALTER TABLE public.trade_plans ALTER COLUMN status SET DEFAULT 'active';

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
