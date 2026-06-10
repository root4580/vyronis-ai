-- Stop fabricating 1% risk when journal save omits risk_percent.
-- Application now persists NULL when the trader leaves risk blank.

ALTER TABLE public.trades
  ALTER COLUMN risk_percent DROP DEFAULT;

COMMENT ON COLUMN public.trades.risk_percent IS
  'Logged risk % from journal. NULL means not provided — never assume 1%.';
