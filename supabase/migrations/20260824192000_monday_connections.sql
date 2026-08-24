create table if not exists public.monday_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  monday_account_id text,
  monday_account_name text,
  monday_account_slug text,
  monday_user_id text,
  monday_user_name text,
  monday_user_email text,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  access_token_expires_at timestamptz,
  scope text,
  oauth_mode text not null default 'oauth2.1',
  status text not null default 'connected',
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id)
);
create index if not exists monday_connections_account_id_idx on public.monday_connections(account_id);
