create table if not exists public.clickup_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  primary_workspace_id text,
  primary_workspace_name text,
  workspace_ids text[] not null default '{}',
  workspace_names text[] not null default '{}',
  access_token_encrypted text not null,
  status text not null default 'connected',
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id)
);
create index if not exists clickup_connections_account_id_idx on public.clickup_connections(account_id);
