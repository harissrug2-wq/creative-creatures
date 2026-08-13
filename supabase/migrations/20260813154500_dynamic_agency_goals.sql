-- =========================================================
-- Creative Creatures · Step 5
-- Persistent Agency Goals, Department Goals and 90-Day Rocks
-- =========================================================

create table if not exists public.agency_goals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  metric_id text not null,
  target_type text not null default 'number'
    check (target_type in ('number', 'percent')),
  target_value numeric,
  target_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, metric_id)
);

create index if not exists agency_goals_account_idx
  on public.agency_goals(account_id);

alter table public.agency_goals enable row level security;

create table if not exists public.department_goals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  department text not null,
  goal text not null default '',
  owner_name text not null default '',
  status text not null default 'Needs Definition'
    check (status in ('Needs Definition', 'On Track', 'Watch', 'Off Track')),
  done_looks_like text not null default '',
  target_completion text not null default 'This month'
    check (target_completion in ('This month', 'This quarter', 'Next quarter', 'This year')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, department)
);

create index if not exists department_goals_account_idx
  on public.department_goals(account_id);

alter table public.department_goals enable row level security;

create table if not exists public.rocks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  scorecard_id uuid references public.scorecards(id) on delete set null,
  source_type text not null default 'scorecard',
  source_key text not null,
  title text not null,
  description text not null default '',
  owner_name text not null default 'Agency Owner',
  due text not null default 'This quarter'
    check (due in ('This month', 'This quarter', 'Next quarter')),
  status text not null default 'Not started'
    check (status in ('Not started', 'On track', 'Watch', 'Complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, source_key)
);

create index if not exists rocks_account_idx on public.rocks(account_id);
create index if not exists rocks_scorecard_idx on public.rocks(scorecard_id);

alter table public.rocks enable row level security;

-- New Supabase projects do not automatically expose custom public tables
-- to service_role through the Data API. Keep browser roles ungranted.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.agency_goals to service_role;
grant select, insert, update, delete on table public.department_goals to service_role;
grant select, insert, update, delete on table public.rocks to service_role;
