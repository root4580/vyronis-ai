-- Paste this ENTIRE file into Supabase → SQL Editor → Run

CREATE TABLE IF NOT EXISTS public.daily_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  session_date date NOT NULL,
  improve_tomorrow text,
  rules_next_session text,
  focus_area text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, account_id, session_date)
);

CREATE INDEX IF NOT EXISTS daily_journal_entries_user_date_idx
  ON public.daily_journal_entries (user_id, session_date DESC);

ALTER TABLE public.daily_journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_journal_entries_select_own ON public.daily_journal_entries;
CREATE POLICY daily_journal_entries_select_own ON public.daily_journal_entries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_journal_entries_insert_own ON public.daily_journal_entries;
CREATE POLICY daily_journal_entries_insert_own ON public.daily_journal_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_journal_entries_update_own ON public.daily_journal_entries;
CREATE POLICY daily_journal_entries_update_own ON public.daily_journal_entries
  FOR UPDATE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
