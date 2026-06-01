-- Paper trades (Practice Room) — separate from live journal trades
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.paper_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  symbol text NOT NULL,
  direction text NOT NULL,
  entry numeric,
  sl numeric,
  tp numeric,
  close_price numeric,
  result text NOT NULL DEFAULT 'PENDING'
    CHECK (result IN ('PENDING', 'WIN', 'LOSS', 'BREAKEVEN')),
  pips numeric,
  rr numeric,
  pnl numeric NOT NULL DEFAULT 0,
  is_paper boolean NOT NULL DEFAULT true,
  notes text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'practice',
  source_ref text,
  setup_grade text,
  entry_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS paper_trades_user_account_created_idx
  ON public.paper_trades (user_id, account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS paper_trades_user_pending_idx
  ON public.paper_trades (user_id, result)
  WHERE result = 'PENDING';

ALTER TABLE public.paper_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS paper_trades_select_own ON public.paper_trades;
CREATE POLICY paper_trades_select_own ON public.paper_trades
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS paper_trades_insert_own ON public.paper_trades;
CREATE POLICY paper_trades_insert_own ON public.paper_trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS paper_trades_update_own ON public.paper_trades;
CREATE POLICY paper_trades_update_own ON public.paper_trades
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS paper_trades_delete_own ON public.paper_trades;
CREATE POLICY paper_trades_delete_own ON public.paper_trades
  FOR DELETE USING (auth.uid() = user_id);
