-- Persistent Creative Creatures accounts created from the existing Owner Archetype questionnaire.
-- Agency URL is the canonical lookup key because the questionnaire already collects it.

create table if not exists public.owner_accounts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null default '',
  last_name text not null default '',
  display_name text not null,
  display_name_normalized text not null,
  email text,
  email_normalized text,
  agency_url text not null,
  agency_url_normalized text not null unique,
  agency_name text not null default 'Agency',
  journey text not null default 'diagnostic'
    check (journey in ('platform', 'diagnostic', 'accelerator')),
  source text not null default 'owner-archetype',
  archetype_answers jsonb not null default '{}'::jsonb,
  archetype_result jsonb not null default '{}'::jsonb,
  report_data jsonb not null default '{}'::jsonb,
  last_lookup_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists owner_accounts_lookup_idx
  on public.owner_accounts (display_name_normalized, email_normalized, agency_url_normalized);

alter table public.owner_accounts enable row level security;

-- No browser policies are created. Reads and writes pass through the account-v1
-- Edge Function, which uses the service-role key inside Supabase only.
