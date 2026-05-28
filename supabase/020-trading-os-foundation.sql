-- Autonomous Trading OS foundation: timeline + evolution snapshots

create table if not exists public.intelligence_timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  title text not null,
  summary text not null,
  severity text,
  trade_id text,
  metadata jsonb default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists intelligence_timeline_user_occurred_idx
  on public.intelligence_timeline_events (user_id, occurred_at desc);

create table if not exists public.trader_evolution_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period text not null check (period in ('weekly', 'monthly')),
  snapshot jsonb not null default '{}'::jsonb,
  evolution_score int,
  created_at timestamptz not null default now()
);

create index if not exists trader_evolution_user_period_idx
  on public.trader_evolution_snapshots (user_id, period, created_at desc);

alter table public.intelligence_timeline_events enable row level security;
alter table public.trader_evolution_snapshots enable row level security;

create policy "Users read own timeline events"
  on public.intelligence_timeline_events for select
  using (auth.uid() = user_id);

create policy "Users insert own timeline events"
  on public.intelligence_timeline_events for insert
  with check (auth.uid() = user_id);

create policy "Users read own evolution snapshots"
  on public.trader_evolution_snapshots for select
  using (auth.uid() = user_id);

create policy "Users insert own evolution snapshots"
  on public.trader_evolution_snapshots for insert
  with check (auth.uid() = user_id);
