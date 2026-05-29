-- MT5 connection metadata (ping, account, broker, balance)
-- Run after 024-mt5-sync-status.sql

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS mt5_last_ping_at timestamptz,
  ADD COLUMN IF NOT EXISTS mt5_account_login text,
  ADD COLUMN IF NOT EXISTS mt5_broker text,
  ADD COLUMN IF NOT EXISTS mt5_balance numeric,
  ADD COLUMN IF NOT EXISTS mt5_last_error text;

COMMENT ON COLUMN public.user_settings.mt5_last_ping_at IS
  'Last successful MT5 EA ping (connection test without trade).';
COMMENT ON COLUMN public.user_settings.mt5_account_login IS
  'Last reported MT5 account login from EA.';
COMMENT ON COLUMN public.user_settings.mt5_broker IS
  'Last reported MT5 broker/server from EA.';
COMMENT ON COLUMN public.user_settings.mt5_balance IS
  'Last reported MT5 account balance from EA.';
COMMENT ON COLUMN public.user_settings.mt5_last_error IS
  'Last MT5 webhook/ingest error message for dashboard.';

NOTIFY pgrst, 'reload schema';
