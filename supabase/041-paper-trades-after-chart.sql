-- Paper trades: after (exit) chart for close autofill
-- Idempotent — safe to re-run.

ALTER TABLE public.paper_trades
  ADD COLUMN IF NOT EXISTS chart_image_url_after text;
