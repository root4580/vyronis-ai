-- =============================================================================
-- 050 — Security hardening: fix Supabase Advisor CRITICAL findings
-- =============================================================================
-- Fixes 4 critical issues flagged by Supabase's built-in security Advisor:
--
--   1. RLS Disabled in Public — public.trade_id_migration_map has no row-level
--      security, so (depending on default grants) it could be readable via
--      the API by any anon/authenticated caller. It's an internal migration
--      audit table (see 000-trades-id-bigint-to-uuid.sql) with no end-user
--      use case, so the fix is: enable RLS with zero policies (deny all via
--      PostgREST) and revoke API-role grants outright. Server-side code using
--      the service-role client (which bypasses RLS) is unaffected.
--
--   2-4. Security Definer View — public.vyronis_trade_id_migration_gaps,
--      public.vyronis_trades_enum_violations, and public.vyronis_session_json_drift
--      are debug/audit views (see 001, 002, 003) that were created without
--      `security_invoker`, so by default they execute with the view owner's
--      privileges. That means they can bypass row-level security on their
--      underlying tables (trades, trade_coach_sessions) and return every
--      user's rows to whoever queries them — a real cross-account data leak
--      if these views are reachable through the API. None of these views are
--      used by the app itself (they're one-off SQL Editor debugging aids per
--      MIGRATION_ORDER.md), so the fix is the same as above: make them
--      security-invoker (so RLS applies per-caller) AND revoke API-role
--      grants so they're only reachable via the service-role/SQL Editor.
--
-- SAFE TO RE-RUN: Yes — every statement is idempotent.
-- HOW TO RUN: Paste into Supabase SQL Editor (project → SQL Editor) and run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) trade_id_migration_map — enable RLS, deny all via API roles
-- ---------------------------------------------------------------------------
ALTER TABLE public.trade_id_migration_map ENABLE ROW LEVEL SECURITY;

-- No CREATE POLICY statements on purpose: with RLS on and zero policies,
-- anon/authenticated get zero rows back. service_role (used by
-- createServiceRoleClient() server-side) bypasses RLS entirely, so
-- migration/admin scripts keep working unchanged.

REVOKE ALL ON public.trade_id_migration_map FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Debug/audit views — security_invoker + revoke API-role grants
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'vyronis_trade_id_migration_gaps'
  ) THEN
    ALTER VIEW public.vyronis_trade_id_migration_gaps SET (security_invoker = on);
    REVOKE ALL ON public.vyronis_trade_id_migration_gaps FROM anon, authenticated;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'vyronis_trades_enum_violations'
  ) THEN
    ALTER VIEW public.vyronis_trades_enum_violations SET (security_invoker = on);
    REVOKE ALL ON public.vyronis_trades_enum_violations FROM anon, authenticated;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'vyronis_session_json_drift'
  ) THEN
    ALTER VIEW public.vyronis_session_json_drift SET (security_invoker = on);
    REVOKE ALL ON public.vyronis_session_json_drift FROM anon, authenticated;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Verification — re-run the Supabase Advisor after this, or spot-check here.
-- ---------------------------------------------------------------------------

-- Expect rowsecurity = true
SELECT relname, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname = 'trade_id_migration_map';

-- Expect reloptions to contain 'security_invoker=true' for each view that exists
SELECT relname, reloptions
FROM pg_class
WHERE relname IN (
  'vyronis_trade_id_migration_gaps',
  'vyronis_trades_enum_violations',
  'vyronis_session_json_drift'
);

-- Expect zero rows for anon/authenticated on the mapping table (run as those
-- roles, e.g. via the app with a normal user session, not in SQL Editor which
-- runs as postgres/service-level and will still see everything).
