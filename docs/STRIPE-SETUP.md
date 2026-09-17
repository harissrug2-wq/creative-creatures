# Creative Creatures Stripe setup

This replaces simulated checkout. Do not merge to production until the database migration, environment variables and webhook are ready and Stripe test payments pass.

## Approved packages (USD)

| Package | Stripe price type | Amount | Vercel variable |
|---|---|---:|---|
| Diagnostic | One-time | $6,800 | STRIPE_PRICE_DIAGNOSTIC |
| Accelerator | One-time | $4,600 | STRIPE_PRICE_ACCELERATOR |
| Platform | Recurring monthly | $597 | STRIPE_PRICE_PLATFORM |
| Fractional COO | Recurring monthly | $3,997 | STRIPE_PRICE_FRACTIONAL_COO |
| Platform / COO bundle setup | One-time | $2,500 | STRIPE_PRICE_FRACTIONAL_COO_SETUP |

Platform checkout charges $3,097 today ($2,500 setup + $597 first month), then $597 per month. Both subscription checkouts use the same one-time setup price via STRIPE_PRICE_FRACTIONAL_COO_SETUP; its legacy variable name is retained.

Fractional COO checkout combines the monthly price and setup price: $6,497 today, then $3,997 per month. No trial, coupon, tax or alternative billing interval is enabled by this patch. The previously discussed 90-day client trial is not included.

## 1. Database

Run `supabase/migrations/20260917010000_stripe_billing.sql` in Supabase SQL Editor for the database used by the deployment. It adds private billing tables and service-role-only transactional functions; it does not charge anyone or change existing account access when installed.

## 2. Stripe sandbox first

Use your own Stripe account's test/sandbox environment. Create the five prices above with fixed, per-unit USD pricing. Copy their `price_...` IDs. Do not use live Price IDs with a test key. Checkout verifies the amounts, intervals, currency and Stripe environment server-side.

## 3. Vercel Preview environment

Set these server variables in the Creative Creatures Vercel project:

- STRIPE_SECRET_KEY: sandbox/test secret key, starting sk_test_
- STRIPE_WEBHOOK_SECRET: signing secret for the endpoint in step 4
- STRIPE_APP_URL: exact HTTPS origin of the preview you are testing; no trailing path
- The five STRIPE_PRICE_* variables from the table
- ACCOUNT_SESSION_SECRET: a stable random secret (retain the existing value if already set)
- SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY: existing database settings
- RESEND_API_KEY and RESEND_FROM_EMAIL: existing transactional email settings

No Stripe publishable key is needed for hosted Checkout. Never add secret keys to frontend files or Git. Environment changes require a new deployment. Use a stable Vercel branch preview domain and set STRIPE_APP_URL to exactly that domain. Browser origin checks reject other URLs intentionally. Stripe must be able to reach the webhook without Vercel deployment protection blocking it; use a suitable test deployment or authenticated automation bypass configuration, not an unreviewed change to production security.

## 4. Webhook

In Stripe, create an event destination pointing to:

`https://YOUR-PREVIEW-DOMAIN/api/payment-confirmation?action=webhook`

Select these events:

- checkout.session.completed
- checkout.session.async_payment_succeeded
- customer.subscription.updated
- customer.subscription.deleted

Use a snapshot webhook destination. Copy its signing secret (whsec_...) to STRIPE_WEBHOOK_SECRET. The raw body is verified before processing; do not add JSON parsing middleware to this route.

## 5. Verify in Preview

Run `node --test tests/stripe-billing.test.mjs` locally.

Using new test leads and Stripe test payment details, verify each package:

1. Checkout shows the approved amount and currency on Stripe.
2. Cancel or decline payment: no account/package is activated.
3. Successful payment: the selected package appears on the account and the lead is converted.
4. A new customer receives a password-setup email; an existing owner keeps their password. No password or session login is returned to someone merely holding an email address or payment URL.
5. Close the browser before returning from Stripe: webhook fulfillment still activates the account.
6. Resend a successful webhook: the same order/account remains; there is no duplicate activation.
7. Platform: initial invoice is $3,097; later monthly invoices are $597. Fractional COO: initial invoice is $6,497; later monthly invoices are $3,997.
8. Cancel a subscription at period end: access remains while Stripe says active, then ends when canceled. Stripe past_due retains access during its retry period; unpaid, paused and canceled do not grant monthly access. Configure Stripe retry/cancellation settings to match your business policy.
9. Existing one-time purchases and pre-integration access remain. Billing does not erase customer work.
10. An owner with an existing Stripe subscription cannot start a second monthly subscription. Mid-cycle plan switching/proration is not implemented; manage that in Stripe with an agreed change process. No customer billing portal is added by this patch.

Use Stripe test clocks to verify renewal/cancellation before live launch. Check Stripe webhook delivery logs for HTTP 200. Investigate and retry failed deliveries; do not tell the customer to pay again.

## 6. Production

Create the same prices in live mode. Set the production Vercel variables to the live IDs and sk_live_ key. Use STRIPE_APP_URL=https://app.creativecreatures.org and create a separate live webhook with the same path on that domain. Use that endpoint's live whsec_ value. Confirm the migration is installed in production, then merge/deploy the tested branch.

## Behavior and limits

- Legacy `/api/payment-confirmation` requests without a supported action now return HTTP 410; a client-supplied plan, email or payment-complete flag cannot activate through that endpoint.
- Checkout orders are private. New signup uses a snapshot of the matching lead; purchases for existing accounts require their owner's authenticated session.
- Pending checkouts are reused to prevent double-click duplication. One pending order per email is allowed; it expires after 35 minutes.
- Confirmations require the checkout browser cookie and matching Stripe session. Neither the return URL nor webhook supplies an account login session.
- Fulfillment and entitlement updates are one database transaction. The order's Stripe session ID is unique. Current Stripe subscription state is retrieved before processing subscription updates.
- For accounts managed by this billing integration, a database trigger preserves Stripe-managed entitlement fields when older compatibility endpoints save diagnostic data. Existing admin plan-switching cannot override those billing fields; use separate non-billing test accounts for experience previews.
- Password setup links expire after 24 hours. If delivery fails or a link expires, the existing Forgot password flow can send a fresh link. Failed webhook processing returns an error so Stripe retries. Payment activation is not rolled back if only email delivery fails.
- Refund/dispute-based revocation, invoice UI, subscription proration and customer self-service cancellation are not implemented. Handle refunds/disputes in Stripe and define the access policy before automating those changes.
- This patch is not a security audit of every pre-existing API. Test the full paid customer journey in Preview before accepting live payments.

## Supplied Stripe catalog update

Use `stripe-prices.env.example` for the supplied price IDs. These IDs have not been checked against the Stripe API: confirm USD currency and whether they belong to test or live mode before configuring a deployment. Platform is now $597/month and Diagnostic is $6,800 one-time, including server validation and signup/checkout displays.

The existing `fractional_coo` plan means the **bundle**, not standalone COO. The $2,500 Creature Platform Set Up price is mapped to its existing setup variable; the user confirmed that it applies to both Platform and the COO bundle. Board Review ($3,300, price_1U6aEF60UtIKLKhZiWSInfFz) and standalone COO ($3,500/month, price_1U6ZuM60UtIKLKhZfMcD23ac) remain catalog entries only until their access rules and purchase paths are specified.

Build from source before deployment. Included dist/payload folders are existing snapshots, not updated build outputs.
