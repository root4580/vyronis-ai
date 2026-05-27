-- Extended trade journal fields for Add Trade modal
-- Run this in Supabase → SQL Editor if emotion_after, stop_loss, take_profit, or risk_reward are not saving

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS entry_price numeric,
  ADD COLUMN IF NOT EXISTS stop_loss numeric,
  ADD COLUMN IF NOT EXISTS take_profit numeric,
  ADD COLUMN IF NOT EXISTS risk_reward numeric,
  ADD COLUMN IF NOT EXISTS emotion_after text,
  ADD COLUMN IF NOT EXISTS mistake_tags text,
  ADD COLUMN IF NOT EXISTS trade_notes text;

-- Optional: refresh PostgREST schema cache after running (Supabase usually picks this up within seconds)
NOTIFY pgrst, 'reload schema';
