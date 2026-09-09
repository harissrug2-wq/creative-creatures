alter table public.leadership_meetings
  add column if not exists source text not null default 'manual',
  add column if not exists calendar_event_id text,
  add column if not exists calendar_html_url text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists agenda jsonb not null default '{}'::jsonb;

create unique index if not exists leadership_meetings_account_calendar_event_uidx
  on public.leadership_meetings (account_id, calendar_event_id)
  where calendar_event_id is not null;

comment on column public.leadership_meetings.agenda is
  'Editable L10 agenda data. Calendar imports schedule meetings only; transcript content is never inferred.';

