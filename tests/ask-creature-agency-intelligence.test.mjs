import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { scope } from '../lib/ask-creature-chat.js';
import { instructions } from '../lib/ask-creature-knowledge.js';

const account={id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'};

test('partners can use Ask Creature with private chat history',()=>{
  const query=scope(account,{role:'partner',memberId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'});
  assert.match(query,/account_id=eq\.aaaaaaaa/);
  assert.match(query,/member_id=eq\.bbbbbbbb/);
});

test('Ask Creature prompt covers product and agency intelligence',()=>{
  const prompt=instructions();
  assert.match(prompt,/any relevant question about Creative Creatures or the signed-in user's agency/);
  assert.match(prompt,/retrieve/i);
  assert.match(prompt,/connectedData/);
  assert.match(prompt,/read-only/);
  assert.match(prompt,/Ownership & Partners/);
});

test('live retrieval supports workspace context, integration inventory and detailed QuickBooks evidence',()=>{
  const source=fs.readFileSync(new URL('../api/account-auth.js',import.meta.url),'utf8');
  assert.match(source,/creatureWorkspaceContext/);
  assert.match(source,/creatureIntegrationInventory/);
  assert.match(source,/creatureQuickBooksContext/);
  assert.match(source,/fetchProfitLossEvidence/);
  assert.match(source,/fetchBalanceSheetEvidence/);
  assert.match(source,/fetchArAgingEvidence/);
  assert.match(source,/fetchClientRevenueEvidence/);
  assert.match(source,/fetchServiceRevenueEvidence/);
});

test('generic project questions can read all connected project tools',()=>{
  const source=fs.readFileSync(new URL('../api/account-auth.js',import.meta.url),'utf8');
  assert.match(source,/isExplicit\|\|!anyExplicit/);
  assert.match(source,/loadJiraDashboard/);
  assert.match(source,/loadClickUpDashboard/);
  assert.match(source,/loadMondayDashboard/);
  assert.match(source,/loadTeamworkDashboard/);
});

test('Ask Creature UI tells users it is checking connected sources',()=>{
  const ui=fs.readFileSync(new URL('../public/shared/ask-creature-ui.js',import.meta.url),'utf8');
  assert.match(ui,/Checking your agency and connected sources/);
  assert.match(ui,/Ask anything about Creative Creatures or your agency/);
});
