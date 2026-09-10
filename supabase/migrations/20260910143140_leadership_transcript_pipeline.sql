-- Creative Creatures: provider-neutral L10 transcript pipeline

begin;

create table if not exists public.leadership_meeting_transcripts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  meeting_id uuid not null references public.leadership_meetings(id) on delete cascade,
  provider text not null default 'manual'
    check (provider in ('google_meet', 'zoom', 'microsoft_teams', 'fathom', 'fireflies', 'manual', 'other')),
  provider_meeting_id text not null default '',
  provider_transcript_id text not null default '',
  source_url text not null default '',
  original_file_name text not null default '',
  mime_type text not null default 'text/plain',
  language_code text not null default '',
  raw_text text not null default '',
  segments jsonb not null default '[]'::jsonb
    check (jsonb_typeof(segments) = 'array'),
  status text not null default 'pending'
    check (status in ('pending', 'fetching', 'ready', 'processing', 'review', 'applied', 'failed')),
  ai_draft jsonb not null default '{}'::jsonb
    check (jsonb_typeof(ai_draft) = 'object'),
  error_message text not null default '',
  provider_created_at timestamptz,
  received_at timestamptz,
  processed_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id)
);

create index if not exists leadership_meeting_transcripts_account_idx
  on public.leadership_meeting_transcripts(account_id, created_at desc);

create index if not exists leadership_meeting_transcripts_status_idx
  on public.leadership_meeting_transcripts(status, updated_at)
  where status in ('pending', 'fetching', 'ready', 'processing', 'failed');

create unique index if not exists leadership_meeting_transcripts_provider_uidx
  on public.leadership_meeting_transcripts(account_id, provider, provider_transcript_id)
  where provider_transcript_id <> '';

alter table public.leadership_meetings
  add column if not exists transcript_provider text not null default 'none'
    check (transcript_provider in ('none', 'google_meet', 'zoom', 'microsoft_teams', 'fathom', 'fireflies', 'manual', 'other')),
  add column if not exists transcript_external_id text not null default '',
  add column if not exists transcript_error text not null default '',
  add column if not exists transcript_received_at timestamptz;

create index if not exists leadership_meetings_transcript_provider_idx
  on public.leadership_meetings(account_id, transcript_provider, transcript_status);

alter table public.leadership_meeting_transcripts enable row level security;

revoke all on table public.leadership_meeting_transcripts from anon, authenticated;

grant select, insert, update, delete
  on table public.leadership_meeting_transcripts
  to service_role;

comment on table public.leadership_meeting_transcripts is
  'Server-only normalized transcripts and reviewable AI agenda drafts for Leadership L10 meetings.';

comment on column public.leadership_meeting_transcripts.ai_draft is
  'Structured L10 suggestions that must be reviewed before being applied to a meeting agenda.';

commit;
