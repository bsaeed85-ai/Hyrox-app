create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default now()
);

create table if not exists baselines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run5k text,
  ski1k text,
  row1k text,
  sledpush50m text,
  sledpull50m text,
  burpeebroad80m text,
  farmer200m text,
  lunges100m text,
  wallballs100 numeric,
  readiness numeric,
  updated_at timestamptz default now(),
  unique(user_id)
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ts timestamptz not null,
  day_idx int,
  session jsonb,
  rpe numeric, notes text, readiness int, completed boolean default false
);

create table if not exists prs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise text not null,
  value text,
  value_num numeric,
  unit text,
  is_time boolean default true,
  created_at timestamptz default now()
);

create table if not exists weekly_cards (
  user_id uuid not null references auth.users(id) on delete cascade,
  week text not null,
  summary text,
  created_at timestamptz default now(),
  primary key (user_id, week)
);

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  status text default 'pending',
  token text unique,
  created_at timestamptz default now()
);

create table if not exists checklists (
  user_id uuid not null references auth.users(id) on delete cascade,
  race_date date not null,
  item text not null,
  done boolean default false,
  primary key (user_id, race_date, item)
);

alter table baselines enable row level security;
alter table sessions enable row level security;
alter table prs enable row level security;
alter table weekly_cards enable row level security;
alter table invites enable row level security;
alter table checklists enable row level security;

create policy "own read baselines" on baselines for select using (auth.uid() = user_id);
create policy "own upsert baselines" on baselines for insert with check (auth.uid() = user_id);
create policy "own update baselines" on baselines for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own read sessions" on sessions for select using (auth.uid() = user_id);
create policy "own insert sessions" on sessions for insert with check (auth.uid() = user_id);

create policy "own read prs" on prs for select using (auth.uid() = user_id);
create policy "own insert prs" on prs for insert with check (auth.uid() = user_id);

create policy "own read weekly" on weekly_cards for select using (auth.uid() = user_id);
create policy "own upsert weekly" on weekly_cards for insert with check (auth.uid() = user_id);

create policy "own read invites" on invites for select using (auth.uid() = user_id);
create policy "own insert invites" on invites for insert with check (auth.uid() = user_id);

create policy "own read checklists" on checklists for select using (auth.uid() = user_id);
create policy "own upsert checklists" on checklists for insert with check (auth.uid() = user_id);
