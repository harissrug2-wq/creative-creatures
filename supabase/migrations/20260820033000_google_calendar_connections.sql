create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  calendar_id text not null default 'primary',
  calendar_summary text,
  connected_email text,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  access_token_expires_at timestamptz,
  scope text,
  status text not null default 'connected' check (status in ('connected','disconnected','error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_calendar_connections_account_unique unique (account_id)
);

create index if not exists google_calendar_connections_account_idx
  on public.google_calendar_connections(account_id);

alter table public.google_calendar_connections enable row level security;

comment on table public.google_calendar_connections is
  'Account-scoped Google Calendar OAuth connections. OAuth tokens are encrypted by the application before storage.';
