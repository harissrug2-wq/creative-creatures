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

insert into public.owner_archetype_leads (
  name,name_normalized,email,email_normalized,agency_url,agency_url_normalized,agency_name,journey,source,
  archetype_answers,archetype_result,report_data,created_at,updated_at
)
select a.name,a.name_normalized,a.email,a.email_normalized,a.agency_url,a.agency_url_normalized,a.agency_name,a.journey,a.source,
       coalesce(a.archetype_answers,'{}'::jsonb),coalesce(a.archetype_result,'{}'::jsonb),coalesce(a.report_data,'{}'::jsonb),a.created_at,a.updated_at
from public.accounts a
where lower(coalesce(a.source,''))='owner-archetype'
  and lower(coalesce(a.diagnostic_state->>'paymentComplete','false')) <> 'true'
  and lower(coalesce(a.diagnostic_state->>'integrationsComplete','false')) <> 'true'
  and lower(coalesce(a.diagnostic_state->>'reportReady','false')) <> 'true'
  and lower(coalesce(a.diagnostic_state->>'allComplete','false')) <> 'true'
  and coalesce(nullif(regexp_replace(coalesce(a.diagnostic_state->>'count','0'),'[^0-9-]','','g'),'')::int,0)=0
on conflict (email_normalized) do update set
  name=excluded.name,
  name_normalized=excluded.name_normalized,
  agency_url=excluded.agency_url,
  agency_url_normalized=excluded.agency_url_normalized,
  agency_name=excluded.agency_name,
  archetype_answers=excluded.archetype_answers,
  archetype_result=excluded.archetype_result,
  report_data=excluded.report_data,
  updated_at=excluded.updated_at;
