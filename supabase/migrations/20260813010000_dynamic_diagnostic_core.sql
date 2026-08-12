create extension if not exists pgcrypto;

-- =========================================================
-- DIAGNOSTIC RUNS
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
-- Strength / Independence / Performance
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
    check (progress >= 0 and progress <= 100),

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

alter table public.index_results enable row level security;


-- =========================================================
-- FINANCIAL EVIDENCE
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

alter table public.financial_evidence enable row level security;


-- =========================================================
-- GENERATED SCORECARDS
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
