# Sticky chat and responsive workspace

Based on the uploaded creative-creatures(1).zip. No database migration or new environment variables.

## Changes
- Moves the existing authenticated Ask Creature trigger into a fixed dock below the navigation. Hides it while chat is open and restores it on close.
- Loads chat styles before mounting/focusing the dialog, uses preventScroll for focus, and removes body containment/body resizing that interfered with fixed overlays.
- Adds authenticated profile menus to the shared workspace headers. Invite teammate and Manage users require both owner role and the users entitlement. Sign out clears the server session before clearing local state.
- Links Invite teammate to the existing user invitation form. Existing server authorization remains authoritative.
- Keeps profile controls visible on smaller screens; constrains grids, forms, dialogs and tables to the viewport. Adds reduced-motion support.
- Ends initial loading at DOM readiness and avoids the full-page loader for JavaScript-handled form submissions.

## Verification
- Production build passed.
- Existing Ask Creature tests: 12 passed.
- Local Chromium with mocked account/API responses: Diagnostic chat opened without changing scroll position at 320, 390, 768, 1024 and 1440px; dialog fit the viewport, launcher hid while open, and eligible owner profile links were available.
- Member accounts and owners without the users entitlement did not see team-management links.
- Horizontal-overflow checks passed at 390, 768 and 1440px for Monitor, Leadership, Agency Goals, Integrations, Portal, Accelerator, Agency Scorecard, Payment and Owner Archetype admin page shells.
- These are local layout/interaction checks, not live account, payment, email-delivery or performance benchmarks. Real data, mobile keyboards, Safari and Firefox still need production smoke checks.

## Apply in Windows Command Prompt
Run from C:\Users\PMLS\Documents\creative-creatures, on the same source version as the supplied ZIP:

    git switch -c fix/sticky-chat-responsive
    git apply --check "%USERPROFILE%\Downloads\creative-creatures-sticky-chat-responsive.patch"
    git apply "%USERPROFILE%\Downloads\creative-creatures-sticky-chat-responsive.patch"
    node --test tests/ask-creature-chat.test.mjs
    npm run build

Stop if the patch check reports a conflict; do not force it. Review and commit the changes, then merge into your configured production branch to deploy through your existing production workflow.

## Production smoke check
1. Scroll down Diagnostic, Leadership and Integrations. Open/close Ask Creature; the page should stay at the same position.
2. Verify the chat launcher is below the menu, hidden during chat, and visible after close.
3. On phone and desktop, open profile as an eligible owner. Invite teammate should open the invite form; Manage users should open the user list.
4. Repeat as a member and an owner without team access; only Sign out should appear in the new menu.
5. Confirm sign out ends the session. Test actual invitations only with a intended test recipient.
6. Check navigation, tables, forms and chat with your longest real records and with the mobile keyboard open.
