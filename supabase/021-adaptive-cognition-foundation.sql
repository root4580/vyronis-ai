-- Long-term adaptive cognition: life context, identity snapshots, insights

create table if not exists public.trader_life_context (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  sleep_quality smallint check (sleep_quality between 1 and 10),
  stress smallint check (stress between 1 and 10),
  work_fatigue smallint check (work_fatigue between 1 and 10),
  gym_consistency smallint check (gym_consistency between 1 and 10),
  emotional_state smallint check (emotional_state between 1 and 10),
  focus_level smallint check (focus_level between 1 and 10),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create table if not exists public.trader_identity_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  maturity_score int,
  created_at timestamptz not null default now()
);

create index if not exists trader_identity_user_created_idx
  on public.trader_identity_snapshots (user_id, created_at desc);

create table if not exists public.adaptive_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  insight_key text not null,
  message text not null,
  category text not null,
  confidence int,
  dismissed boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists adaptive_insights_user_created_idx
  on public.adaptive_insights (user_id, created_at desc);

create table if not exists public.personal_os_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null,
  reflection text,
  created_at timestamptz not null default now()
);

alter table public.trader_life_context enable row level security;
alter table public.trader_identity_snapshots enable row level security;
alter table public.adaptive_insights enable row level security;
alter table public.personal_os_checkins enable row level security;

create policy "Users manage own life context"
  on public.trader_life_context for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users read own identity snapshots"
  on public.trader_identity_snapshots for select
  using (auth.uid() = user_id);

create policy "Users insert own identity snapshots"
  on public.trader_identity_snapshots for insert
  with check (auth.uid() = user_id);

create policy "Users manage own adaptive insights"
  on public.adaptive_insights for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own personal os checkins"
  on public.personal_os_checkins for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
