-- QuickBooks Online OAuth connection state.
-- Tokens are encrypted by the server before they are written to this table.

create table if not exists public.quickbooks_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  realm_id text not null,
  company_name text,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  status text not null default 'connected' check (status in ('connected','disconnected','error')),
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quickbooks_connections_realm_idx
  on public.quickbooks_connections(realm_id);

alter table public.quickbooks_connections enable row level security;
