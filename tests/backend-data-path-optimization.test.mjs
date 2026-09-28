import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const auth=fs.readFileSync(new URL('../api/account-auth.js',import.meta.url),'utf8');
const accounts=fs.readFileSync(new URL('../api/accounts.js',import.meta.url),'utf8');
const integrations=fs.readFileSync(new URL('../integrations/index.html',import.meta.url),'utf8');
const monitor=fs.readFileSync(new URL('../public/monitor/department-live.js',import.meta.url),'utf8');

test('Monitor avoids a duplicate account fetch and retains client department caching',()=>{
  assert.match(auth,/loadMonitorDepartment\(c,accountId,department,providedAccount=null\)/);
  assert.match(auth,/Promise\.all\(\[findById\(c,session\.accountId\),sessionActor\(c,session\)\]\)/);
  assert.match(auth,/loadMonitorDepartment\(c,session\.accountId,clean\(b\.department\),account\)/);
  assert.match(monitor,/MONITOR_CACHE_TTL=30000/);
});

test('integration statuses use short-lived server and browser caches',()=>{
  assert.match(auth,/INTEGRATION_STATUS_CACHE_TTL=10000/);
  assert.match(auth,/integrationStatusCache/);
  assert.match(integrations,/STATUS_CACHE_TTL=15000/);
  assert.match(integrations,/cc_integration_statuses/);
  assert.match(integrations,/fresh:'1'/);
});

test('Ask Creature overlaps workspace context and parallelizes multi-provider reads',()=>{
  assert.match(auth,/workspaceContextPromise=creatureWorkspaceContext/);
  assert.match(auth,/integrationInventoryPromise/);
  assert.match(auth,/Promise\.all\(enabledOptions\.map/);
  assert.match(auth,/Promise\.all\(\[\s*creatureTrySource\(sources,'slack'/);
  assert.match(auth,/Promise\.all\(\[getFreshBooksConnection/);
  assert.match(auth,/providedConnection\|\|await getQuickBooksConnection/);
});

test('Admin portfolio queries only relevant accounts and diagnostic runs',()=>{
  assert.match(accounts,/account_id=in\.\(/);
  assert.match(accounts,/diagnostic_run_id=in\.\(/);
  assert.match(accounts,/const scoped=path=>/);
  assert.match(accounts,/runIds\.length/);
});
