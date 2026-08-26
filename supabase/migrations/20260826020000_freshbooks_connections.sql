create table if not exists public.freshbooks_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  freshbooks_user_id text,
  connected_email text,
  selected_business_id text,
  selected_business_uuid text,
  selected_account_id text,
  selected_business_name text,
  businesses jsonb not null default '[]'::jsonb,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  access_token_expires_at timestamptz,
  scopes jsonb not null default '[]'::jsonb,
  status text not null default 'connected' check (status in ('connected', 'error', 'disconnected')),
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint freshbooks_connections_account_unique unique (account_id)
);

create index if not exists freshbooks_connections_freshbooks_account_idx
  on public.freshbooks_connections(selected_account_id);

alter table public.freshbooks_connections enable row level security;
revoke all on table public.freshbooks_connections from anon, authenticated;
grant select, insert, update, delete on table public.freshbooks_connections to service_role;
