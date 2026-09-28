import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const diagnostic=fs.readFileSync(new URL('../diagnostic/index.html',import.meta.url),'utf8');
const accountClient=fs.readFileSync(new URL('../public/portal/account-client.js',import.meta.url),'utf8');
const archetype=fs.readFileSync(new URL('../public/archetype/archetype.js',import.meta.url),'utf8');
const accountsApi=fs.readFileSync(new URL('../api/accounts.js',import.meta.url),'utf8');

test('existing backend workspaces missing Owner Identity go to the assessment, not signup lookup',()=>{
  assert.match(diagnostic,/hasWorkspace/);
  assert.match(diagnostic,/owner-archetype\/assessment/);
  assert.match(diagnostic,/signup\/lookup\/\?destination=diagnostic/);
});

test('Owner Identity completion enriches the signed-in workspace instead of creating a new lead',()=>{
  assert.match(accountClient,/async function updateOwnerIdentity/);
  assert.match(accountClient,/method: 'PATCH'/);
  assert.match(archetype,/window\.CCAccount\.updateOwnerIdentity/);
  assert.match(archetype,/currentEmail === payloadEmail/);
});

test('accounts API accepts authenticated archetype answers with report and result data',()=>{
  assert.match(accountsApi,/archetypeAnswers/);
  assert.match(accountsApi,/patch\.archetype_answers/);
  assert.match(accountsApi,/patch\.report_data/);
  assert.match(accountsApi,/patch\.archetype_result/);
});
