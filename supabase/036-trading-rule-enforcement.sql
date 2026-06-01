-- Trading rule enforcement per account (cooldown + weekly limits)
-- Idempotent — safe to re-run.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS max_trades_per_week integer NOT NULL DEFAULT 2
    CHECK (max_trades_per_week >= 1 AND max_trades_per_week <= 50);

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS loss_streak_limit integer NOT NULL DEFAULT 3
    CHECK (loss_streak_limit >= 2 AND loss_streak_limit <= 10);

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS min_emotional_score integer NOT NULL DEFAULT 7
    CHECK (min_emotional_score >= 1 AND min_emotional_score <= 10);

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS cooldown_active boolean NOT NULL DEFAULT false;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS cooldown_triggered_at timestamptz;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS last_coach_unlock_at timestamptz;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS last_coach_unlock_session_id uuid
    REFERENCES public.trade_coach_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.trade_coach_sessions
  ADD COLUMN IF NOT EXISTS session_kind text DEFAULT 'pre_trade';

UPDATE public.trade_coach_sessions
SET session_kind = 'pre_trade'
WHERE session_kind IS NULL OR trim(session_kind) = '';

CREATE INDEX IF NOT EXISTS accounts_user_cooldown_idx
  ON public.accounts (user_id, cooldown_active)
  WHERE cooldown_active = true;

CREATE INDEX IF NOT EXISTS coach_sessions_user_kind_updated_idx
  ON public.trade_coach_sessions (user_id, session_kind, updated_at DESC);
