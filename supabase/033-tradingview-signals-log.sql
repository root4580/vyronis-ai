-- TradingView webhook audit log — every alert (passed or rejected) with reason
-- Run after 013-tradingview-signals.sql

CREATE TABLE IF NOT EXISTS public.tradingview_signals_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  symbol text NOT NULL,
  direction text NOT NULL,
  timeframe text,
  strategy_name text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  passed boolean NOT NULL,
  reject_reason text CHECK (reject_reason IN ('session', 'timeframe', 'bias')),
  reject_message text,
  notification_message text,
  setup_grade text,

  tradingview_signal_id uuid REFERENCES public.tradingview_signals(id) ON DELETE SET NULL,
  trade_plan_id uuid REFERENCES public.trade_plans(id) ON DELETE SET NULL,
  coach_session_id uuid REFERENCES public.trade_coach_sessions(id) ON DELETE SET NULL,

  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tradingview_signals_log_user_received_idx
  ON public.tradingview_signals_log (user_id, received_at DESC);

CREATE INDEX IF NOT EXISTS tradingview_signals_log_user_passed_idx
  ON public.tradingview_signals_log (user_id, passed, received_at DESC);

ALTER TABLE public.tradingview_signals_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tradingview_signals_log_select_own ON public.tradingview_signals_log;
CREATE POLICY tradingview_signals_log_select_own ON public.tradingview_signals_log
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.tradingview_signals_log IS
  'Audit log for TradingView webhook ingest — session, timeframe, and bias filter outcomes.';
