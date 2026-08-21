create table if not exists public.slack_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  team_id text,
  team_name text,
  team_domain text,
  enterprise_id text,
  enterprise_name text,
  bot_user_id text,
  connected_user_id text,
  access_token_encrypted text not null,
  scopes text[] not null default '{}',
  status text not null default 'connected',
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id)
);
create index if not exists slack_connections_account_id_idx on public.slack_connections(account_id);
