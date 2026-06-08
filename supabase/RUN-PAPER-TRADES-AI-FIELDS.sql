-- Paste this ENTIRE file into Supabase → SQL Editor → Run
-- Run after RUN-PAPER-TRADES.sql

ALTER TABLE public.paper_trades
  ADD COLUMN IF NOT EXISTS chart_image_url text,
  ADD COLUMN IF NOT EXISTS ai_confidence text,
  ADD COLUMN IF NOT EXISTS coach_session_id uuid,
  ADD COLUMN IF NOT EXISTS coach_feedback text;

CREATE INDEX IF NOT EXISTS paper_trades_coach_session_idx
  ON public.paper_trades (coach_session_id)
  WHERE coach_session_id IS NOT NULL;

ALTER TABLE public.paper_trades
  ADD COLUMN IF NOT EXISTS chart_image_url_after text;
