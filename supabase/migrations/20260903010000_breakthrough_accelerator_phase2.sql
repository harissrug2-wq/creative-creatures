alter table public.accelerator_session_progress
  add column if not exists started_at timestamptz,
  add column if not exists preparation_notes text,
  add column if not exists questions text,
  add column if not exists desired_outcome text,
  add column if not exists decisions text,
  add column if not exists action_items jsonb not null default '[]'::jsonb;

alter table public.accelerator_session_progress
  drop constraint if exists accelerator_session_progress_action_items_check;

alter table public.accelerator_session_progress
  add constraint accelerator_session_progress_action_items_check
  check (jsonb_typeof(action_items) = 'array');

comment on column public.accelerator_session_progress.preparation_notes is 'Agency preparation saved before the facilitated session.';
comment on column public.accelerator_session_progress.questions is 'Questions the agency wants addressed in the session.';
comment on column public.accelerator_session_progress.desired_outcome is 'The agency-defined outcome for this session.';
comment on column public.accelerator_session_progress.decisions is 'Decisions recorded during or after the session.';
comment on column public.accelerator_session_progress.action_items is 'Account-scoped follow-through items for the session.';

revoke all on public.accelerator_session_progress from anon, authenticated;
grant all on public.accelerator_session_progress to service_role;
