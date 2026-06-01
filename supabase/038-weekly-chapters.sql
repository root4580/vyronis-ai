-- Weekly Chapter summaries — past weeks remembered, not erased
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.weekly_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  week_start date NOT NULL,
  trades_taken integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  win_rate numeric NOT NULL DEFAULT 0,
  pnl numeric NOT NULL DEFAULT 0,
  discipline_score numeric,
  discipline_grade text,
  key_lesson text NOT NULL DEFAULT '',
  chapter_number integer NOT NULL,
  is_winning_chapter boolean NOT NULL DEFAULT false,
  max_trades_allowed integer NOT NULL DEFAULT 2,
  summary_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS weekly_summaries_user_account_week_idx
  ON public.weekly_summaries (user_id, account_id, week_start);

CREATE INDEX IF NOT EXISTS weekly_summaries_user_chapter_idx
  ON public.weekly_summaries (user_id, account_id, chapter_number DESC);

ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_summaries_select_own ON public.weekly_summaries;
CREATE POLICY weekly_summaries_select_own ON public.weekly_summaries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS weekly_summaries_insert_own ON public.weekly_summaries;
CREATE POLICY weekly_summaries_insert_own ON public.weekly_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS weekly_summaries_update_own ON public.weekly_summaries;
CREATE POLICY weekly_summaries_update_own ON public.weekly_summaries
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS weekly_summaries_delete_own ON public.weekly_summaries;
CREATE POLICY weekly_summaries_delete_own ON public.weekly_summaries
  FOR DELETE USING (auth.uid() = user_id);
