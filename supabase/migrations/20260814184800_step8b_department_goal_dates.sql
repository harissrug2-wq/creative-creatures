-- Creative Creatures · Step 8B
-- Departmental goals now use an explicit calendar target date.
alter table public.department_goals
  add column if not exists target_completion_date date;

comment on column public.department_goals.target_completion_date is
  'Explicit user-selected completion date for the departmental goal. Legacy target_completion is retained for backward compatibility.';
