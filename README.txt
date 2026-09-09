BREAKTHROUGH ACCELERATOR PHASE 3 — REVISED COMPATIBLE PACKAGE

Built from the supplied creative-creatures(1).zip project state.
Preserves the current GHL CRM naming. It does not replace the newer signup pages,
global responsive navigation, loader styling, Portal UI, or other recently added pages.

This phase adds the final Session 6 output workspace:
- One-year vision
- Measurable one-year outcomes with owners and due dates
- 90-day priorities with owners, due dates, and status
- Draft, finalize, and reopen workflow
- Persistent account-isolated storage
- Responsive desktop and mobile plan dialog

No facilitator or checkout values are invented or configured.

APPLY
1. Extract this ZIP into C:\Users\PMLS\Documents\creative-creatures
2. From that folder run:
   node apply-breakthrough-accelerator-phase3.mjs
3. Run the SQL in:
   supabase\migrations\20260905010000_breakthrough_accelerator_phase3.sql
4. Build:
   npm.cmd run build

GIT
git add api/account-auth.js
git add accelerator/index.html
git add public/accelerator/accelerator-live.js
git add public/accelerator/accelerator-workspace.css
git add supabase/migrations/20260905010000_breakthrough_accelerator_phase3.sql
git commit -m "Add Accelerator final planning workspace"
git push origin main
vercel.cmd --prod

Do not add .cc-breakthrough-accelerator-phase3-backup-*.

QA
1. Complete Sessions 1-5 so Session 6 is available.
2. Open Build final plan.
3. Add a one-year vision, one outcome, and one priority; save the draft.
4. Reload and confirm every value remains saved.
5. Finalize the plan, reload, and confirm it remains finalized and read-only.
6. Reopen it, edit a value, save, and confirm the change remains.
7. Sign into a second agency and confirm it cannot see the first agency's plan.
8. Test desktop and mobile for horizontal overflow.
