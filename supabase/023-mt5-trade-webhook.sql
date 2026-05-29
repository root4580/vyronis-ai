-- MT5 EA trade webhook — per-user API key + journal-safe mt5_webhook imports
-- Run in Supabase → SQL Editor after 012-journal-csv-import.sql

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS mt5_webhook_api_key text,
  ADD COLUMN IF NOT EXISTS mt5_webhook_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_settings.mt5_webhook_api_key IS
  'Per-user secret for MT5 EA POST /api/webhooks/mt5/trades. Server-only lookup.';
COMMENT ON COLUMN public.user_settings.mt5_webhook_enabled IS
  'When true, MT5 EA may push closed trades for this user.';

CREATE UNIQUE INDEX IF NOT EXISTS user_settings_mt5_webhook_api_key_idx
  ON public.user_settings (mt5_webhook_api_key)
  WHERE mt5_webhook_api_key IS NOT NULL;

-- mt5_webhook may land in the journal without a research strategy (like journal_csv)
ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_research_import_strategy_check;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_research_import_strategy_check
  CHECK (
    import_source IN ('manual', 'journal_csv', 'mt5_webhook')
    OR research_strategy_id IS NOT NULL
  );

COMMENT ON COLUMN public.trades.import_source IS
  'manual = journal entry; journal_csv = CSV import; mt5_webhook = MT5 EA push; mt5_csv = research lab CSV';

NOTIFY pgrst, 'reload schema';
