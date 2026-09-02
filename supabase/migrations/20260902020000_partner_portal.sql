create table if not exists public.partner_apps (
  id text primary key,
  name text not null,
  category text not null,
  placement text not null,
  summary text,
  logo_url text,
  learn_url text,
  checkout_url text,
  status text not null default 'active' check (status in ('active','draft','inactive')),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.partner_referrals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  partner_app_id text not null references public.partner_apps(id) on delete restrict,
  intent text not null default 'information' check (intent in ('information','purchase')),
  status text not null default 'requested' check (status in ('requested','contacted','converted','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists partner_referrals_account_idx on public.partner_referrals(account_id,created_at desc);
alter table public.partner_apps enable row level security;
alter table public.partner_referrals enable row level security;
revoke all on table public.partner_apps,public.partner_referrals from anon,authenticated;
grant select,insert,update,delete on table public.partner_apps,public.partner_referrals to service_role;
insert into public.partner_apps(id,name,category,placement,sort_order) values
('ma-advisory','M&A Advisory','Valuation','Agency Scorecard > Valuation',10),
('success','Success','Leadership','Leadership > Weekly Sync',20),
('orgami-workforce','Orgami Workforce','Talent','Talent Acquisition & Management',30),
('axiom-digital','Axiom Digital','Marketing','Marketing',40),
('instant-prospector','Instant Prospector','Sales','Sales',50),
('buzzworthy','Buzzworthy','Sales','Sales',60)
on conflict(id) do update set name=excluded.name,category=excluded.category,placement=excluded.placement,sort_order=excluded.sort_order,updated_at=now();
