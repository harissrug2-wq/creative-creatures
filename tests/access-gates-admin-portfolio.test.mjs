import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const shell = fs.readFileSync(new URL('../public/portal/app-shell.js', import.meta.url), 'utf8');
const access = fs.readFileSync(new URL('../public/shared/workspace-access.js', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../api/account-auth.js', import.meta.url), 'utf8');
const accounts = fs.readFileSync(new URL('../api/accounts.js', import.meta.url), 'utf8');
const admin = fs.readFileSync(new URL('../public/admin/admin.js', import.meta.url), 'utf8');
const archetypeCss = fs.readFileSync(new URL('../public/archetype/archetype.css', import.meta.url), 'utf8');
const baseCss = fs.readFileSync(new URL('../public/portal/base.css', import.meta.url), 'utf8');
const goalsApi = fs.readFileSync(new URL('../api/goals.js', import.meta.url), 'utf8');
const monitor = fs.readFileSync(new URL('../public/monitor/monitor.js', import.meta.url), 'utf8');
const goalsClient = fs.readFileSync(new URL('../public/portal/goals-client.js', import.meta.url), 'utf8');
const scorecardClient = fs.readFileSync(new URL('../public/portal/scorecard-client.js', import.meta.url), 'utf8');
const scorecardUi = fs.readFileSync(new URL('../public/portal/scorecard.js', import.meta.url), 'utf8');
const performanceUi = fs.readFileSync(new URL('../public/performance/performance.js', import.meta.url), 'utf8');
const financialApi = fs.readFileSync(new URL('../api/financial-evidence.js', import.meta.url), 'utf8');
const integrations = fs.readFileSync(new URL('../integrations/index.html', import.meta.url), 'utf8');
const goalsUi = fs.readFileSync(new URL('../agency-goals/index.html', import.meta.url), 'utf8');
const strengthQuestions = fs.readFileSync(new URL('../src/strength/data/questions.js', import.meta.url), 'utf8');
const independenceQuestions = fs.readFileSync(new URL('../src/independence/questionsData.js', import.meta.url), 'utf8');
const performanceFlow = fs.readFileSync(new URL('../public/performance/performance.js', import.meta.url), 'utf8');
const diagnosticState = fs.readFileSync(new URL('../public/portal/diagnostic-state.js', import.meta.url), 'utf8');
const departmentLive = fs.readFileSync(new URL('../public/monitor/department-live.js', import.meta.url), 'utf8');
const leadershipLive = fs.readFileSync(new URL('../public/monitor/leadership-live.js', import.meta.url), 'utf8');
const workspaceAccess = fs.readFileSync(new URL('../public/shared/workspace-access.js', import.meta.url), 'utf8');

test('free AOFI navigation exposes preview-only upgrade pages and plan tag', () => {
  assert.match(auth, /previewFeatures=plan==='aofi_free'\?\['monitor','goals','integrations'\]/);
  assert.match(shell, /Free AOFI™/);
  assert.match(shell, /data-account-plan-tag/);
});

test('workflow gates use dynamic prerequisite messages', () => {
  assert.match(access, /Complete your Diagnostic to view your Agency Scorecard/);
  assert.match(access, /Complete your Agency Scorecard to view Agency Goals/);
  assert.match(access, /Complete Agency Goals to view Monitor/);
});

test('plan-restricted pages render as full upgrade previews', () => {
  assert.match(access, /function previewCopy/);
  assert.match(access, /showPreviewBanner/);
  assert.match(access, /You can explore this entire page/);
  assert.match(goalsApi, /previewGoalsModel/);
  assert.match(goalsApi, /PLAN_UPGRADE_REQUIRED/);
});

test('paid accounts do not render an empty plan pill', () => {
  assert.match(baseCss, /\.account-plan-tag\[hidden\]\{display:none!important\}/);
});

test('scorecard unlock prerequisite is Diagnostic completion', () => {
  assert.match(access, /diagnosticComplete=workflow\.allComplete===true\|\|workflow\.reportReady===true/);
  assert.match(access, /localState\.allComplete===true/);
  assert.match(shell, /const scorecardReady = Boolean\(state\.allComplete \|\| state\.reportReady\)/);
  assert.match(auth, /savedIndexesComplete/);
});

test('monitor unlock prerequisite is scorecard generation', () => {
  assert.match(shell, /const monitorReady = Boolean\(state\.reportReady\)/);
});

test('admin can create/delete any account type without checkout', () => {
  assert.match(admin, /option value="aofi_free"/);
  assert.match(admin, /option value="fractional_coo"/);
  assert.match(admin, /data-delete-id/);
  assert.match(accounts, /paymentComplete: true/);
  assert.match(accounts, /provisionAdminCreatedAccess/);
});

test('admin account views use portfolio live data', () => {
  assert.match(admin, /all=true&portfolio=1/);
  assert.match(admin, /AOFI™ Score/);
  assert.match(admin, /Open Full Workspace/);
  assert.match(admin, /adminWorkspaceUrl\('\/platform\/',account\)/);
  assert.match(admin, /Agency Goals/);
  assert.match(admin, /Monitor/);
});

test('monitor navigation includes Free AOFI preview features', () => {
  assert.match(monitor, /previewFeatures/);
  assert.match(monitor, /access\.features\.includes\(feature\)\|\|previews\.includes\(feature\)/);
});

test('admin tenant follows Scorecard and Agency Goals pages', () => {
  assert.match(access, /actor\?\.role==='admin'/);
  assert.match(goalsClient, /cc_admin_tenant/);
  assert.match(scorecardClient, /cc_admin_tenant/);
});

test('owner identity card sizing matches signup card scale', () => {
  assert.match(archetypeCss, /width:min\(1040px/);
  assert.match(archetypeCss, /min-height:78px!important/);
  assert.match(archetypeCss, /height:78px!important/);
});


test('transcript UX feedback is reflected in diagnostics and performance', () => {
  assert.match(strengthQuestions, /Weekly with rolling forecasts/);
  assert.doesNotMatch(strengthQuestions, /Weekly L10s/);
  assert.match(independenceQuestions, /Sales & Marketing/);
  assert.doesNotMatch(performanceUi, /Retained Earnings Growth/);
  assert.doesNotMatch(financialApi, /retainedEarningsGrowth/);
  assert.match(performanceUi, /ccBookkeepingSyncNotice/);
  assert.match(performanceUi, /toLocaleString\('en-US'/);
});

test('scorecard and goals use generic priority language and validation help', () => {
  assert.match(scorecardUi, /data-validation-help/);
  assert.match(scorecardUi, /What a contradiction means/);
  assert.doesNotMatch(goalsUi, />90-Day Rocks</);
});

test('connected QuickBooks is auto-detected and available to billing and people', () => {
  assert.match(integrations, /autoDetect=\['QuickBooks Online'\]/);
  assert.match(integrations, /'HR & People':\['QuickBooks Online'/);
  assert.match(integrations, /'Billing':\['QuickBooks Online'/);
});


test('Performance Index has a dedicated Data Source setup with automatic and manual modes', () => {
  assert.match(performanceFlow, /Data Source/);
  assert.match(performanceFlow, /Automatic Sync/);
  assert.match(performanceFlow, /Manual Upload/);
  assert.match(performanceFlow, /Trouble syncing\? Upload PDF instead/);
  assert.doesNotMatch(performanceFlow, /function uploadBody\(/);
});

test('integration selection is category scoped and persisted with diagnostic state', () => {
  assert.match(integrations, /agencyIntegrationSelections/);
  assert.match(integrations, /selectionFor\(activeCategory\)/);
  assert.match(diagnosticState, /integrationSelections:/);
});

test('Monitor departments hide data until a related integration category is selected', () => {
  assert.match(auth, /MONITOR_INTEGRATION_CATEGORIES/);
  assert.match(auth, /billing:\['Billing'\]/);
  assert.match(auth, /finance:\['Bookkeeping'\]/);
  assert.match(auth, /'talent-acquisition':\['HR & People'\]/);
  assert.match(departmentLive, /integrationRequired/);
  assert.match(departmentLive, /does not automatically feed this department/);
  assert.match(leadershipLive, /Calendar & Meetings/);
});

test('completed Agency Goals do not relock Monitor during later diagnostic syncs', () => {
  assert.match(workspaceAccess, /agencyGoalsComplete/);
  assert.match(auth, /integrationSelections/);
});
