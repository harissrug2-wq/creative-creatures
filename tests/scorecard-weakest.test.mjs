import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const api = fs.readFileSync(new URL('../api/scorecard.js', import.meta.url), 'utf8');
const start = api.indexOf('function scorecardPriorities(');
const end = api.indexOf('function buildModel(', start);
const code = api.slice(start, end) + ';scorecardPriorities';

const scorecardPriorities = vm.runInNewContext(code, {
  performanceRecommendations: { profitability: 'Improve profitability' },
  strengthRecommendations: { operating: 'Improve operations' },
  independenceRecommendations: { decision: 'Delegate decisions' }
});

test('scorecard priorities expose weakest rows used by buildModel', () => {
  const reports = {
    performance: {
      id: 'performance',
      title: 'Agency Performance Index',
      categories: [
        { key: 'profitability', name: 'Profitability', score: 42, weight: 25 },
        { key: 'growth', name: 'Growth Performance', score: 70, weight: 20 }
      ]
    },
    strength: {
      id: 'strength',
      title: 'Agency Strength Index',
      categories: [
        { key: 'operating', name: 'Operating System', score: 55, weight: 20 }
      ]
    },
    independence: {
      id: 'independence',
      title: 'Owner Independence Index',
      categories: [
        { key: 'decision', name: 'Decision Independence', score: 60, weight: 20 }
      ]
    }
  };

  const result = scorecardPriorities(reports);
  assert.ok(Array.isArray(result.weakest));
  assert.equal(result.weakest[0].name, 'Profitability');
  assert.equal(result.weakest[0].score, 42);
  assert.equal(result.issues.length, result.weakest.length);
  assert.equal(result.opportunities.length, result.weakest.length);
});

test('buildModel destructures weakest before returning it', () => {
  assert.match(api, /const \{weakest,issues,opportunities\} = scorecardPriorities\(reports\);/);
});
