-- Vyronis A+ Scanner signals — MT5 webhook ingest
-- Run in Supabase → SQL Editor after 024-mt5-sync-status.sql

CREATE TABLE IF NOT EXISTS public.scanner_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setup_id text NOT NULL,
  pair text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  grade text NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  daily_bias text NOT NULL,
  h4_bias text NOT NULL,
  zone_type text NOT NULL,
  confirmation_type text NOT NULL,
  risk_reward numeric NOT NULL,
  session text NOT NULL,
  sweep text,
  choch text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'watchlist', 'expired')),
  entry_price numeric,
  stop_loss numeric,
  take_profit numeric,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, setup_id)
);

CREATE INDEX IF NOT EXISTS scanner_signals_user_status_idx
  ON public.scanner_signals (user_id, status, detected_at DESC);

CREATE INDEX IF NOT EXISTS scanner_signals_user_detected_idx
  ON public.scanner_signals (user_id, detected_at DESC);

ALTER TABLE public.scanner_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scanner_signals_select_own ON public.scanner_signals;
CREATE POLICY scanner_signals_select_own
  ON public.scanner_signals
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS scanner_signals_service_all ON public.scanner_signals;
CREATE POLICY scanner_signals_service_all
  ON public.scanner_signals
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.scanner_signals IS
  'MT5 Vyronis_APlus_Scanner webhook signals — Precision Flow setups.';
