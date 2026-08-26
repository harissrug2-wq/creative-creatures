create table if not exists public.google_chat_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  google_user_id text,
  connected_email text,
  connected_name text,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  access_token_expires_at timestamptz,
  scopes jsonb not null default '[]'::jsonb,
  status text not null default 'connected' check (status in ('connected', 'error', 'disconnected')),
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_chat_connections_account_unique unique (account_id)
);

create index if not exists google_chat_connections_google_user_idx
  on public.google_chat_connections(google_user_id);

alter table public.google_chat_connections enable row level security;
revoke all on table public.google_chat_connections from anon, authenticated;
grant select, insert, update, delete on table public.google_chat_connections to service_role;
