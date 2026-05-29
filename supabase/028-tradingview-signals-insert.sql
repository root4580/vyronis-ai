-- Allow authenticated users to create their own TradingView signal rows (in-app test alert).
-- Webhook ingest from TradingView still uses service role.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tradingview_signals'
      AND policyname = 'Users can insert own tradingview signals'
  ) THEN
    CREATE POLICY "Users can insert own tradingview signals"
      ON public.tradingview_signals FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
