create table if not exists public.ghl_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  location_id text not null unique,
  company_id text,
  location_name text,
  location_email text,
  location_phone text,
  timezone text,
  currency text,
  country text,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  access_token_expires_at timestamptz,
  scopes jsonb not null default '[]'::jsonb,
  user_id text,
  user_type text not null default 'Location',
  status text not null default 'connected' check (status in ('connected','disconnected','error')),
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ghl_connections add column if not exists company_id text;
alter table public.ghl_connections add column if not exists location_name text;
alter table public.ghl_connections add column if not exists location_email text;
alter table public.ghl_connections add column if not exists location_phone text;
alter table public.ghl_connections add column if not exists timezone text;
alter table public.ghl_connections add column if not exists currency text;
alter table public.ghl_connections add column if not exists country text;
alter table public.ghl_connections add column if not exists user_id text;
alter table public.ghl_connections add column if not exists user_type text not null default 'Location';

create unique index if not exists ghl_connections_location_id_key
  on public.ghl_connections(location_id);

create table if not exists public.ghl_webhook_events (
  id uuid primary key default gen_random_uuid(),
  webhook_id text not null unique,
  location_id text,
  event_type text not null,
  resource_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists ghl_webhook_events_location_received_idx
  on public.ghl_webhook_events(location_id, received_at desc);

alter table public.ghl_connections enable row level security;
alter table public.ghl_webhook_events enable row level security;
revoke all on table public.ghl_connections from anon, authenticated;
revoke all on table public.ghl_webhook_events from anon, authenticated;
grant select, insert, update, delete on table public.ghl_connections to service_role;
grant select, insert, update, delete on table public.ghl_webhook_events to service_role;
