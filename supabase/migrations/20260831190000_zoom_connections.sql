create table if not exists public.zoom_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  zoom_user_id text not null,
  zoom_account_id text,
  connected_email text,
  connected_name text,
  user_type integer,
  timezone text,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  access_token_expires_at timestamptz,
  scopes jsonb not null default '[]'::jsonb,
  status text not null default 'connected' check (status in ('connected','error')),
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.zoom_connections enable row level security;
revoke all on table public.zoom_connections from anon, authenticated;
grant select, insert, update, delete on table public.zoom_connections to service_role;
