-- Migration for Quarterly Scorecard Snapshots
-- Supports automatic calendar quarter snapshots and score change explanations.

alter table public.scorecards
  add column if not exists quarter_label text,
  add column if not exists calendar_year smallint,
  add column if not exists calendar_quarter smallint,
  add column if not exists is_baseline boolean default false,
  add column if not exists score_drivers jsonb default '{}'::jsonb;

create index if not exists scorecards_quarter_idx
  on public.scorecards(calendar_year, calendar_quarter);

-- Table for explicitly frozen calendar quarter score snapshots
create table if not exists public.scorecard_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  diagnostic_run_id uuid references public.diagnostic_runs(id) on delete set null,
  scorecard_id uuid references public.scorecards(id) on delete set null,
  quarter_label text not null, -- e.g. 'Q3 2026'
  calendar_year smallint not null,
  calendar_quarter smallint not null,
  aofi_score numeric(5,2) not null,
  performance_score numeric(5,2) not null,
  strength_score numeric(5,2) not null,
  independence_score numeric(5,2) not null,
  confidence numeric(5,2) not null,
  validation_status text not null default 'needs_validation',
  enterprise_value numeric(14,2),
  is_baseline boolean not null default false,
  positive_factors jsonb not null default '[]'::jsonb,
  negative_factors jsonb not null default '[]'::jsonb,
  snapshot_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, calendar_year, calendar_quarter)
);

create index if not exists scorecard_snapshots_account_idx
  on public.scorecard_snapshots(account_id, calendar_year, calendar_quarter);

alter table public.scorecard_snapshots enable row level security;
