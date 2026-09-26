-- Multi-owner / partner ownership model
alter table if exists public.account_members drop constraint if exists account_members_role_check;
alter table if exists public.account_members
  add constraint account_members_role_check check (role in ('member','partner'));

create table if not exists public.agency_owners (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  member_id uuid references public.account_members(id) on delete set null,
  name text not null,
  email text,
  email_normalized text,
  title text,
  ownership_percent numeric(5,2) not null default 0 check (ownership_percent >= 0 and ownership_percent <= 100),
  is_primary boolean not null default false,
  status text not null default 'active' check (status in ('active','former')),
  effective_from date not null default current_date,
  effective_to date,
  owner_identity_status text not null default 'not_started' check (owner_identity_status in ('not_started','invited','in_progress','complete')),
  owner_identity_result jsonb not null default '{}'::jsonb,
  dependency_profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, email_normalized)
);

create index if not exists agency_owners_account_idx on public.agency_owners(account_id);
create index if not exists agency_owners_member_idx on public.agency_owners(member_id);

create table if not exists public.agency_ownership_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  effective_at timestamptz not null default now(),
  reason text not null default 'ownership_update',
  structure jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists agency_ownership_snapshots_account_idx
  on public.agency_ownership_snapshots(account_id, effective_at desc);

alter table if exists public.scorecards
  add column if not exists ownership_snapshot_id uuid references public.agency_ownership_snapshots(id) on delete set null;

alter table public.agency_owners enable row level security;
alter table public.agency_ownership_snapshots enable row level security;
revoke all on public.agency_owners, public.agency_ownership_snapshots from anon, authenticated;
grant all on public.agency_owners, public.agency_ownership_snapshots to service_role;


create table if not exists public.agency_scorecard_history (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  scorecard_id uuid,
  diagnostic_run_id uuid,
  ownership_snapshot_id uuid references public.agency_ownership_snapshots(id) on delete set null,
  performance_score numeric,
  strength_score numeric,
  independence_score numeric,
  aofi_score numeric,
  confidence numeric,
  validation_status text,
  report_data jsonb not null default '{}'::jsonb,
  source_generated_at timestamptz,
  archive_reason text not null default 'ownership_change',
  archived_at timestamptz not null default now()
);

create index if not exists agency_scorecard_history_account_idx
  on public.agency_scorecard_history(account_id, archived_at desc);

alter table public.agency_scorecard_history enable row level security;
revoke all on public.agency_scorecard_history from anon, authenticated;
grant all on public.agency_scorecard_history to service_role;
