-- =========================================================
-- Creative Creatures · Step 8A
-- Freeze target baselines and resolved values for Agency Goals
-- =========================================================

alter table public.agency_goals
  add column if not exists baseline_actual_value numeric,
  add column if not exists resolved_target_value numeric;

-- Existing exact-number targets already represent their resolved target.
update public.agency_goals
set resolved_target_value = target_value
where target_type = 'number'
  and target_value is not null
  and resolved_target_value is null;

-- Legacy percentage targets did not persist the actual value they were based on.
-- Do not invent that historical baseline. They will receive a frozen baseline
-- the next time the owner opens and saves that target in Step 8A.

grant select, insert, update, delete on table public.agency_goals to service_role;
