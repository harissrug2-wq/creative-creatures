alter table if exists public.cc_stripe_orders
  add column if not exists ownership_draft jsonb;

comment on column public.cc_stripe_orders.ownership_draft is
  'Ownership structure captured during signup before Stripe checkout.';
