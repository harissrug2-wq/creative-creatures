-- Public free AOFI™ score requests submitted from aofreedomindex.com.
create table if not exists public.aofi_score_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  email_normalized text not null,
  agency_name text not null default '',
  agency_url text not null default '',
  phone text not null default '',
  source text not null default 'aofreedomindex.com',
  status text not null default 'requested' check (status in ('requested','started','converted','closed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists aofi_score_requests_email_unique_idx
  on public.aofi_score_requests(email_normalized);

alter table public.aofi_score_requests enable row level security;
revoke all on table public.aofi_score_requests from anon, authenticated;
grant select, insert, update, delete on table public.aofi_score_requests to service_role;
