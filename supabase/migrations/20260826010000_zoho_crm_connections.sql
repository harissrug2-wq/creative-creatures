create table if not exists public.zoho_crm_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  organization_id text,
  organization_name text,
  location text,
  accounts_server text not null,
  api_domain text not null,
  company_currency text,
  currency_symbol text,
  time_zone text,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  access_token_expires_at timestamptz,
  scopes jsonb not null default '[]'::jsonb,
  status text not null default 'connected',
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zoho_crm_connections_account_unique unique (account_id)
);

create index if not exists zoho_crm_connections_organization_id_idx
  on public.zoho_crm_connections(organization_id);

alter table public.zoho_crm_connections enable row level security;
revoke all on table public.zoho_crm_connections from anon, authenticated;
grant select, insert, update, delete on table public.zoho_crm_connections to service_role;
