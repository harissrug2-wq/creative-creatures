# QuickBooks implementation and data-sharing review

Baseline: 2190ac3 (merged branding/chat release). Changes are local until this patch is applied and deployed.

## Implemented and tested

- A QuickBooks report sync receiving HTTP 401 refreshes its access token and retries the report batch once. A second 401 requires reconnecting.
- Expired refresh credentials and invalid_grant persist an error connection state and a clear reconnect instruction. Refresh failures now enter the sync error handler.
- Token and report requests have a 20-second timeout. Empty or malformed successful report responses fail closed.
- QuickBooks provider errors capture intuit_tid, HTTP status, operation and a bounded error code. Provider descriptions and financial response payloads are excluded from these error objects and logs. The latest sync error remains in the account-scoped connection record.
- Financial evidence requires a signed account session and is scoped to that account. Raw financial evidence management and diagnostic writes are owner-only. Cross-account and cross-site browser requests are rejected.
- Public account lookup no longer returns reports, diagnostic state or archetype results. Authenticated lookup retains report loading for its own account. Updating an existing account requires owner authentication or admin authentication; public signup cannot overwrite another account.
- Ask Creature requests explicitly use store:false. This is not a claim about zero provider retention or training contracts.

## Data flow found in the source

| Stage | Data and recipient | Source |
|---|---|---|
| QuickBooks sync | Accounting report GET requests; encrypted OAuth tokens stored in the connection table | lib/quickbooks.js; api/account-auth.js |
| Evidence storage | Parsed P&L, balance sheet, receivables, client and service revenue evidence stored in Supabase under the agency diagnostic run | api/account-auth.js: saveAccountingEvidence |
| Performance calculation | Financial evidence produces financial metrics and diagnostic results | api/financial-evidence.js |
| Agency access | Owners and authenticated active agency members can receive account report/diagnostic information; members also have department-specific Monitor access | api/account-auth.js; lib/account-api-access.js |
| Operator access | Authenticated platform administrators can view account and financial summaries through the admin portfolio | api/accounts.js: buildAdminPortfolio |
| AI assistant | Owner questions about their report/results can send bounded diagnostic_state and report_data to OpenAI, plus the question and bounded conversation history. Member questions do not load that owner context, but users can include financial information in their messages | lib/ask-creature-chat.js |
| Uploaded documents | Financial PDF extraction sends an input-file URL to OpenAI. QuickBooks API parsing itself is local and does not use that PDF extraction path | api/financial-evidence.js |
| Hosting | The application runs on Vercel and uses Supabase for records. Actual regions, retention, staff permissions and provider contracts need confirmation in production settings | deployment configuration and prior hosting screenshot |

No training or fine-tuning pipeline was found in the reviewed paths. That does not establish the provider account's training/data-sharing settings. Disconnecting QuickBooks deletes its connection record; previously imported financial evidence and derived reports remain. Deletion requests need a separate account/evidence retention process.

## Questionnaire guidance

These answers describe the patched implementation, not an independent certification of production security.

| Question | Supported answer |
|---|---|
| Handles expired access tokens | Yes: proactive refresh within two minutes of expiry, plus one refresh/retry after a report 401. Mocked tests passed; live OAuth verification still required. |
| Handles expired refresh tokens and invalid grants | Yes: stop the sync, persist reconnect state, ask the user to reconnect. |
| Retries failed authentication requests | No automatic replay of failed token POST requests. Report GET batches retry once after a successful refresh. Do not describe this as unrestricted OAuth retries. |
| Uses discovery document | No: OAuth endpoints remain configured as constants. |
| Captures intuit_tid | Yes for failed token/report responses when Intuit supplies it. |
| Logs all error information | Sanitized request diagnostics and the latest sync error are implemented. Do not claim complete durable history: hosting log retention and export have not been verified. |
| Tested syntax/validation errors | Automated mocked validation/malformed-response tests passed. This does not mean live sandbox tests passed. |
| Connect/disconnect/reconnect tested with sandbox company | Not verified. Complete with a real Intuit sandbox company before claiming Yes. |
| QBO versions and downgrade handling | Not verified across Simple Start/Essentials/Plus/Advanced. A failed required report prevents a new complete sync; partial-report downgrade support has not been implemented. Do not claim support for every version. |
| Multicurrency and sales tax | No verified specialized feature support. |
| QuickBooks webhooks / CDC | No. |
| MFA / CAPTCHA / WebSockets | None found in the reviewed application authentication/chat code. Infrastructure-account MFA is a separate question. |
| Secrets stored securely | Code uses server environment variables and encrypted OAuth tokens. Confirm actual deployment secret values are absent from source, browser bundles and logs. |
| Security breach history / security team | Company facts; the company owner must answer. Code cannot establish them. |
| Data shown to anyone other than the customer | Do not answer an unqualified No. Explain authorized agency users, operator access, hosting/database processors and AI processing. If the form counts any third-party processing as sharing, select Yes with that explanation. |
| QuickBooks data used for AI training | No training workflow found. Confirm provider settings/contracts and operational practices before making the company-wide declaration. |

Suggested factual explanation for the data-sharing field:

“Creative Creatures processes connected QuickBooks accounting data to provide the customer's agency performance analysis and reports. Report information can be available to authorized users within that agency and authenticated platform administrators. Hosting and database processing use Vercel and Supabase. Ask Creature can send relevant account diagnostic/report context and user messages to OpenAI to generate responses. Uploaded financial PDFs may also be processed by OpenAI for extraction. QuickBooks API report parsing itself does not require AI. Imported evidence remains after disconnecting the QuickBooks connection.”

Review the public privacy notice against these facts before submitting. This review does not verify contractual restrictions, consent, deletion completion, provider retention or every application endpoint.

## Validation and application

Run in the repository after applying the patch:

```bat
node --test tests/quickbooks-review.test.mjs tests/account-authorization.test.mjs tests/ask-creature-chat.test.mjs
npm run build
```

77 targeted tests passed. Production build passed. Five existing tests in tests/ask-creature-performance.test.mjs also fail on the unchanged baseline: their chat fixtures predate the conversation-based API. They are not new regressions from this patch.

No database migration is required. No credentials were changed and nothing was deployed. After deployment, verify owner login, financial evidence loading, diagnostic save, authorized member access and a real QuickBooks sandbox connect/sync/disconnect/reconnect cycle. Keep production and sandbox credentials separate.

Known remaining engineering limits: no distributed refresh lock across concurrent server instances; no automatic token-POST retry; no full durable diagnostic log archive; no partial-report QBO plan downgrade support. These must not be represented as completed features in the assessment.
