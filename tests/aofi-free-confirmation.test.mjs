import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const lookup = fs.readFileSync(new URL('../public/shared/owner-identity-lookup.js', import.meta.url), 'utf8');

test('free AOFI activation renders confirmation before diagnostic redirect', () => {
  assert.match(lookup, /showFreeAofiConfirmation\(lead, data\)/);
  assert.doesNotMatch(lookup, /location\.href='\/diagnostic\/'/);
});

test('confirmation screen includes account email and next-step actions', () => {
  assert.match(lookup, /Your Free AOFI™ account has been created successfully/);
  assert.match(lookup, /confirmation email/);
  assert.match(lookup, /Continue to Agency Diagnostic/);
  assert.match(lookup, /Sign In Later/);
});
