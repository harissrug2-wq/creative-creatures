alter table if exists public.cc_stripe_orders
  add column if not exists ownership_payload jsonb;

comment on column public.cc_stripe_orders.ownership_payload is
  'Validated ownership structure captured during signup before Stripe checkout.';
