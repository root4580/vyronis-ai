-- Allow users to remove their own scanner signals from /scanner
-- Run in Supabase SQL Editor after 047-scanner-signals.sql

DROP POLICY IF EXISTS scanner_signals_delete_own ON public.scanner_signals;
CREATE POLICY scanner_signals_delete_own
  ON public.scanner_signals
  FOR DELETE
  USING (auth.uid() = user_id);
