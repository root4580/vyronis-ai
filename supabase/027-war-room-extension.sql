-- Weekly War Room fields (screenshots, session focus, scenarios)
ALTER TABLE public.strategy_brain_weekly_plans
  ADD COLUMN IF NOT EXISTS session_focus text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS expected_scenarios text NOT NULL DEFAULT '';

ALTER TABLE public.strategy_brain_pair_plans
  ADD COLUMN IF NOT EXISTS screenshot_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
