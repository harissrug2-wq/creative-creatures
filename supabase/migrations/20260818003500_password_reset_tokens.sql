-- Secure one-time password reset tokens for paid diagnostic accounts.
alter table public.accounts add column if not exists password_reset_token_hash text;
alter table public.accounts add column if not exists password_reset_expires_at timestamptz;
create index if not exists accounts_password_reset_token_idx
  on public.accounts (password_reset_token_hash)
  where password_reset_token_hash is not null;
