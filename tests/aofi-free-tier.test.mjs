import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('AOFI free access tier grants diagnostic, integrations and scorecard only', () => {
  const auth = read('api/account-auth.js');
  assert.match(auth, /aofi_free:\['owner-archetype','bookkeeping','integrations','diagnostic','scorecard'\]/);
  const line = auth.match(/aofi_free:\[[^\n]+/u)?.[0] || '';
  for (const paidOnly of ['goals','monitor','leadership','portal','users','ask']) {
    assert.equal(line.includes(`'${paidOnly}'`), false);
  }
});

test('accounts API allows only the public AOFI free plan without payment', () => {
  const accounts = read('api/accounts.js');
  assert.match(accounts, /requestedPlan === 'aofi_free' \? 'aofi_free' : 'owner_archetype'/);
  assert.match(accounts, /sendAofiFreeWelcome/);
  assert.match(accounts, /setSessionCookie\(res, 'cc_account_session'/);
});

test('database constraint includes AOFI free tier', () => {
  const migration = read('supabase/migrations/20260924014500_aofi_free_access_plan.sql');
  assert.match(migration, /'aofi_free'/);
});

test('Owner Identity lookup can continue into a free AOFI account', () => {
  const lookup = read('signup/lookup/index.html');
  assert.match(lookup, /destination=\['aofi_free'/);
  assert.match(lookup, /Get My Free AOFI™ Score/);
  const portable = read('public/shared/owner-identity-lookup.js');
  assert.match(portable, /accessPlan:'aofi_free'/);
  assert.match(portable, /data-owner-identity-lookup/);
});

test('free scorecard keeps paid actions visible but upgrade-gated', () => {
  const scorecard = read('public/portal/scorecard.js');
  assert.match(scorecard, /const isAofiFree = workspaceAccess\?\.plan === 'aofi_free'/);
  assert.match(scorecard, /showAofiUpgrade/);
  assert.match(scorecard, /Define Agency Goals · Upgrade/);
  assert.match(scorecard, /Agency Valuation/);
});

test('public score request endpoint supports site redirect, email and Slack hook', () => {
  const endpoint = read('api/aofi-free-request.js');
  assert.match(endpoint, /aofreedomindex\.com/);
  assert.match(endpoint, /AOFI_REQUEST_SLACK_WEBHOOK_URL/);
  assert.match(endpoint, /sendRequesterEmail/);
  assert.match(endpoint, /signup\/lookup\/\?destination=aofi_free/);
});
