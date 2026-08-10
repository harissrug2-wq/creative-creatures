# Owner Archetype backend source

This folder preserves the supplied Owner Archetype Supabase backend and adds a separate account service without changing the original scoring/report function.

Original function:
- `supabase/functions/api-v1`

Added account function:
- `supabase/functions/account-v1`

Added account migration:
- `supabase/migrations/0005_owner_accounts.sql`

The combined frontend calls:

`https://mkgohvukpckcfwimxrra.supabase.co/functions/v1/account-v1`

Deploy `account-v1` with JWT verification disabled. The function uses the Supabase service-role key internally; never place that key in browser JavaScript or Vercel public environment variables.
