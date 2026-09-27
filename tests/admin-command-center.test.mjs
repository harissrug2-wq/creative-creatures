import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dashboard=fs.readFileSync(new URL('../admin/index.html',import.meta.url),'utf8');
const diagnostics=fs.readFileSync(new URL('../admin/diagnostics/index.html',import.meta.url),'utf8');
const adminJs=fs.readFileSync(new URL('../public/admin/admin.js',import.meta.url),'utf8');
const vite=fs.readFileSync(new URL('../vite.config.js',import.meta.url),'utf8');

test('admin home is a portfolio command center',()=>{
  assert.match(dashboard,/Creative Creatures Overview/);
  assert.match(dashboard,/adminDashboardMetrics/);
  assert.match(dashboard,/adminPlanMix/);
  assert.match(dashboard,/adminJourneyHealth/);
  assert.match(dashboard,/adminAttentionList/);
  assert.match(dashboard,/adminRecentAgencies/);
});

test('diagnostics remain available on a dedicated route',()=>{
  assert.match(diagnostics,/data-admin-plan="diagnostic"/);
  assert.match(diagnostics,/Diagnostics/);
  assert.match(vite,/adminDiagnostics/);
  assert.match(vite,/admin', 'diagnostics', 'index\.html/);
});

test('dashboard computes live portfolio, readiness and follow-up views',()=>{
  assert.match(adminJs,/renderAdminDashboard/);
  assert.match(adminJs,/Scorecards ready/);
  assert.match(adminJs,/Agency Goals complete/);
  assert.match(adminJs,/Agencies requiring follow-up|Diagnostic complete — Scorecard still needs generation/);
  assert.match(adminJs,/adminWorkspaceUrl\('\/platform\/'/);
});

test('admin home can create any account type',()=>{
  assert.match(adminJs,/Free AOFI™/);
  assert.match(adminJs,/1:1 Diagnostic/);
  assert.match(adminJs,/Accelerator/);
  assert.match(adminJs,/Platform/);
  assert.match(adminJs,/Fractional COO/);
});
