alter table public.leadership_meetings
  drop constraint if exists leadership_meetings_transcript_status_check;

alter table public.leadership_meetings
  add constraint leadership_meetings_transcript_status_check
  check (
    transcript_status in (
      'none',
      'pending',
      'processing',
      'processed',
      'applied',
      'failed'
    )
  );