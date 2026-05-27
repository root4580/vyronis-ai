-- Journal CSV import — allow journal_csv on trades without research_strategy_id
-- SAFE TO RE-RUN. Run after 010-research-lab-foundation.sql.

ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_import_source_check;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_import_source_check
  CHECK (import_source IN ('manual', 'journal_csv', 'mt5_csv', 'mt5_webhook'));

ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_research_import_strategy_check;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_research_import_strategy_check
  CHECK (
    import_source IN ('manual', 'journal_csv')
    OR research_strategy_id IS NOT NULL
  );

COMMENT ON COLUMN public.trades.import_source IS
  'manual = journal entry; journal_csv = journal MT5 import; mt5_csv/mt5_webhook = research lab';

NOTIFY pgrst, 'reload schema';
