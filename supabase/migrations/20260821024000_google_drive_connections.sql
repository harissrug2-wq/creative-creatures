create table if not exists public.google_drive_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  connected_email text,
  connected_name text,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  access_token_expires_at timestamptz,
  scope text,
  selected_items jsonb not null default '[]'::jsonb,
  status text not null default 'connected',
  last_refreshed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_drive_connections_account_unique unique (account_id)
);

create index if not exists google_drive_connections_account_id_idx
  on public.google_drive_connections(account_id);

alter table public.google_drive_connections enable row level security;

comment on table public.google_drive_connections is
  'Account-scoped Google Drive OAuth connection. Tokens are encrypted by the application before storage. selected_items contains only files/folders explicitly selected by the client through Google Picker.';
