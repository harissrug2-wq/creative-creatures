create table if not exists public.teamwork_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  installation_id text,
  site_url text,
  api_endpoint text not null,
  company_id text,
  company_name text,
  region text,
  connected_email text,
  connected_name text,
  access_token_encrypted text not null,
  status text not null default 'connected',
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id)
);

create index if not exists teamwork_connections_account_id_idx
  on public.teamwork_connections(account_id);
