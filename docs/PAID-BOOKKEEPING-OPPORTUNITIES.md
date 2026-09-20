# Paid bookkeeping and scorecard opportunities

## Changes

- Every paid access plan includes the narrow bookkeeping feature. Free Owner Archetype access does not. Owner-only integration management and account-scoped connection storage remain enforced.
- QuickBooks and FreshBooks connect, callback, status, sync, disconnect and business selection/read operations use this feature. Other integrations and FreshBooks client mutations still require the full integrations feature.
- Performance Index displays direct, locally branded buttons only when the provider status endpoint confirms configuration. Connected providers show Sync. Errors appear inline; there is no provider-picker popup.
- OAuth returns Performance users to Performance; connections initiated elsewhere keep the existing Integrations return. The return target is an exact local allowlist.
- Issues are ranked from saved category scores. Opportunities use their own category's recommendation instead of reusing the lowest category's recommendation for the entire index. Wording is rule-based, not AI-generated; there are no sample issue scores. Existing scorecards refresh the pairings when read.
- Diagnostic purchases hide Accelerator upgrades; Accelerator purchases hide Diagnostic upgrades. Purchase history as well as current plan is checked. This changes upgrade presentation, not existing entitlements.

## Apply

From the repository directory, with previous changes committed:

    git apply --check "%USERPROFILE%\Downloads\creative-creatures-paid-bookkeeping-fix-v2.patch"
    git apply "%USERPROFILE%\Downloads\creative-creatures-paid-bookkeeping-fix-v2.patch"
    node --test tests/paid-bookkeeping-opportunities.test.mjs
    npm run build

No database migration or new secret is required. Existing provider OAuth settings must be configured in Production. This patch does not configure provider credentials or perform live authorization. After deploying, connect a bookkeeping provider as a paid owner, approve access, return to Performance, sync and review the imported financial evidence.

## Validation

Six tests cover paid/free permissions, narrow action routing, upgrade exclusions, score-driven category matching, configured-provider visibility, and callback return targets. Production build and JavaScript syntax checks pass. Real provider authorization and financial sync still need a signed-in production check.

## Logo sources

QuickBooks: Simple Icons v15 quickbooks.svg (CC0 package), https://github.com/simple-icons/simple-icons.
FreshBooks: https://github.com/homarr-labs/dashboard-icons/blob/main/svg/freshbooks.svg (brand icon).
Logos identify the respective services; trademarks remain their owners'.
