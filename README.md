# Creative Creatures Combined Platform

One GitHub/Vercel project containing:

- `/login/` — role-based landing page
- `/admin/` — HoldCo agency console
- `/platform/` — Monitor workspace and department dashboards
- `/diagnostic/` — Agency Diagnostic journey
- `/accelerator/` — Breakthrough Accelerator roadmap
- `/signup/` — journey selection
- `/signup/lookup/` — existing archetype account lookup
- `/owner-archetype/assessment/` — archetype questionnaire and account creation
- `/agency-scorecard/`
- `/agency-strength-index/`
- `/independence-index/`

The questionnaire creates or updates an account through `/api/accounts`. Account lookup requires an exact match on name, email, and normalized agency URL.

## Local development

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example` before testing account persistence.

## Production

Read `DEPLOYMENT.txt`. Run `supabase/schema.sql` once, add the two server-only variables in Vercel, and redeploy.
