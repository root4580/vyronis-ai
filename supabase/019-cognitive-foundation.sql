-- Cognitive Architecture foundation: optional snapshot cache for timeline / replay

create table if not exists public.cognitive_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trade_id text,
  coach_session_id uuid,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cognitive_snapshots_user_created_idx
  on public.cognitive_snapshots (user_id, created_at desc);

alter table public.cognitive_snapshots enable row level security;

create policy "Users read own cognitive snapshots"
  on public.cognitive_snapshots
  for select
  using (auth.uid() = user_id);

create policy "Users insert own cognitive snapshots"
  on public.cognitive_snapshots
  for insert
  with check (auth.uid() = user_id);
