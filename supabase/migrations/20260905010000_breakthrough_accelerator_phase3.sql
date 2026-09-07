create table if not exists public.accelerator_plans (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  enrollment_id uuid not null unique references public.accelerator_enrollments(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','finalized')),
  one_year_vision text,
  annual_outcomes jsonb not null default '[]'::jsonb,
  priorities jsonb not null default '[]'::jsonb,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accelerator_plans_annual_outcomes_array check (jsonb_typeof(annual_outcomes) = 'array'),
  constraint accelerator_plans_priorities_array check (jsonb_typeof(priorities) = 'array')
);

comment on table public.accelerator_plans is 'Account-scoped final output from Breakthrough Accelerator Session 6.';
comment on column public.accelerator_plans.annual_outcomes is 'Confirmed one-year outcomes entered by the agency.';
comment on column public.accelerator_plans.priorities is 'Confirmed 90-day priorities entered by the agency.';

alter table public.accelerator_plans enable row level security;
revoke all on public.accelerator_plans from anon, authenticated;
grant all on public.accelerator_plans to service_role;
