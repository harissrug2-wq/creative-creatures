create extension if not exists pgcrypto;

create table if not exists public.scorecard_quarterly_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  scorecard_id uuid references public.scorecards(id) on delete set null,
  calendar_year integer not null,
  calendar_quarter smallint not null check (calendar_quarter between 1 and 4),
  period_start date not null,
  period_end date not null,
  aofi_score numeric(5,2) check (aofi_score between 0 and 100),
  performance_score numeric(5,2) check (performance_score between 0 and 100),
  strength_score numeric(5,2) check (strength_score between 0 and 100),
  independence_score numeric(5,2) check (independence_score between 0 and 100),
  confidence numeric(5,2) check (confidence between 0 and 100),
  validation_status text,
  report_data jsonb not null default '{}'::jsonb,
  source_generated_at timestamptz,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, calendar_year, calendar_quarter)
);

create index if not exists scorecard_quarterly_snapshots_account_period_idx
  on public.scorecard_quarterly_snapshots (account_id, calendar_year, calendar_quarter);

alter table public.scorecard_quarterly_snapshots enable row level security;
revoke all on table public.scorecard_quarterly_snapshots from anon, authenticated;
grant all on table public.scorecard_quarterly_snapshots to service_role;

create or replace function public.capture_scorecard_quarter_snapshot(
  p_scorecard_id uuid,
  p_snapshot_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_start date := date_trunc('quarter', p_snapshot_at)::date;
  v_period_end date := (date_trunc('quarter', p_snapshot_at) + interval '3 months - 1 day')::date;
begin
  insert into public.scorecard_quarterly_snapshots (
    account_id, scorecard_id, calendar_year, calendar_quarter,
    period_start, period_end, aofi_score, performance_score,
    strength_score, independence_score, confidence, validation_status,
    report_data, source_generated_at, captured_at, updated_at
  )
  select
    dr.account_id,
    sc.id,
    extract(year from p_snapshot_at)::integer,
    extract(quarter from p_snapshot_at)::smallint,
    v_period_start,
    v_period_end,
    sc.aofi_score,
    sc.performance_score,
    sc.strength_score,
    sc.independence_score,
    sc.confidence,
    sc.validation_status,
    coalesce(sc.report_data, '{}'::jsonb),
    coalesce(sc.generated_at, sc.updated_at),
    now(),
    now()
  from public.scorecards sc
  join public.diagnostic_runs dr on dr.id = sc.diagnostic_run_id
  where sc.id = p_scorecard_id
  on conflict (account_id, calendar_year, calendar_quarter)
  do update set
    scorecard_id = excluded.scorecard_id,
    aofi_score = excluded.aofi_score,
    performance_score = excluded.performance_score,
    strength_score = excluded.strength_score,
    independence_score = excluded.independence_score,
    confidence = excluded.confidence,
    validation_status = excluded.validation_status,
    report_data = excluded.report_data,
    source_generated_at = excluded.source_generated_at,
    captured_at = excluded.captured_at,
    updated_at = now();
end;
$$;

revoke all on function public.capture_scorecard_quarter_snapshot(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.capture_scorecard_quarter_snapshot(uuid, timestamptz) to service_role;

create or replace function public.capture_latest_scorecards_for_quarter(p_snapshot_at timestamptz)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scorecard record;
  v_count integer := 0;
begin
  for v_scorecard in
    select distinct on (dr.account_id) sc.id
    from public.scorecards sc
    join public.diagnostic_runs dr on dr.id = sc.diagnostic_run_id
    where coalesce(sc.generated_at, sc.updated_at) <= p_snapshot_at
    order by dr.account_id, coalesce(sc.generated_at, sc.updated_at) desc
  loop
    perform public.capture_scorecard_quarter_snapshot(v_scorecard.id, p_snapshot_at);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.capture_latest_scorecards_for_quarter(timestamptz) from public, anon, authenticated;
grant execute on function public.capture_latest_scorecards_for_quarter(timestamptz) to service_role;

create or replace function public.scorecard_snapshot_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.capture_scorecard_quarter_snapshot(
    new.id,
    coalesce(new.generated_at, new.updated_at, now())
  );
  return new;
end;
$$;

drop trigger if exists scorecards_capture_quarter_snapshot on public.scorecards;
create trigger scorecards_capture_quarter_snapshot
after insert or update of aofi_score, performance_score, strength_score,
  independence_score, confidence, validation_status, report_data, generated_at
on public.scorecards
for each row execute function public.scorecard_snapshot_after_write();

-- Backfill the latest real scorecard recorded in every existing account-quarter.
with ranked as (
  select
    sc.id,
    coalesce(sc.generated_at, sc.updated_at) as snapshot_at,
    row_number() over (
      partition by dr.account_id,
        extract(year from coalesce(sc.generated_at, sc.updated_at)),
        extract(quarter from coalesce(sc.generated_at, sc.updated_at))
      order by coalesce(sc.generated_at, sc.updated_at) desc
    ) as row_rank
  from public.scorecards sc
  join public.diagnostic_runs dr on dr.id = sc.diagnostic_run_id
)
select public.capture_scorecard_quarter_snapshot(id, snapshot_at)
from ranked
where row_rank = 1;

-- On the first day of each new quarter, freeze the latest available scorecard
-- into the quarter that just ended. The trigger above keeps the active quarter
-- current whenever a scorecard is generated or refreshed.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    if not exists (select 1 from cron.job where jobname = 'capture-quarterly-agency-scorecards') then
      perform cron.schedule(
        'capture-quarterly-agency-scorecards',
        '5 0 1 1,4,7,10 *',
        $cron$select public.capture_latest_scorecards_for_quarter(now() - interval '10 minutes');$cron$
      );
    end if;
  end if;
exception
  when insufficient_privilege then
    raise notice 'pg_cron schedule was not created; configure the quarterly job from Supabase Cron.';
end;
$$;
