import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const reporting = fs.readFileSync(new URL('../public/portal/reporting.js', import.meta.url), 'utf8');
const scorecard = fs.readFileSync(new URL('../public/portal/scorecard.js', import.meta.url), 'utf8');

test('individual index downloads generate a detail page instead of a one-page shell', () => {
  assert.match(reporting, /const repList = isScorecard \? Object\.values\(reports\) : \[model\];/);
  assert.match(reporting, /PAGES 2\+: INDEX DETAILS/);
});

test('free AOFI scorecard uses AOFI trademark naming', () => {
  assert.match(scorecard, /Agency Owner Freedom Index™ Scorecard/);
  assert.match(scorecard, /AOFI™ Scorecard/);
});
