-- =============================================================================
-- 051 — Rate limiting infrastructure
-- =============================================================================
-- Adds a small fixed-window rate limiter backed by Postgres, used by API
-- routes that are either publicly reachable (webhooks) or trigger AI-provider
-- calls (Council, Coach) — both are abuse/cost vectors with no protection
-- today. Called only from trusted server code via the service-role client
-- (lib/rate-limit.ts), so RLS is enabled with zero policies (deny-all via the
-- API) and API-role grants are revoked, same pattern as 050.
--
-- SAFE TO RE-RUN: Yes — every statement is idempotent.
-- HOW TO RUN: Paste into Supabase SQL Editor (project → SQL Editor) and run.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_hits FROM anon, authenticated;

-- Atomically increments the counter for (key, current window) and reports
-- whether the caller is still under the limit. Fixed-window (not sliding),
-- which is a little permissive right at window boundaries but simple and
-- cheap — fine for abuse/cost protection, not for precise billing.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS TABLE(allowed boolean, remaining integer, retry_after_seconds integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.rate_limit_hits (key, window_start, request_count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET request_count = public.rate_limit_hits.request_count + 1
  RETURNING request_count INTO v_count;

  -- Opportunistic cleanup of old windows (~1% of calls) so this table doesn't
  -- grow unbounded. Cheap relative to the insert above; not required for
  -- correctness, just housekeeping.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limit_hits WHERE window_start < now() - interval '1 hour';
  END IF;

  RETURN QUERY SELECT
    v_count <= p_max_requests,
    GREATEST(p_max_requests - v_count, 0),
    GREATEST(
      CEIL(EXTRACT(EPOCH FROM (v_window_start + (p_window_seconds || ' seconds')::interval - now())))::integer,
      1
    );
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM anon, authenticated;
