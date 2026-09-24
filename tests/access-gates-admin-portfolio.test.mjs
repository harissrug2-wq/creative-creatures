import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const shell = fs.readFileSync(new URL('../public/portal/app-shell.js', import.meta.url), 'utf8');
const access = fs.readFileSync(new URL('../public/shared/workspace-access.js', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../api/account-auth.js', import.meta.url), 'utf8');
const accounts = fs.readFileSync(new URL('../api/accounts.js', import.meta.url), 'utf8');
const admin = fs.readFileSync(new URL('../public/admin/admin.js', import.meta.url), 'utf8');
const archetypeCss = fs.readFileSync(new URL('../public/archetype/archetype.css', import.meta.url), 'utf8');

test('free AOFI navigation exposes preview-only upgrade pages and plan tag', () => {
  assert.match(auth, /previewFeatures=plan==='aofi_free'\?\['monitor','goals','integrations'\]/);
  assert.match(shell, /Free AOFI™/);
  assert.match(shell, /data-account-plan-tag/);
});

test('workflow gates use dynamic prerequisite messages', () => {
  assert.match(access, /Complete your Agency Diagnostic first/);
  assert.match(access, /Generate your Agency Scorecard to open/);
  assert.match(access, /Upgrade to use/);
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
});

test('owner identity card sizing matches signup card scale', () => {
  assert.match(archetypeCss, /width:min\(1040px/);
  assert.match(archetypeCss, /min-height:78px!important/);
  assert.match(archetypeCss, /font-size:24px!important/);
});
