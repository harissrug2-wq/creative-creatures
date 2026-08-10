# Scoring implementation audit

This build treats the five supplied scoring PDFs as the source of truth. It removes the earlier hard-coded sample scores and unsupported valuation claims.

## Agency Owner Freedom Index (AOFI)

Implemented exactly as supplied:

- AOFI = Performance × 40% + Strength × 40% + Owner Independence × 20%.
- Overall confidence uses the same 40% / 40% / 20% weights; it is not a simple average.
- AOFI validation inherits the lowest validation status among the three indices.
- Rating bands are: Freedom Optimized 90–100, High Performing 80–89, Growth Ready 70–79, Developing 60–69, Founder Dependent 50–59, and At Risk below 50.

## Agency Strength Index

Implemented from the scoring specification:

- Five equally weighted categories: Leadership System, Operating System, Financial Infrastructure, Revenue Infrastructure, and People Infrastructure.
- Six 0–4 questions per category.
- Category Score = points earned ÷ 24 × 100.
- The five category scores are averaged.
- The separate Agency Scale Test is used to flag contradictions and affect confidence/validation; it does not replace the index score.
- Questionnaire results are treated as an initial hypothesis until operating evidence is connected.
- Implementation mapping: questionnaire-only Strength starts at 70% confidence and contradiction checks reduce it. The PDF defines the validation behavior but does not prescribe that starting percentage.

## Owner Independence Index

Implemented from the scoring specification:

- Five equally weighted categories: Decision, Revenue, Delivery, Leadership, and Strategic Independence.
- Standard questionnaire answers use 0–4 scoring.
- The final 90-day absence question is used as a validation check and can lower confidence when it contradicts the calculated score.
- Implementation mapping: questionnaire-only Independence starts at 60% confidence. The PDF defines the evidence sources and contradiction logic but not a fixed numeric starting confidence.
- Implementation assumption: the PDF defines Strategic Independence Part A and Part B but does not specify how they combine into one category score. This build combines Strategic Time Allocation and the Activity Continuity Matrix at 50% each. This is explicitly an implementation assumption, not a source-defined formula.

## Agency Performance Index

Rebuilt as a seven-step assessment rather than a one-screen placeholder:

1. Profitability, weighted 25%.
2. Growth Performance, weighted 20%.
3. Revenue Quality, weighted 20%.
4. Cash Performance, weighted 20%.
5. Capital Allocation, weighted 15%.
6. Seller Discretionary Earnings and capital-investment review.
7. Financial evidence uploads.

All 25 metric answer bands and their internal weights match the supplied Performance Index PDF.

Manual inputs included from the developer notes:

- TTM net income.
- Owner compensation.
- Owner add-backs.
- Prior-year Adjusted SDE.
- Intentional capital investments and timing.
- Adjusted SDE and ROIC-Lite calculations.

Evidence levels:

- Questionnaire only: Low confidence.
- P&L: Medium confidence.
- P&L + Balance Sheet + Cash Flow: High confidence.
- Level 2 plus all six Level 3 evidence groups: Very High confidence.

Implementation mapping: the source defines Low, Medium, High, and Very High labels but not numeric percentages. This build maps them to 45%, 65%, 82%, and 95%. Only the complete Very High evidence state is marked Verified; lower evidence levels remain Needs Validation.

Supported upload types include P&L, Balance Sheet, Cash Flow, client revenue detail, AR/AP, owner investment allocation, budget, forecast, and owner add-backs. Files are stored in the private Supabase `diagnostic-evidence` bucket when the backend is configured.

## Report release rules

- Completing an individual index returns the user to Diagnostic. It does not expose an individual report.
- The next index unlocks only after the previous index is complete.
- The Generate Diagnostic action appears only after all three indices are complete.
- Individual reports and the Agency Scorecard remain unavailable until report generation finishes.
- The three report cards then appear on Agency Scorecard, each with a full report page, Download Report, and Email Report.
- Direct report URLs use the same report-ready guard.

## Valuation limitation

The supplied PDFs define Adjusted SDE, index scoring, ROIC-Lite, AOFI weighting, confidence, validation, and rating bands. They do not define a complete enterprise-value multiple formula. Therefore this build displays source-supported Adjusted SDE and ROIC-Lite but does not fabricate an estimated enterprise valuation.

## Email and evidence services

Report email uses Resend through `/api/email-report.js` and requires `RESEND_API_KEY` and `REPORT_FROM_EMAIL`.

Evidence uploads use `/api/evidence-upload.js` and require `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the supplied `supabase/schema.sql` migration.
