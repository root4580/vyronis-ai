-- TradingView reflection chart on logged trades (separate from MT5 execution screenshot).
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS reflection_chart_url text;

COMMENT ON COLUMN public.trades.reflection_chart_url IS
  'TradingView or post-trade reflection chart screenshot — distinct from screenshot_url (MT5 execution).';
