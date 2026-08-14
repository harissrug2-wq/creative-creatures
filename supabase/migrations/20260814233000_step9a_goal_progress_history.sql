-- =========================================================
-- Creative Creatures · Step 9A
-- Persistent progress history for the 9 Agency Goal metrics
-- =========================================================

create table if not exists public.agency_goal_progress (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  diagnostic_run_id uuid references public.diagnostic_runs(id) on delete set null,
  metric_id text not null,
  actual_value numeric not null,
  source_type text not null default 'manual'
    check (source_type in ('diagnostic', 'manual')),
  source_updated_at timestamptz,
  note text not null default '',
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists agency_goal_progress_account_metric_idx
  on public.agency_goal_progress(account_id, metric_id, captured_at desc);

create index if not exists agency_goal_progress_run_idx
  on public.agency_goal_progress(diagnostic_run_id);

-- One automatic snapshot per metric/source revision. Manual updates intentionally
-- remain unrestricted so an owner can record the same actual more than once.
create unique index if not exists agency_goal_progress_diagnostic_revision_uidx
  on public.agency_goal_progress(account_id, metric_id, source_updated_at)
  where source_type = 'diagnostic' and source_updated_at is not null;

alter table public.agency_goal_progress enable row level security;

grant select, insert, update, delete on table public.agency_goal_progress to service_role;
