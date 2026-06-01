-- Paper trades: chart vision + coach link fields
-- Idempotent — safe to re-run.

ALTER TABLE public.paper_trades
  ADD COLUMN IF NOT EXISTS chart_image_url text,
  ADD COLUMN IF NOT EXISTS ai_confidence text,
  ADD COLUMN IF NOT EXISTS coach_session_id uuid,
  ADD COLUMN IF NOT EXISTS coach_feedback text;

CREATE INDEX IF NOT EXISTS paper_trades_coach_session_idx
  ON public.paper_trades (coach_session_id)
  WHERE coach_session_id IS NOT NULL;
