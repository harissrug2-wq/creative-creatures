create extension if not exists pgcrypto;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_normalized text not null,
  email text not null,
  email_normalized text not null,
  agency_url text not null,
  agency_url_normalized text not null,
  agency_name text not null,
  journey text not null default 'diagnostic' check (journey in ('platform','diagnostic','accelerator')),
  source text not null default 'owner-archetype',
  archetype_answers jsonb not null default '{}'::jsonb,
  archetype_result jsonb not null default '{}'::jsonb,
  report_data jsonb not null default '{}'::jsonb,
  diagnostic_state jsonb not null default '{}'::jsonb,
  last_lookup_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounts add column if not exists report_data jsonb not null default '{}'::jsonb;
alter table public.accounts add column if not exists diagnostic_state jsonb not null default '{}'::jsonb;

create unique index if not exists accounts_email_unique_idx on public.accounts (email_normalized);
create unique index if not exists accounts_agency_url_unique_idx on public.accounts (agency_url_normalized);
create index if not exists accounts_lookup_idx on public.accounts (name_normalized, email_normalized, agency_url_normalized);

alter table public.accounts enable row level security;

-- No public table policies are created. The service-role key stays in Vercel only.
-- Browser requests use /api/accounts.js; never expose SUPABASE_SERVICE_ROLE_KEY to the client.

-- Private evidence bucket used by /api/evidence-upload.js.
insert into storage.buckets (id, name, public, file_size_limit)
values ('diagnostic-evidence', 'diagnostic-evidence', false, 4194304)
on conflict (id) do update set public = false, file_size_limit = 4194304;

-- Owner Archetype unpaid lead staging. Paid leads are converted to accounts by /api/payment-confirmation.
create table if not exists public.owner_archetype_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_normalized text not null,
  email text not null,
  email_normalized text not null,
  agency_url text not null,
  agency_url_normalized text not null,
  agency_name text not null,
  journey text not null default 'diagnostic',
  source text not null default 'owner-archetype',
  archetype_answers jsonb not null default '{}'::jsonb,
  archetype_result jsonb not null default '{}'::jsonb,
  report_data jsonb not null default '{}'::jsonb,
  converted_account_id uuid references public.accounts(id) on delete set null,
  converted_at timestamptz,
  payment_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists owner_archetype_leads_email_unique_idx on public.owner_archetype_leads(email_normalized);
create index if not exists owner_archetype_leads_unpaid_idx on public.owner_archetype_leads(converted_at, created_at desc);
alter table public.owner_archetype_leads enable row level security;
