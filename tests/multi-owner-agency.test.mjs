import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync(new URL('../supabase/migrations/20260926204500_multi_owner_agency_ownership.sql',import.meta.url),'utf8');
const ownershipApi=fs.readFileSync(new URL('../api/ownership.js',import.meta.url),'utf8');
const ownershipUi=fs.readFileSync(new URL('../public/portal/ownership.js',import.meta.url),'utf8');
const accounts=fs.readFileSync(new URL('../api/accounts.js',import.meta.url),'utf8');
const auth=fs.readFileSync(new URL('../api/account-auth.js',import.meta.url),'utf8');
const diagnostic=fs.readFileSync(new URL('../diagnostic/index.html',import.meta.url),'utf8');
const scorecardApi=fs.readFileSync(new URL('../api/scorecard.js',import.meta.url),'utf8');
const scorecardUi=fs.readFileSync(new URL('../public/portal/scorecard.js',import.meta.url),'utf8');

test('ownership schema supports partners, history, and scorecard snapshots',()=>{
  assert.match(migration,/create table if not exists public\.agency_owners/);
  assert.match(migration,/create table if not exists public\.agency_ownership_snapshots/);
  assert.match(migration,/create table if not exists public\.agency_scorecard_history/);
  assert.match(migration,/role in \('member','partner'\)/);
  assert.match(migration,/ownership_snapshot_id/);
});

test('new agencies initialize ownership and existing agencies can add partners',()=>{
  assert.match(accounts,/initializeOwnership/);
  assert.match(accounts,/body\.owners \|\| body\.partners/);
  assert.match(ownershipApi,/save_ownership/);
  assert.match(ownershipApi,/Ownership must total 100%/);
  assert.match(ownershipApi,/ownership_update/);
  assert.match(ownershipApi,/status:'former'/);
});

test('partners are invited to the same agency workspace',()=>{
  assert.match(ownershipApi,/role:'partner'/);
  assert.match(ownershipApi,/temporaryPassword/);
  assert.match(ownershipApi,/You've been added as an agency partner/);
  assert.match(auth,/member\.role==='partner'\?DEPARTMENTS/);
});

test('ownership changes target owner independence without resetting agency indexes',()=>{
  assert.match(ownershipApi,/ownerIndependenceNeedsReview/);
  assert.match(ownershipApi,/scorecardNeedsRefresh/);
  assert.match(ownershipApi,/indexes\.independence/);
  assert.match(diagnostic,/Reassess Owner Independence/);
  assert.match(diagnostic,/Agency Strength and Performance results are preserved/);
});

test('scorecard is tied to and archives ownership snapshots',()=>{
  assert.match(scorecardApi,/getLatestOwnershipSnapshot/);
  assert.match(scorecardApi,/archiveScorecardForOwnershipChange/);
  assert.match(scorecardApi,/agency_scorecard_history/);
  assert.match(scorecardApi,/ownership_snapshot_id/);
  assert.match(scorecardUi,/Ownership structure/);
});

test('ownership management UI supports one or multiple owners',()=>{
  assert.match(ownershipUi,/Add Partner/);
  assert.match(ownershipUi,/Total ownership/);
  assert.match(ownershipUi,/Confirm Ownership Structure/);
  assert.match(ownershipUi,/Ownership history/);
});
