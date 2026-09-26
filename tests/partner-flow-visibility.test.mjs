import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const monitor=fs.readFileSync(new URL('../public/monitor/monitor.js',import.meta.url),'utf8');
const signup=fs.readFileSync(new URL('../public/portal/signup-3.js',import.meta.url),'utf8');
const checkout=fs.readFileSync(new URL('../public/payment/stripe-checkout.js',import.meta.url),'utf8');
const payment=fs.readFileSync(new URL('../api/payment-confirmation.js',import.meta.url),'utf8');

test('Users page visibly exposes partner management',()=>{
  assert.match(monitor,/Owners & Partners/);
  assert.match(monitor,/＋ Add Partner/);
  assert.match(monitor,/People/);
  assert.match(monitor,/href="\/ownership\/\?add=1"/);
});

test('new signup visibly captures one or multiple owners',()=>{
  assert.match(signup,/Does this agency have more than one owner\?/);
  assert.match(signup,/Multiple owners \/ partners/);
  assert.match(signup,/ccPendingOwnership/);
  assert.match(signup,/Ownership must total 100%/);
});

test('signup ownership reaches Stripe order fulfillment',()=>{
  assert.match(checkout,/ccPendingOwnership/);
  assert.match(payment,/ownership_draft/);
  assert.match(payment,/applySignupOwnership/);
  assert.match(payment,/role:'partner'/);
  assert.match(payment,/signup_ownership/);
});
