-- Coach companion daily mood check-in (session psychology gate)
CREATE TABLE IF NOT EXISTS public.coach_daily_mood_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  mood text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_date)
);

CREATE INDEX IF NOT EXISTS coach_daily_mood_checkins_user_date_idx
  ON public.coach_daily_mood_checkins (user_id, session_date DESC);

ALTER TABLE public.coach_daily_mood_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_daily_mood_checkins_select_own ON public.coach_daily_mood_checkins;
CREATE POLICY coach_daily_mood_checkins_select_own ON public.coach_daily_mood_checkins
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS coach_daily_mood_checkins_insert_own ON public.coach_daily_mood_checkins;
CREATE POLICY coach_daily_mood_checkins_insert_own ON public.coach_daily_mood_checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS coach_daily_mood_checkins_update_own ON public.coach_daily_mood_checkins;
CREATE POLICY coach_daily_mood_checkins_update_own ON public.coach_daily_mood_checkins
  FOR UPDATE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
