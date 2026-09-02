create table if not exists public.accelerator_facilitators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text,
  experience_summary text,
  photo_url text,
  highlights jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accelerator_program_sessions (
  session_number integer primary key check (session_number between 0 and 6),
  title text not null,
  summary text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  checkout_url text,
  primary_action_label text,
  primary_action_url text,
  secondary_action_label text,
  secondary_action_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accelerator_enrollments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  facilitator_id uuid references public.accelerator_facilitators(id) on delete set null,
  cohort_name text,
  cohort_size integer check (cohort_size is null or cohort_size > 0),
  status text not null default 'active' check (status in ('reserved','active','paused','completed','cancelled')),
  payment_plan text not null check (payment_plan in ('package','pay_as_you_go')),
  package_price_cents integer not null default 460000 check (package_price_cents >= 0),
  package_checkout_url text,
  package_paid_at timestamptz,
  started_at timestamptz,
  target_completion_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accelerator_session_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.accelerator_enrollments(id) on delete cascade,
  session_number integer not null references public.accelerator_program_sessions(session_number),
  status text not null default 'locked' check (status in ('locked','available','scheduled','in_progress','completed','cancelled')),
  scheduled_at timestamptz,
  paid_at timestamptz,
  amount_paid_cents integer check (amount_paid_cents is null or amount_paid_cents >= 0),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, session_number)
);

alter table public.accelerator_facilitators enable row level security;
alter table public.accelerator_program_sessions enable row level security;
alter table public.accelerator_enrollments enable row level security;
alter table public.accelerator_session_progress enable row level security;

revoke all on public.accelerator_facilitators from anon, authenticated;
revoke all on public.accelerator_program_sessions from anon, authenticated;
revoke all on public.accelerator_enrollments from anon, authenticated;
revoke all on public.accelerator_session_progress from anon, authenticated;

grant all on public.accelerator_facilitators to service_role;
grant all on public.accelerator_program_sessions to service_role;
grant all on public.accelerator_enrollments to service_role;
grant all on public.accelerator_session_progress to service_role;

insert into public.accelerator_program_sessions
  (session_number,title,summary,price_cents,primary_action_label,primary_action_url,secondary_action_label,secondary_action_url)
values
  (0,'Foundation: Your Owner Archetype','Your identity shapes how and when your agency scales and who belongs in its leadership seats.',0,'View Owner Archetype','/owner-archetype/assessment/','Re-Assess','/owner-archetype/assessment/'),
  (1,'Agency Design','Learn how agency strength, financial performance, and owner dependence affect scaling and valuation using the AOFI Score.',59900,'Review Accelerator Training',null,null,null),
  (2,'Strength to Scale','Use the 14-point Agency Strength assessment to identify structural risk that makes the agency harder to scale and devalues the business.',69900,'Report Agency Strength','/agency-strength-index/',null,null),
  (3,'Financial Performance','Examine SDE and trends across profit and loss, COGS, gross profit, cash, revenue quality, and service revenue.',149900,'Start Agency Performance Analysis','/agency-performance-index/',null,null),
  (4,'Owner Independence','Assess how dependent the agency is on its owner and how those dependencies affect scale, valuation, and 90-day priorities.',59900,'Report Owner Dependencies','/independence-index/',null,null),
  (5,'Clarity & Goals','Use the completed scorecard to identify issues and priorities, then turn them into measurable agency goals.',102900,'Agency Scorecard','/agency-scorecard/','Set Goals','/agency-goals/'),
  (6,'Priorities & Plan','Define the agency''s 90-day priorities and one-year plan.',109900,'90 Day Priorities','/agency-goals/','1 Year Plan','/agency-goals/')
on conflict (session_number) do update set
  title=excluded.title,
  summary=excluded.summary,
  price_cents=excluded.price_cents,
  primary_action_label=excluded.primary_action_label,
  primary_action_url=excluded.primary_action_url,
  secondary_action_label=excluded.secondary_action_label,
  secondary_action_url=excluded.secondary_action_url,
  updated_at=now();
