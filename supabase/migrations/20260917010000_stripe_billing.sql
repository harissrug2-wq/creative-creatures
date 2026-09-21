begin;
alter table public.accounts add column if not exists password_reset_token_hash text;
alter table public.accounts add column if not exists password_reset_expires_at timestamptz;
-- Apply once in the same project as accounts/owner_archetype_leads.
create table if not exists public.cc_stripe_orders (
 id uuid primary key default gen_random_uuid(), email text not null,
 plan text not null check(plan in ('diagnostic','accelerator','platform','fractional_coo')),
 account_id uuid references public.accounts(id) on delete set null,
 lead_id uuid, lead_snapshot jsonb, state text not null default 'pending' check(state in ('pending','paid','expired')),
 session_id text unique, subscription_id text unique, customer_id text,
 subscription_status text, subscription_event_at bigint not null default 0,
 new_account boolean not null default false, reset_expires_at timestamptz,
 paid_at timestamptz, notification_sent_at timestamptz,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '35 minutes'
);
create unique index if not exists cc_stripe_pending_email on public.cc_stripe_orders(email) where state='pending';
create table if not exists public.cc_stripe_legacy_access (
 account_id uuid primary key references public.accounts(id) on delete cascade, plans jsonb not null
);
alter table public.cc_stripe_orders enable row level security;
alter table public.cc_stripe_legacy_access enable row level security;
revoke all on public.cc_stripe_orders,public.cc_stripe_legacy_access from anon,authenticated;
grant all on public.cc_stripe_orders,public.cc_stripe_legacy_access to service_role;

