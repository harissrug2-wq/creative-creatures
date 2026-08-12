create extension if not exists pgcrypto;

-- =========================================================
-- ACCOUNTS
-- Existing Creative Creatures frontend/API expects this table
-- =========================================================

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  name_normalized text not null,

  email text not null,
  email_normalized text not null,

  agency_url text not null,
  agency_url_normalized text not null,

  agency_name text not null,

  journey text not null default 'diagnostic'
    check (journey in ('platform', 'diagnostic', 'accelerator')),

  source text not null default 'owner-archetype',

  archetype_answers jsonb not null default '{}'::jsonb,
  archetype_result jsonb not null default '{}'::jsonb,
  report_data jsonb not null default '{}'::jsonb,

  -- Temporary compatibility field.
  -- Existing frontend can continue using this while we
  -- move diagnostic state into dedicated tables.
  diagnostic_state jsonb not null default '{}'::jsonb,

  last_lookup_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists accounts_email_unique_idx
  on public.accounts (email_normalized);

create unique index if not exists accounts_agency_url_unique_idx
  on public.accounts (agency_url_normalized);

create index if not exists accounts_lookup_idx
  on public.accounts (
    name_normalized,
    email_normalized,
    agency_url_normalized
  );

alter table public.accounts enable row level security;


-- =========================================================
-- DIAGNOSTIC RUNS
-- One agency/account can complete multiple diagnostics
-- over time.
-- =========================================================

create table if not exists public.diagnostic_runs (
  id uuid primary key default gen_random_uuid(),

  account_id uuid not null
    references public.accounts(id)
    on delete cascade,

  status text not null default 'in_progress'
    check (
      status in (
        'in_progress',
        'ready_to_generate',
        'generating',
        'generated',
        'completed'
      )
    ),

  is_current boolean not null default true,

  started_at timestamptz not null default now(),
  generated_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists
  diagnostic_runs_one_current_per_account_idx
on public.diagnostic_runs(account_id)
where is_current = true;

create index if not exists diagnostic_runs_account_idx
  on public.diagnostic_runs(account_id);

alter table public.diagnostic_runs enable row level security;


-- =========================================================
-- INDEX RESULTS
-- Strength / Owner Independence / Performance
-- =========================================================

create table if not exists public.index_results (
  id uuid primary key default gen_random_uuid(),

  diagnostic_run_id uuid not null
    references public.diagnostic_runs(id)
    on delete cascade,

  index_type text not null
    check (
      index_type in (
        'strength',
        'independence',
        'performance'
      )
    ),

  score numeric(5,2)
    check (
      score is null
      or (score >= 0 and score <= 100)
    ),

  confidence numeric(5,2)
    check (
      confidence is null
      or (confidence >= 0 and confidence <= 100)
    ),

  validation_status text not null default 'needs_validation'
    check (
      validation_status in (
        'verified',
        'needs_validation',
        'contradiction'
      )
    ),

  progress smallint not null default 0
    check (
      progress >= 0
      and progress <= 100
    ),

  complete boolean not null default false,

  answers jsonb not null default '{}'::jsonb,

  category_scores jsonb not null default '{}'::jsonb,

  details jsonb not null default '{}'::jsonb,

  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (diagnostic_run_id, index_type)
);

create index if not exists index_results_run_idx
  on public.index_results(diagnostic_run_id);

create index if not exists index_results_type_idx
  on public.index_results(index_type);

alter table public.index_results enable row level security;


-- =========================================================
-- FINANCIAL EVIDENCE
-- Performance Index uploaded documents
-- =========================================================

create table if not exists public.financial_evidence (
  id uuid primary key default gen_random_uuid(),

  diagnostic_run_id uuid not null
    references public.diagnostic_runs(id)
    on delete cascade,

  evidence_type text not null
    check (
      evidence_type in (
        'profit_loss',
        'balance_sheet',
        'ar_aging',
        'client_revenue',
        'service_revenue_mix',
        'sde',
        'other'
      )
    ),

  file_name text,
  storage_path text,
  mime_type text,

  extraction_status text not null default 'uploaded'
    check (
      extraction_status in (
        'uploaded',
        'processing',
        'processed',
        'failed'
      )
    ),

  extracted_data jsonb not null default '{}'::jsonb,

  validation_status text not null default 'unverified'
    check (
      validation_status in (
        'unverified',
        'verified',
        'rejected'
      )
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financial_evidence_run_idx
  on public.financial_evidence(diagnostic_run_id);

create index if not exists financial_evidence_type_idx
  on public.financial_evidence(evidence_type);

alter table public.financial_evidence enable row level security;


-- =========================================================
-- GENERATED SCORECARDS
-- Frozen result of a generated diagnostic
-- =========================================================

create table if not exists public.scorecards (
  id uuid primary key default gen_random_uuid(),

  diagnostic_run_id uuid not null unique
    references public.diagnostic_runs(id)
    on delete cascade,

  performance_score numeric(5,2)
    check (
      performance_score is null
      or (performance_score >= 0 and performance_score <= 100)
    ),

  strength_score numeric(5,2)
    check (
      strength_score is null
      or (strength_score >= 0 and strength_score <= 100)
    ),

  independence_score numeric(5,2)
    check (
      independence_score is null
      or (independence_score >= 0 and independence_score <= 100)
    ),

  aofi_score numeric(5,2)
    check (
      aofi_score is null
      or (aofi_score >= 0 and aofi_score <= 100)
    ),

  confidence numeric(5,2)
    check (
      confidence is null
      or (confidence >= 0 and confidence <= 100)
    ),

  validation_status text not null default 'needs_validation'
    check (
      validation_status in (
        'verified',
        'needs_validation',
        'contradiction'
      )
    ),

  report_data jsonb not null default '{}'::jsonb,

  generated_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scorecards_run_idx
  on public.scorecards(diagnostic_run_id);

alter table public.scorecards enable row level security;


-- =========================================================
-- PRIVATE FINANCIAL DOCUMENT STORAGE
-- 4 MB maximum per uploaded file for now
-- =========================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit
)
values (
  'diagnostic-evidence',
  'diagnostic-evidence',
  false,
  4194304
)
on conflict (id)
do update set
  public = false,
  file_size_limit = 4194304;
