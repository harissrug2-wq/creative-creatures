begin;

-- Admin-created workspaces are intentional plan grants. Make their entitlement
-- state match the durable state produced by Stripe fulfillment so every access
-- check, future upgrade, and subscription recompute sees the same plan history.

update public.accounts
set diagnostic_state =
  jsonb_set(
    coalesce(diagnostic_state, '{}'::jsonb),
    '{purchasedPlans}',
    case
      when jsonb_typeof(coalesce(diagnostic_state, '{}'::jsonb)->'purchasedPlans') = 'array'
       and jsonb_array_length(coalesce(diagnostic_state, '{}'::jsonb)->'purchasedPlans') > 0
      then coalesce(diagnostic_state, '{}'::jsonb)->'purchasedPlans'
      else jsonb_build_array(access_plan)
    end,
    true
  )
  || jsonb_build_object(
       'paymentComplete', case when access_plan = 'aofi_free' then false else true end,
       'adminProvisioned', true,
       'updatedAt', now()
     )
  || case
       when access_plan <> 'aofi_free'
        and not (coalesce(diagnostic_state, '{}'::jsonb) ? 'paymentCompletedAt')
       then jsonb_build_object('paymentCompletedAt', coalesce(created_at, now()))
       else '{}'::jsonb
     end,
    updated_at = now()
where source = 'admin-console'
  and access_plan in ('aofi_free','diagnostic','accelerator','platform','fractional_coo');

-- Do this after the accounts update above: once a legacy-access row exists,
-- cc_stripe_protect_access intentionally prevents compatibility writes from
-- changing purchasedPlans/paymentComplete.
insert into public.cc_stripe_legacy_access(account_id, plans)
select id, jsonb_build_array(access_plan)
from public.accounts
where source = 'admin-console'
  and access_plan in ('aofi_free','diagnostic','accelerator','platform','fractional_coo')
on conflict (account_id) do nothing;

commit;
