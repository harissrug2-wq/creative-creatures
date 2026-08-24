-- =========================================================
-- Creative Creatures · Monitor Agency Leadership
-- Persistent meetings, to-dos, issues and strategy / vision
-- =========================================================

create table if not exists public.leadership_meetings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  title text not null,
  meeting_date date not null,
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed')),
  facilitator_name text not null default '',
  notes text not null default '',
  transcript_url text not null default '',
  rating numeric(3,1)
    check (rating is null or (rating >= 0 and rating <= 10)),
  rocks_total integer not null default 0 check (rocks_total >= 0),
  rocks_on_track integer not null default 0
    check (rocks_on_track >= 0 and rocks_on_track <= rocks_total),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leadership_meetings_account_date_idx
  on public.leadership_meetings(account_id, meeting_date desc);

alter table public.leadership_meetings enable row level security;

create table if not exists public.leadership_todos (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  meeting_id uuid references public.leadership_meetings(id) on delete set null,
  title text not null,
  owner_name text not null default '',
  due_date date,
  status text not null default 'open'
    check (status in ('open', 'complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leadership_todos_account_status_idx
  on public.leadership_todos(account_id, status, due_date);
create index if not exists leadership_todos_meeting_idx
  on public.leadership_todos(meeting_id);

alter table public.leadership_todos enable row level security;

create table if not exists public.leadership_issues (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  meeting_id uuid references public.leadership_meetings(id) on delete set null,
  title text not null,
  description text not null default '',
  owner_name text not null default '',
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'discussing', 'solved')),
  solved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leadership_issues_account_status_idx
  on public.leadership_issues(account_id, status, priority, created_at desc);
create index if not exists leadership_issues_meeting_idx
  on public.leadership_issues(meeting_id);

alter table public.leadership_issues enable row level security;

create table if not exists public.leadership_plans (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  core_values jsonb not null default '[]'::jsonb
    check (jsonb_typeof(core_values) = 'array'),
  core_focus text not null default '',
  ten_year_target text not null default '',
  three_year_picture text not null default '',
  one_year_plan text not null default '',
  quarterly_focus text not null default '',
  target_market text not null default '',
  three_uniques jsonb not null default '[]'::jsonb
    check (jsonb_typeof(three_uniques) = 'array'),
  proven_process text not null default '',
  guarantee text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leadership_plans enable row level security;

-- Leadership data is accessed only by the server-side API using service_role.
-- Browser roles remain ungranted. Explicit grants are required for projects
-- where new public tables are not auto-exposed to the Data API.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.leadership_meetings to service_role;
grant select, insert, update, delete on table public.leadership_todos to service_role;
grant select, insert, update, delete on table public.leadership_issues to service_role;
grant select, insert, update, delete on table public.leadership_plans to service_role;
