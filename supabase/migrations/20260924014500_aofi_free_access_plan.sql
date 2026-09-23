-- Add the free Agency Owner Freedom Index™ account tier.
alter table public.accounts drop constraint if exists accounts_access_plan_check;
alter table public.accounts add constraint accounts_access_plan_check
  check (access_plan in ('owner_archetype','aofi_free','diagnostic','accelerator','platform','fractional_coo'));

comment on column public.accounts.access_plan is
  'Creative Creatures access tier. aofi_free includes Diagnostic, Integrations and AOFI™ Scorecard but excludes Goals, Monitor, Portal, Users and Ask Creature.';
