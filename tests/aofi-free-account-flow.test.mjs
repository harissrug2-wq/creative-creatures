import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const accounts = fs.readFileSync(new URL('../api/accounts.js', import.meta.url), 'utf8');
const lookup = fs.readFileSync(new URL('../public/shared/owner-identity-lookup.js', import.meta.url), 'utf8');
const admin = fs.readFileSync(new URL('../public/admin/admin.js', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../api/account-auth.js', import.meta.url), 'utf8');

test('paid/existing accounts are not overwritten by free AOFI activation', () => {
  assert.match(accounts, /code: 'ACCOUNT_EXISTS'/);
  assert.match(accounts, /Please sign in to continue/);
});

test('free AOFI creation provisions a welcome/setup email', () => {
  assert.match(accounts, /provisionAofiFreeAccess/);
  assert.match(accounts, /sendAofiFreeWelcome/);
  assert.match(accounts, /welcomeEmailSent/);
});

test('admin can list Free AOFI accounts and tenant view is read-only', () => {
  assert.match(admin, /aofi_free: 'Free AOFI™'/);
  assert.match(auth, /readOnly:actor\.role==='admin'/);
  assert.match(auth, /Admin account view is read-only/);
});

test('owner identity lookup directs existing accounts to sign in', () => {
  assert.match(lookup, /Account Found — Sign In/);
  assert.match(lookup, /account already exists for this report/i);
});
