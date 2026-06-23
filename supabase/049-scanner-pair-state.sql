-- Vyronis A+ Scanner v1.3 — per-pair watchlist state from MT5
-- Run in Supabase → SQL Editor after 047-scanner-signals.sql

ALTER TABLE public.scanner_signals
  ADD COLUMN IF NOT EXISTS weekly_bias text;

CREATE TABLE IF NOT EXISTS public.scanner_pair_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair text NOT NULL,
  symbol text NOT NULL,
  weekly_bias text NOT NULL DEFAULT 'Neutral',
  daily_bias text NOT NULL DEFAULT 'Neutral',
  h4_bias text NOT NULL DEFAULT 'Neutral',
  scan_state text NOT NULL DEFAULT 'idle'
    CHECK (scan_state IN ('idle', 'building', 'waiting_confirmation', 'confirmed', 'alerted')),
  grade text NOT NULL DEFAULT 'Skip',
  zone_type text,
  session text,
  score integer NOT NULL DEFAULT 0,
  direction text,
  last_scan_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pair)
);

CREATE INDEX IF NOT EXISTS scanner_pair_state_user_idx
  ON public.scanner_pair_state (user_id, scan_state);

ALTER TABLE public.scanner_pair_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scanner_pair_state_select_own ON public.scanner_pair_state;
CREATE POLICY scanner_pair_state_select_own
  ON public.scanner_pair_state
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS scanner_pair_state_service_all ON public.scanner_pair_state;
CREATE POLICY scanner_pair_state_service_all
  ON public.scanner_pair_state
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.scanner_pair_state IS
  'MT5 Vyronis_APlus_Scanner v1.3 per-pair scan state for Vyronis watchlist.';
