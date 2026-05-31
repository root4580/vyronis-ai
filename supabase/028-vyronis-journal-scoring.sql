-- Vyronis Core Model — journal doctrine fields + evaluation payload
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS weekly_bias text,
  ADD COLUMN IF NOT EXISTS daily_bias text,
  ADD COLUMN IF NOT EXISTS h4_bias text,
  ADD COLUMN IF NOT EXISTS aoi_type text,
  ADD COLUMN IF NOT EXISTS confirmation_type text,
  ADD COLUMN IF NOT EXISTS entry_quality text,
  ADD COLUMN IF NOT EXISTS vyronis_evaluation jsonb;

ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_weekly_bias_check;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_weekly_bias_check
  CHECK (weekly_bias IS NULL OR weekly_bias IN ('bullish', 'bearish', 'neutral'));

ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_daily_bias_check;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_daily_bias_check
  CHECK (daily_bias IS NULL OR daily_bias IN ('bullish', 'bearish', 'neutral'));

ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_h4_bias_check;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_h4_bias_check
  CHECK (h4_bias IS NULL OR h4_bias IN ('bullish', 'bearish', 'neutral'));


ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_aoi_type_check;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_aoi_type_check
  CHECK (
    aoi_type IS NULL OR aoi_type IN (
      'supply', 'demand', 'support', 'resistance',
      'liquidity_sweep', 'ema_zone', 'breakout_retest'
    )
  );

ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_confirmation_type_check;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_confirmation_type_check
  CHECK (
    confirmation_type IS NULL OR confirmation_type IN (
      'choch', 'bos', 'engulfing', 'pin_bar', 'break_retest', 'ema_retest', 'none'
    )
  );

ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_entry_quality_check;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_entry_quality_check
  CHECK (
    entry_quality IS NULL OR entry_quality IN ('early', 'perfect', 'late', 'impulsive')
  );

ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_setup_classification_check;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_setup_classification_check
  CHECK (
    setup_classification IS NULL OR setup_classification IN (
      'A+', 'A', 'B', 'Skip',
      'C', 'Impulsive', 'Revenge', 'Counter-Trend'
    )
  );

COMMENT ON COLUMN public.trades.weekly_bias IS 'Vyronis Core Model HTF weekly bias';
COMMENT ON COLUMN public.trades.daily_bias IS 'Vyronis Core Model HTF daily bias';
COMMENT ON COLUMN public.trades.h4_bias IS 'Vyronis Core Model HTF H4 bias';
COMMENT ON COLUMN public.trades.aoi_type IS 'Vyronis Core Model area of interest type';
COMMENT ON COLUMN public.trades.confirmation_type IS 'Vyronis Core Model confirmation signal type';
COMMENT ON COLUMN public.trades.entry_quality IS 'Vyronis Core Model entry timing quality';
COMMENT ON COLUMN public.trades.vyronis_evaluation IS 'Vyronis strategy scoring evaluation JSON (reasons, warnings, recommendation)';
