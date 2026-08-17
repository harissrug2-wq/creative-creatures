-- Account credentials for paid Agency Diagnostic clients.
alter table public.accounts add column if not exists password_hash text;
alter table public.accounts add column if not exists password_set_at timestamptz;
alter table public.accounts add column if not exists credentials_sent_at timestamptz;
create index if not exists accounts_credentials_idx on public.accounts (email_normalized) where password_hash is not null;
