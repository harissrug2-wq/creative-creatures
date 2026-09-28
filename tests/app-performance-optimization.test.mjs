import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workspace=fs.readFileSync(new URL('../public/shared/workspace-access.js',import.meta.url),'utf8');
const goals=fs.readFileSync(new URL('../public/portal/goals-client.js',import.meta.url),'utf8');
const scorecardClient=fs.readFileSync(new URL('../public/portal/scorecard-client.js',import.meta.url),'utf8');
const scorecard=fs.readFileSync(new URL('../public/portal/scorecard.js',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../public/portal/app-shell.js',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('../public/admin/admin.js',import.meta.url),'utf8');
const loader=fs.readFileSync(new URL('../public/shared/page-loader.js',import.meta.url),'utf8');

test('workspace access is briefly cached per account across navigation',()=>{
  assert.match(workspace,/ACCESS_CACHE_TTL=12000/);
  assert.match(workspace,/cc_workspace_access/);
  assert.match(workspace,/invalidateAccess/);
  assert.match(workspace,/account:\$\{identity\}/);
});

test('Agency Goals deduplicates and briefly reuses recent navigation data',()=>{
  assert.match(goals,/let loadPromise = null/);
  assert.match(goals,/SESSION_TTL = 20000/);
  assert.match(goals,/cc_goals_cache/);
  assert.match(goals,/clearSession/);
});

test('Scorecard reuses generated data without forcing a fresh request every navigation',()=>{
  assert.match(scorecardClient,/SESSION_TTL = 120000/);
  assert.match(scorecardClient,/cc_scorecard_cache/);
  assert.match(scorecardClient,/loadPromise/);
  assert.match(scorecard,/load\?\.\(\{ fresh: false \}\)/);
});

test('shared shell starts access loading earlier and renders normal accounts without waiting on admin hydration',()=>{
  assert.match(shell,/data-cc-workspace-preload/);
  assert.match(shell,/adminTenantView/);
});

test('Admin dashboard avoids overlapping refreshes and renders from a short-lived cache',()=>{
  assert.match(admin,/ADMIN_CACHE_TTL = 60000/);
  assert.match(admin,/refreshPromise/);
  assert.match(admin,/hydrateAdminCache/);
  assert.match(admin,/REFRESH_MS = 90000/);
});

test('blocking loader has a bounded fallback',()=>{
  assert.match(loader,/},8000\);/);
});