create or replace function public.cc_stripe_begin(p_email text,p_plan text,p_account_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a accounts%rowtype; l owner_archetype_leads%rowtype; o cc_stripe_orders%rowtype;
begin
 if p_plan not in ('diagnostic','accelerator','platform','fractional_coo') then raise exception 'Invalid package'; end if;
 perform pg_advisory_xact_lock(hashtextextended(lower(p_email),0));
 select * into a from accounts where email_normalized=lower(p_email) for update;
 if a.id is not null and (p_account_id is null or p_account_id<>a.id) then return jsonb_build_object('error','Sign in as the agency owner before buying another package.'); end if;
 if p_account_id is not null and a.id is null then return jsonb_build_object('error','Account not found.'); end if;
 if a.id is not null and a.access_plan <> 'owner_archetype' and (a.access_plan=p_plan or coalesce(a.diagnostic_state->'purchasedPlans','[]'::jsonb)?p_plan) and coalesce((a.diagnostic_state->>'paymentComplete')::boolean, true) = true then return jsonb_build_object('error','This account already has this package.'); end if;
 if p_plan in ('platform','fractional_coo') and exists(select 1 from cc_stripe_orders where email=lower(p_email) and subscription_id is not null and subscription_status not in ('canceled','incomplete_expired')) then
  return jsonb_build_object('error','An existing subscription must be managed before starting another monthly package.');
 end if;
 update cc_stripe_orders set state='expired' where email=lower(p_email) and state='pending' and expires_at<now();
 select * into o from cc_stripe_orders where email=lower(p_email) and state='pending';
 if o.id is not null then
  if o.plan<>p_plan then return jsonb_build_object('error','Another checkout is open. Complete it or wait 35 minutes before choosing another package.');end if;
  return to_jsonb(o);
 end if;
 if a.id is null then
  select * into l from owner_archetype_leads where email_normalized=lower(p_email);
  if l.id is null then return jsonb_build_object('error','Complete your Owner Archetype assessment before checkout.');end if;
  if exists(select 1 from accounts where agency_url_normalized=l.agency_url_normalized) then return jsonb_build_object('error','This agency already has a workspace. Sign in to that workspace.');end if;
 end if;
 insert into cc_stripe_orders(email,plan,account_id,lead_id,lead_snapshot) values(lower(p_email),p_plan,a.id,l.id,case when l.id is null then null else to_jsonb(l) end) returning * into o;
 return to_jsonb(o);
end $$;

create or replace function public.cc_stripe_recompute(p_account_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare plans jsonb; primary_plan text;
begin
 perform 1 from accounts where id=p_account_id for update;
 select coalesce(jsonb_agg(distinct x),'["owner_archetype"]'::jsonb) into plans from (
  select jsonb_array_elements_text(legacy.plans) as x from cc_stripe_legacy_access legacy where account_id=p_account_id
  union select plan from cc_stripe_orders where account_id=p_account_id and state='paid' and
   (subscription_id is null or subscription_status in ('active','trialing','past_due'))
 ) entitled;
 select x into primary_plan from jsonb_array_elements_text(plans) x order by case x when 'fractional_coo' then 5 when 'platform' then 4 when 'accelerator' then 3 when 'diagnostic' then 2 else 1 end desc limit 1;
 perform set_config('cc.stripe_write','true',true);
 update accounts set access_plan=coalesce(primary_plan,'owner_archetype'),journey=case when primary_plan in ('platform','fractional_coo') then 'platform' when primary_plan='accelerator' then 'accelerator' else 'diagnostic' end,
 diagnostic_state=coalesce(diagnostic_state,'{}'::jsonb)||jsonb_build_object('purchasedPlans',plans,'paymentComplete',plans<>'["owner_archetype"]'::jsonb),updated_at=now() where id=p_account_id;
 perform set_config('cc.stripe_write','false',true);
end $$;

create or replace function public.cc_stripe_fulfill(p_order_id uuid,p_session_id text,p_customer_id text,p_subscription_id text,p_subscription_status text,p_password_hash text,p_reset_hash text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o cc_stripe_orders%rowtype; a accounts%rowtype; l jsonb; was_new boolean:=false; legacy jsonb;
begin
 select * into o from cc_stripe_orders where id=p_order_id for update;
 if o.id is null then raise exception 'Unknown order';end if;
 if o.state='paid' then return to_jsonb(o);end if;
 if o.session_id is not null and o.session_id<>p_session_id then raise exception 'Session mismatch';end if;
 perform pg_advisory_xact_lock(hashtextextended(o.email,0));
 if o.account_id is not null then select * into a from accounts where id=o.account_id for update;
 else select * into a from accounts where email_normalized=o.email for update;end if;
 if a.id is null then
  l=o.lead_snapshot;
  if l is null then raise exception 'Missing agency details';end if;
  insert into accounts(name,name_normalized,email,email_normalized,agency_url,agency_url_normalized,agency_name,journey,access_plan,source,archetype_answers,archetype_result,report_data,diagnostic_state,password_hash,password_reset_token_hash,password_reset_expires_at)
  values(l->>'name',l->>'name_normalized',o.email,o.email,l->>'agency_url',l->>'agency_url_normalized',l->>'agency_name','diagnostic','owner_archetype','owner-archetype',coalesce(l->'archetype_answers','{}'),coalesce(l->'archetype_result','{}'),coalesce(l->'report_data','{}'),'{}',p_password_hash,p_reset_hash,now()+interval '24 hours') returning * into a;
  was_new:=true;
 end if;
 if not exists(select 1 from cc_stripe_legacy_access where account_id=a.id) then
  select coalesce(jsonb_agg(distinct x),'["owner_archetype"]'::jsonb) into legacy from (
   select jsonb_array_elements_text(coalesce(a.diagnostic_state->'purchasedPlans','[]'::jsonb)) x
   union select coalesce(a.access_plan,'owner_archetype')
  ) old_plans;
  insert into cc_stripe_legacy_access values(a.id,legacy);
 end if;
 update cc_stripe_orders set state='paid',account_id=a.id,session_id=p_session_id,customer_id=p_customer_id,subscription_id=nullif(p_subscription_id,''),subscription_status=p_subscription_status,new_account=was_new,reset_expires_at=case when was_new then now()+interval '24 hours' else null end,paid_at=now() where id=o.id returning * into o;
 update owner_archetype_leads set converted_account_id=a.id,converted_at=coalesce(converted_at,now()),payment_completed_at=now(),updated_at=now() where id=o.lead_id;
 perform cc_stripe_recompute(a.id);
 return to_jsonb(o);
end $$;

create or replace function public.cc_stripe_subscription(p_subscription_id text,p_status text,p_event_at bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare o cc_stripe_orders%rowtype;
begin
 select * into o from cc_stripe_orders where subscription_id=p_subscription_id for update;
 if o.id is null or p_event_at<o.subscription_event_at then return;end if;
 update cc_stripe_orders set subscription_status=p_status,subscription_event_at=p_event_at where id=o.id;
 if o.account_id is not null then perform cc_stripe_recompute(o.account_id);end if;
end $$;
-- Compatibility endpoints may save diagnostic JSON. They cannot overwrite Stripe entitlements.
create or replace function public.cc_stripe_protect_access()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if coalesce(current_setting('cc.stripe_write',true),'false')<>'true' and exists(select 1 from cc_stripe_legacy_access where account_id=old.id) then
  new.access_plan:=old.access_plan;
  new.journey:=old.journey;
  new.diagnostic_state:=coalesce(new.diagnostic_state,'{}'::jsonb)||jsonb_build_object('purchasedPlans',coalesce(old.diagnostic_state->'purchasedPlans','[]'::jsonb),'paymentComplete',coalesce(old.diagnostic_state->'paymentComplete','false'::jsonb));
 end if;
 return new;
end $$;
drop trigger if exists cc_stripe_protect_access on public.accounts;
create trigger cc_stripe_protect_access before update on public.accounts for each row execute function public.cc_stripe_protect_access();
revoke all on function public.cc_stripe_protect_access() from public,anon,authenticated;

revoke all on function public.cc_stripe_begin(text,text,uuid),public.cc_stripe_recompute(uuid),public.cc_stripe_fulfill(uuid,text,text,text,text,text,text),public.cc_stripe_subscription(text,text,bigint) from public,anon,authenticated;
grant execute on function public.cc_stripe_begin(text,text,uuid),public.cc_stripe_recompute(uuid),public.cc_stripe_fulfill(uuid,text,text,text,text,text,text),public.cc_stripe_subscription(text,text,bigint) to service_role;
commit;
