-- Paste this ENTIRE file into Supabase → SQL Editor → Run
-- (Do NOT use \i — that only works in psql CLI, not the web editor)

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS thinking_before text,
  ADD COLUMN IF NOT EXISTS thinking_during text,
  ADD COLUMN IF NOT EXISTS thinking_after text,
  ADD COLUMN IF NOT EXISTS biggest_mistake text,
  ADD COLUMN IF NOT EXISTS lesson_learned text,
  ADD COLUMN IF NOT EXISTS what_worked text,
  ADD COLUMN IF NOT EXISTS what_didnt_work text,
  ADD COLUMN IF NOT EXISTS hold_minutes integer;

COMMENT ON COLUMN public.trades.thinking_before IS 'Trader mindset before entry.';
COMMENT ON COLUMN public.trades.thinking_during IS 'Trader mindset while in the trade.';
COMMENT ON COLUMN public.trades.thinking_after IS 'Trader mindset after exit.';
COMMENT ON COLUMN public.trades.biggest_mistake IS 'Single biggest mistake on this trade.';
COMMENT ON COLUMN public.trades.lesson_learned IS 'One-sentence lesson from this trade.';
COMMENT ON COLUMN public.trades.what_worked IS 'What went well on this trade.';
COMMENT ON COLUMN public.trades.what_didnt_work IS 'What did not work on this trade.';
COMMENT ON COLUMN public.trades.hold_minutes IS 'Manual hold duration when opened_at/closed_at are unavailable.';
