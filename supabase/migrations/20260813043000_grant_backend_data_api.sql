-- =========================================================
-- Creative Creatures
-- Allow Vercel server API to access backend tables
-- through Supabase Data API.
--
-- Browser roles are intentionally NOT granted access.
-- =========================================================

grant usage on schema public to service_role;

grant select, insert, update, delete
on table public.accounts
to service_role;

grant select, insert, update, delete
on table public.diagnostic_runs
to service_role;

grant select, insert, update, delete
on table public.index_results
to service_role;

grant select, insert, update, delete
on table public.financial_evidence
to service_role;

grant select, insert, update, delete
on table public.scorecards
to service_role;
