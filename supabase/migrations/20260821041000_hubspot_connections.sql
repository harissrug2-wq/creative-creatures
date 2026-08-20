create table if not exists public.hubspot_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  portal_id bigint,
  hub_domain text,
  connected_email text,
  account_type text,
  time_zone text,
  company_currency text,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  access_token_expires_at timestamptz,
  scopes jsonb not null default '[]'::jsonb,
  status text not null default 'connected',
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hubspot_connections_account_unique unique (account_id)
);

create index if not exists hubspot_connections_portal_id_idx on public.hubspot_connections(portal_id);

alter table public.hubspot_connections enable row level security;
revoke all on table public.hubspot_connections from anon, authenticated;
