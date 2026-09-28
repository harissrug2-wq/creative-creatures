import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const auth=fs.readFileSync(new URL('../api/account-auth.js',import.meta.url),'utf8');
const integrations=fs.readFileSync(new URL('../integrations/index.html',import.meta.url),'utf8');
const monitor=fs.readFileSync(new URL('../public/monitor/department-live.js',import.meta.url),'utf8');
const accounts=fs.readFileSync(new URL('../api/accounts.js',import.meta.url),'utf8');
const chat=fs.readFileSync(new URL('../lib/ask-creature-chat.js',import.meta.url),'utf8');

test('integration page loads supported connection statuses in one browser request',()=>{
  assert.match(auth,/integrationStatusSnapshot/);
  assert.match(auth,/action==='integration_statuses'/);
  assert.match(integrations,/apiGet\('integration_statuses'\)/);
  assert.match(integrations,/const statuses=result\?\.statuses/);
});

test('Monitor reuses recent department payloads and parallelizes source loading',()=>{
  assert.match(monitor,/MONITOR_CACHE_TTL=30000/);
  assert.match(monitor,/cc_monitor_department/);
  assert.match(auth,/let sourcePromise=null/);
  assert.match(auth,/sourcePromise=monitorCrmSource/);
  assert.match(auth,/if\(sourcePromise\)source=await sourcePromise/);
});

test('Ask Creature only retrieves expensive context when the answer needs it',()=>{
  assert.match(chat,/loadLiveContext=null/);
  assert.match(chat,/Promise\.all\(\[/);
  assert.match(auth,/loadLiveContext:\(\)=>timing\.run\('connected_data'/);
  assert.doesNotMatch(auth,/const liveContext=await timing\.run\('connected_data'/);
});

test('Ask Creature workspace context is intent scoped',()=>{
  assert.match(auth,/async function creatureWorkspaceContext\(c,account,actor,message=''/);
  assert.match(auth,/wantsOwnership/);
  assert.match(auth,/wantsGoals/);
  assert.match(auth,/wantsUsers/);
});

test('Admin portfolio has a server-side short cache and safe health fallback',()=>{
  assert.match(accounts,/ADMIN_PORTFOLIO_CACHE_TTL=20000/);
  assert.match(accounts,/adminPortfolioCache/);
  assert.match(accounts,/loadAdminPortfolioHealth/);
  assert.match(accounts,/ADMIN_PORTFOLIO_HEALTH_RPC/);
});
