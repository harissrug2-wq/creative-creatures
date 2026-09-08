alter table public.accounts
  add column if not exists access_plan text not null default 'diagnostic';

alter table public.accounts drop constraint if exists accounts_access_plan_check;
alter table public.accounts add constraint accounts_access_plan_check
  check (access_plan in ('owner_archetype','diagnostic','accelerator','platform','fractional_coo'));

update public.accounts set access_plan = case
  when journey = 'platform' then 'platform'
  when journey = 'accelerator' then 'accelerator'
  else 'diagnostic'
end where access_plan is null or access_plan = 'diagnostic';

create table if not exists public.account_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  email text not null,
  email_normalized text not null unique,
  password_hash text not null,
  role text not null default 'member' check (role in ('member')),
  departments text[] not null default '{}',
  status text not null default 'active' check (status in ('active','disabled')),
  invited_at timestamptz not null default now(),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, email_normalized)
);

create index if not exists account_members_account_id_idx on public.account_members(account_id);

create table if not exists public.ask_creature_messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  member_id uuid references public.account_members(id) on delete set null,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  created_at timestamptz not null default now()
);

create index if not exists ask_creature_messages_account_created_idx
  on public.ask_creature_messages(account_id, created_at desc);

alter table public.account_members enable row level security;
alter table public.ask_creature_messages enable row level security;
revoke all on public.account_members, public.ask_creature_messages from anon, authenticated;
grant all on public.account_members, public.ask_creature_messages to service_role;
