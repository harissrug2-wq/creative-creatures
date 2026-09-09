-- Creative Creatures: Leadership L10 operating system
-- Extends the existing leadership tables without deleting current data.

begin;

create table if not exists public.leadership_teams (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  cadence text not null default 'weekly'
    check (cadence in ('weekly', 'biweekly', 'monthly')),
  meeting_weekday smallint
    check (meeting_weekday is null or meeting_weekday between 0 and 6),
  meeting_time time,
  duration_minutes integer not null default 90
    check (duration_minutes between 15 and 480),
  calendar_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leadership_teams_account_idx
  on public.leadership_teams(account_id, active);

create unique index if not exists leadership_teams_one_default_per_account_idx
  on public.leadership_teams(account_id)
  where is_default = true;

create table if not exists public.leadership_team_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  team_id uuid not null references public.leadership_teams(id) on delete cascade,
  member_id uuid references public.account_members(id) on delete set null,
  display_name text not null,
  email text not null default '',
  meeting_role text not null default 'attendee'
    check (meeting_role in ('facilitator', 'attendee')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leadership_team_members_account_idx
  on public.leadership_team_members(account_id);

create index if not exists leadership_team_members_team_idx
  on public.leadership_team_members(team_id, active);

create index if not exists leadership_team_members_member_idx
  on public.leadership_team_members(member_id)
  where member_id is not null;

create unique index if not exists leadership_team_members_team_member_uidx
  on public.leadership_team_members(team_id, member_id)
  where member_id is not null;

alter table public.leadership_meetings
  add column if not exists team_id uuid
    references public.leadership_teams(id) on delete set null,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists current_section text not null default 'segue'
    check (current_section in (
      'segue', 'headlines', 'scorecard', 'rocks', 'todos', 'ids', 'conclude'
    )),
  add column if not exists meeting_url text not null default '',
  add column if not exists calendar_status text not null default 'not_linked'
    check (calendar_status in ('not_linked', 'scheduled', 'updated', 'cancelled')),
  add column if not exists transcript_text text not null default '',
  add column if not exists transcript_status text not null default 'none'
    check (transcript_status in ('none', 'pending', 'processing', 'processed', 'failed')),
  add column if not exists transcript_processed_at timestamptz;

create index if not exists leadership_meetings_team_date_idx
  on public.leadership_meetings(team_id, meeting_date desc)
  where team_id is not null;

create table if not exists public.leadership_metrics (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  team_id uuid not null references public.leadership_teams(id) on delete cascade,
  name text not null,
  owner_name text not null default '',
  unit text not null default 'number',
  direction text not null default 'higher'
    check (direction in ('higher', 'lower', 'range')),
  target_value numeric,
  target_min numeric,
  target_max numeric,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leadership_metrics_account_idx
  on public.leadership_metrics(account_id);

create index if not exists leadership_metrics_team_sort_idx
  on public.leadership_metrics(team_id, active, sort_order);

create table if not exists public.leadership_metric_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  metric_id uuid not null references public.leadership_metrics(id) on delete cascade,
  week_start date not null,
  value numeric,
  status text not null default 'no_data'
    check (status in ('on_track', 'off_track', 'no_data')),
  note text not null default '',
  source text not null default 'manual'
    check (source in ('manual', 'integration', 'meeting')),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (metric_id, week_start)
);

create index if not exists leadership_metric_entries_account_week_idx
  on public.leadership_metric_entries(account_id, week_start desc);

create index if not exists leadership_metric_entries_metric_week_idx
  on public.leadership_metric_entries(metric_id, week_start desc);

create table if not exists public.leadership_headlines (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  meeting_id uuid not null references public.leadership_meetings(id) on delete cascade,
  kind text not null
    check (kind in ('good_news', 'customer', 'employee')),
  headline text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leadership_headlines_account_idx
  on public.leadership_headlines(account_id);

create index if not exists leadership_headlines_meeting_kind_idx
  on public.leadership_headlines(meeting_id, kind, sort_order);

create table if not exists public.leadership_meeting_attendees (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  meeting_id uuid not null references public.leadership_meetings(id) on delete cascade,
  member_id uuid references public.account_members(id) on delete set null,
  display_name text not null,
  attended boolean not null default true,
  rating numeric(3,1)
    check (rating is null or (rating >= 1 and rating <= 10)),
  rating_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leadership_meeting_attendees_account_idx
  on public.leadership_meeting_attendees(account_id);

create index if not exists leadership_meeting_attendees_meeting_idx
  on public.leadership_meeting_attendees(meeting_id);

create index if not exists leadership_meeting_attendees_member_idx
  on public.leadership_meeting_attendees(member_id)
  where member_id is not null;

create unique index if not exists leadership_meeting_attendees_meeting_member_uidx
  on public.leadership_meeting_attendees(meeting_id, member_id)
  where member_id is not null;

create table if not exists public.leadership_meeting_sections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  meeting_id uuid not null references public.leadership_meetings(id) on delete cascade,
  section_key text not null
    check (section_key in (
      'segue', 'headlines', 'scorecard', 'rocks', 'todos', 'ids', 'conclude'
    )),
  position integer not null,
  duration_minutes integer not null
    check (duration_minutes between 1 and 180),
  status text not null default 'pending'
    check (status in ('pending', 'current', 'completed', 'skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, section_key)
);

create index if not exists leadership_meeting_sections_account_idx
  on public.leadership_meeting_sections(account_id);

create index if not exists leadership_meeting_sections_meeting_position_idx
  on public.leadership_meeting_sections(meeting_id, position);

create table if not exists public.leadership_meeting_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  meeting_id uuid not null references public.leadership_meetings(id) on delete cascade,
  section_key text not null
    check (section_key in (
      'segue', 'headlines', 'scorecard', 'rocks', 'todos', 'ids', 'conclude'
    )),
  item_type text not null
    check (item_type in ('headline', 'metric', 'rock', 'todo', 'issue', 'message')),
  source_id uuid,
  snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(snapshot) = 'object'),
  outcome jsonb not null default '{}'::jsonb
    check (jsonb_typeof(outcome) = 'object'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leadership_meeting_items_account_idx
  on public.leadership_meeting_items(account_id);

create index if not exists leadership_meeting_items_meeting_section_idx
  on public.leadership_meeting_items(meeting_id, section_key, sort_order);

create index if not exists leadership_meeting_items_source_idx
  on public.leadership_meeting_items(source_id)
  where source_id is not null;

insert into public.leadership_teams (account_id, name, is_default)
select accounts.id, 'Leadership Team', true
from public.accounts
where not exists (
  select 1
  from public.leadership_teams
  where leadership_teams.account_id = accounts.id
    and leadership_teams.is_default = true
);

update public.leadership_meetings as meetings
set team_id = teams.id
from public.leadership_teams as teams
where meetings.team_id is null
  and teams.account_id = meetings.account_id
  and teams.is_default = true;

alter table public.leadership_teams enable row level security;
alter table public.leadership_team_members enable row level security;
alter table public.leadership_metrics enable row level security;
alter table public.leadership_metric_entries enable row level security;
alter table public.leadership_headlines enable row level security;
alter table public.leadership_meeting_attendees enable row level security;
alter table public.leadership_meeting_sections enable row level security;
alter table public.leadership_meeting_items enable row level security;

revoke all on table
  public.leadership_teams,
  public.leadership_team_members,
  public.leadership_metrics,
  public.leadership_metric_entries,
  public.leadership_headlines,
  public.leadership_meeting_attendees,
  public.leadership_meeting_sections,
  public.leadership_meeting_items
from anon, authenticated;

grant select, insert, update, delete on table
  public.leadership_teams,
  public.leadership_team_members,
  public.leadership_metrics,
  public.leadership_metric_entries,
  public.leadership_headlines,
  public.leadership_meeting_attendees,
  public.leadership_meeting_sections,
  public.leadership_meeting_items
to service_role;

comment on table public.leadership_metrics is
  'Weekly operational L10 measurables. Diagnostic aggregate scores do not belong here.';

comment on table public.leadership_meeting_items is
  'Immutable meeting-time snapshots of rocks, metrics, to-dos and issues, plus their outcomes.';

commit;
