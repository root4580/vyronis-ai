-- Autonomous Intelligence Foundation (Shadow Mode, Trader DNA, Pattern Fingerprints, Lessons)
-- Run after 016-command-center-intelligence.sql

CREATE TABLE IF NOT EXISTS public.trader_dna_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  dna jsonb NOT NULL DEFAULT '{}'::jsonb,
  weekly_insight text,
  confidence_score int NOT NULL DEFAULT 50,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trader_dna_profiles_user_id_key UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS trader_dna_profiles_user_updated_idx
  ON public.trader_dna_profiles (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.pattern_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cluster_key text NOT NULL,
  cluster_type text NOT NULL CHECK (cluster_type IN ('win', 'loss', 'emotional_breakdown', 'a_plus_execution')),
  label text NOT NULL,
  fingerprint jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurrence_count int NOT NULL DEFAULT 0,
  avg_rr numeric,
  avg_pnl numeric,
  match_score_baseline int NOT NULL DEFAULT 50,
  last_matched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pattern_fingerprints_user_cluster_key UNIQUE (user_id, cluster_key)
);

CREATE INDEX IF NOT EXISTS pattern_fingerprints_user_type_idx
  ON public.pattern_fingerprints (user_id, cluster_type);

CREATE TABLE IF NOT EXISTS public.shadow_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_session_id uuid REFERENCES public.trade_coach_sessions(id) ON DELETE SET NULL,
  trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL,
  trigger_source text NOT NULL DEFAULT 'manual'
    CHECK (trigger_source IN ('pre_trade', 'chart_upload', 'planned_setup', 'manual', 'api')),
  assessment jsonb NOT NULL DEFAULT '{}'::jsonb,
  emotional_risk_score int NOT NULL DEFAULT 50,
  discipline_confidence int NOT NULL DEFAULT 50,
  execution_quality_prediction int NOT NULL DEFAULT 50,
  proactive_message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shadow_assessments_user_created_idx
  ON public.shadow_assessments (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.lesson_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL,
  coach_session_id uuid REFERENCES public.trade_coach_sessions(id) ON DELETE SET NULL,
  lesson text NOT NULL,
  category text NOT NULL DEFAULT 'discipline'
    CHECK (category IN ('discipline', 'emotion', 'execution', 'risk', 'setup', 'session')),
  reflection jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lesson_memory_user_created_idx
  ON public.lesson_memory (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.session_intelligence_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_phase text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  narrative text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_intelligence_cache_user_phase_key UNIQUE (user_id, session_phase)
);

ALTER TABLE public.trader_dna_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pattern_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shadow_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_intelligence_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own trader dna"
  ON public.trader_dna_profiles FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own pattern fingerprints"
  ON public.pattern_fingerprints FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own shadow assessments"
  ON public.shadow_assessments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own lesson memory"
  ON public.lesson_memory FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own session intelligence cache"
  ON public.session_intelligence_cache FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
