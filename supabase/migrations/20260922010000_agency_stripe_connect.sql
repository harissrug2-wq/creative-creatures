begin;
-- Separate from Creative Creatures package checkout / cc_stripe_orders.
create table if not exists public.agency_stripe_connections (
 account_id uuid not null references public.accounts(id) on delete cascade,
 livemode boolean not null,
 stripe_account_id text not null check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
 display_name text not null default '',
 status text not null check (status in ('connected','disconnected')),
 connected_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key (account_id,livemode),
 unique (stripe_account_id,livemode)
);
create table if not exists public.agency_stripe_oauth_states (
 state_hash text primary key,
 account_id uuid not null references public.accounts(id) on delete cascade,
 livemode boolean not null,
 expires_at timestamptz not null
);
create table if not exists public.agency_stripe_operations (
 account_id uuid not null references public.accounts(id) on delete cascade,
 livemode boolean not null,
 request_id uuid not null,
 stripe_account_id text not null,
 kind text not null check (kind in ('customer','invoice','send')),
 input_hash text not null,
 result jsonb,
 created_at timestamptz not null default now(),
 primary key (account_id,livemode,request_id)
);
alter table public.agency_stripe_connections enable row level security;
alter table public.agency_stripe_oauth_states enable row level security;
alter table public.agency_stripe_operations enable row level security;
revoke all on public.agency_stripe_connections,public.agency_stripe_oauth_states,public.agency_stripe_operations from public,anon,authenticated;
grant all on public.agency_stripe_connections,public.agency_stripe_oauth_states,public.agency_stripe_operations to service_role;

-- Serialize connection claims for one agency. Do not let competing callbacks overwrite it.
create or replace function public.agency_stripe_claim(p_account_id uuid,p_livemode boolean,p_stripe_account_id text,p_display_name text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r agency_stripe_connections%rowtype;
begin
 perform 1 from accounts where id=p_account_id for update;
 select * into r from agency_stripe_connections where account_id=p_account_id and livemode=p_livemode;
 if r.status='connected' then return jsonb_build_object('error','An account is already connected. Refresh the page.'); end if;
 insert into agency_stripe_connections(account_id,livemode,stripe_account_id,display_name,status)
 values(p_account_id,p_livemode,p_stripe_account_id,p_display_name,'connected')
 on conflict(account_id,livemode) do update set stripe_account_id=excluded.stripe_account_id,display_name=excluded.display_name,status='connected',connected_at=now(),updated_at=now()
 returning * into r;
 return to_jsonb(r);
end; $$;
revoke all on function public.agency_stripe_claim(uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.agency_stripe_claim(uuid,boolean,text,text) to service_role;
commit;
