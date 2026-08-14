-- Step 8C: persist a real calendar due date for every 90-Day Rock.
alter table public.rocks
  add column if not exists due_date date;

-- Existing Rocks were created as 90-day priorities but only stored a fuzzy
-- due label. Give them a deterministic calendar target without overwriting
-- any due_date that may already exist.
update public.rocks
set due_date = (coalesce(created_at, now())::date + 90)
where due_date is null;

create index if not exists rocks_account_due_date_idx
  on public.rocks(account_id, due_date);
