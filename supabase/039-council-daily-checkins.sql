-- Council daily emotion check-in (Nova 1–10 gate)
CREATE TABLE IF NOT EXISTS public.council_daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  session_date date NOT NULL,
  emotion_score int NOT NULL CHECK (emotion_score >= 1 AND emotion_score <= 10),
  council_session_id uuid REFERENCES public.council_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, account_id, session_date)
);

CREATE INDEX IF NOT EXISTS council_daily_checkins_user_date_idx
  ON public.council_daily_checkins (user_id, session_date DESC);

ALTER TABLE public.council_daily_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS council_daily_checkins_select_own ON public.council_daily_checkins;
CREATE POLICY council_daily_checkins_select_own ON public.council_daily_checkins
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS council_daily_checkins_insert_own ON public.council_daily_checkins;
CREATE POLICY council_daily_checkins_insert_own ON public.council_daily_checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS council_daily_checkins_update_own ON public.council_daily_checkins;
CREATE POLICY council_daily_checkins_update_own ON public.council_daily_checkins
  FOR UPDATE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
