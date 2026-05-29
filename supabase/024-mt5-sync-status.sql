-- MT5 EA sync status on user_settings (Last MT5 Sync + connection UI)
-- Run after 023-mt5-trade-webhook.sql

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS mt5_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS mt5_last_sync_status text,
  ADD COLUMN IF NOT EXISTS mt5_last_sync_ticket text,
  ADD COLUMN IF NOT EXISTS mt5_last_sync_message text;

COMMENT ON COLUMN public.user_settings.mt5_last_sync_at IS
  'Timestamp of last MT5 webhook ingest attempt for this user.';
COMMENT ON COLUMN public.user_settings.mt5_last_sync_status IS
  'ok | duplicate | error';
COMMENT ON COLUMN public.user_settings.mt5_last_sync_ticket IS
  'Last MT5 deal/position ticket processed.';
COMMENT ON COLUMN public.user_settings.mt5_last_sync_message IS
  'Human-readable last sync result for dashboard.';

NOTIFY pgrst, 'reload schema';
