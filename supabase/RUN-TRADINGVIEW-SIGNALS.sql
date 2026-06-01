-- TradingView alerts + in-app test button (run once in Supabase → SQL Editor)
-- Requires: user_settings, trade_coach_sessions, trades (from earlier migrations)
-- After this: Account Settings → Test GBPCAD should work on localhost and production.

-- === From 013-tradingview-signals.sql ===

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS tradingview_webhook_secret text,
  ADD COLUMN IF NOT EXISTS tradingview_webhook_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_settings.tradingview_webhook_secret IS
  'Per-user secret for TradingView alert webhooks. Server-only lookup.';
COMMENT ON COLUMN public.user_settings.tradingview_webhook_enabled IS
  'When true, POST /api/webhooks/tradingview accepts alerts for this user.';

CREATE UNIQUE INDEX IF NOT EXISTS user_settings_tradingview_secret_idx
  ON public.user_settings (tradingview_webhook_secret)
  WHERE tradingview_webhook_secret IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.tradingview_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  symbol text NOT NULL,
  timeframe text,
  direction text NOT NULL,
  strategy_name text,
  entry_zone text,
  stop_loss numeric,
  take_profit numeric,
  confidence numeric,
  message text,
  chart_url text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'analyzed', 'converted', 'archived', 'ignored')),
  read_at timestamptz,
  archived_at timestamptz,

  ai_analysis jsonb,
  ai_confidence_score numeric,
  ai_recommendation text CHECK (ai_recommendation IN ('TAKE', 'CAUTION', 'SKIP')),

  coach_session_id uuid REFERENCES public.trade_coach_sessions(id) ON DELETE SET NULL,
  trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL,

  external_alert_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tradingview_signals_user_status_idx
  ON public.tradingview_signals (user_id, status, received_at DESC);

CREATE INDEX IF NOT EXISTS tradingview_signals_user_unread_idx
  ON public.tradingview_signals (user_id, read_at, received_at DESC)
  WHERE read_at IS NULL AND status NOT IN ('archived', 'ignored');

CREATE INDEX IF NOT EXISTS tradingview_signals_dedupe_idx
  ON public.tradingview_signals (user_id, symbol, direction, received_at DESC);

COMMENT ON TABLE public.tradingview_signals IS
  'TradingView alert inbox. Future: MT5 execution, setup grading, win-rate, post-trade link via trade_id.';
COMMENT ON COLUMN public.tradingview_signals.trade_id IS
  'Reserved for future post-trade review linking after manual journal conversion.';

ALTER TABLE public.tradingview_signals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tradingview_signals'
      AND policyname = 'Users can view own tradingview signals'
  ) THEN
    CREATE POLICY "Users can view own tradingview signals"
      ON public.tradingview_signals FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tradingview_signals'
      AND policyname = 'Users can update own tradingview signals'
  ) THEN
    CREATE POLICY "Users can update own tradingview signals"
      ON public.tradingview_signals FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tradingview_signals'
      AND policyname = 'Users can insert own tradingview signals'
  ) THEN
    CREATE POLICY "Users can insert own tradingview signals"
      ON public.tradingview_signals FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- === From 033-tradingview-signals-log.sql ===

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

ALTER TABLE public.tradingview_signals_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tradingview_signals_log_select_own ON public.tradingview_signals_log;
CREATE POLICY tradingview_signals_log_select_own ON public.tradingview_signals_log
  FOR SELECT USING (auth.uid() = user_id);
