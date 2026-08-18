const finite = value => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const round2 = value => Math.round(Number(value) * 100) / 100;
const roundMoney = value => Math.round(Number(value));

function getPath(object, path) {
  if (!object || typeof object !== 'object') return null;
  let current = object;
  for (const part of String(path).split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') return null;
    current = current[part];
  }
  return current;
}

function firstNumber(objects, paths) {
  for (const object of objects) {
    for (const path of paths) {
      const value = finite(getPath(object, path));
      if (value !== null) return value;
    }
  }
  return null;
}

function indexMap(indexRows = []) {
  return Object.fromEntries((Array.isArray(indexRows) ? indexRows : []).map(row => [row.index_type, row]));
}

export function performanceBaseMultiple(score) {
  const value = finite(score);
  if (value === null) return null;
  if (value >= 90) return 5.50;
  if (value >= 80) return 4.75;
  if (value >= 70) return 4.00;
  if (value >= 60) return 3.25;
  if (value >= 50) return 2.75;
  return 2.00;
}

export function strengthMultipleAdjustment(score) {
  const value = finite(score);
  if (value === null) return null;
  if (value >= 90) return 0.75;
  if (value >= 80) return 0.50;
  if (value >= 70) return 0.25;
  if (value >= 60) return 0.00;
  return -0.25;
}

export function independenceMultipleAdjustment(score) {
  const value = finite(score);
  if (value === null) return null;
  if (value >= 90) return 0.75;
  if (value >= 80) return 0.50;
  if (value >= 70) return 0.25;
  if (value >= 60) return 0.00;
  return -0.50;
}

export function roicLiteMultipleAdjustment(roicLite) {
  const value = finite(roicLite);
  if (value === null) return null;
  if (value < 0) return -0.25;
  if (value > 40) return 0.25;
  if (value >= 20) return 0.10;
  return 0.00;
}

function revenueMetric(category, key) {
  const metrics = category?.metrics;
  if (!Array.isArray(metrics)) return null;
  return metrics.find(metric => metric?.key === key) || null;
}

function revenueQualityEvidence(performance) {
  const details = performance?.details && typeof performance.details === 'object' ? performance.details : {};
  const categories = performance?.category_scores && typeof performance.category_scores === 'object'
    ? performance.category_scores
    : (details.categoryScores && typeof details.categoryScores === 'object' ? details.categoryScores : {});
  const category = categories.revenueQuality || categories.revenue_quality || {};
  const financials = details.financials && typeof details.financials === 'object' ? details.financials : {};

  const recurringMetric = revenueMetric(category, 'recurringRevenue');
  const concentrationMetric = revenueMetric(category, 'clientConcentration');
  const diversificationMetric = revenueMetric(category, 'revenueDiversification');
  const contractMetric = revenueMetric(category, 'contractDuration');

  return {
    recurringRevenuePercent: firstNumber([financials, details, recurringMetric], [
      'recurringRevenuePercent', 'recurring_revenue_percent', 'value'
    ]),
    topClientPercent: firstNumber([financials, details, concentrationMetric], [
      'topClientPercent', 'largestClientPercent', 'top_client_percent', 'value'
    ]),
    // Keep qualitative levels scoped to their actual metric row. Do not fall
    // through to details.score, which is the overall Performance score.
    diversificationLevel: firstNumber([details], [
      'revenueDiversificationLevel', 'financials.revenueDiversificationLevel'
    ]) ?? firstNumber([diversificationMetric], ['value']),
    contractDurationLevel: firstNumber([details], [
      'contractDurationLevel', 'financials.contractDurationLevel'
    ]) ?? firstNumber([contractMetric], ['value']),
    categoryScore: firstNumber([category], ['categoryScore', 'score']),
    coverage: firstNumber([category], ['coverage'])
  };
}

export function revenueQualityMultipleAdjustment(evidence = {}) {
  const recurring = finite(evidence.recurringRevenuePercent);
  const concentration = finite(evidence.topClientPercent);
  const diversification = finite(evidence.diversificationLevel);
  const contractDuration = finite(evidence.contractDurationLevel);

  // Agency Valuation(TM) gives two explicit cases: a +0.25 premium for high
  // recurring revenue + diversified clients + long-term contracts, and a
  // -0.25 discount for heavy project work or client concentration. Existing
  // Performance rubric thresholds are used to translate those descriptions.
  const heavyProjectWork = recurring !== null && recurring < 40;
  const concentrated = concentration !== null && concentration > 30;
  if (heavyProjectWork || concentrated) {
    return { adjustment: -0.25, classification: 'discount', missing: [] };
  }

  const highRecurring = recurring !== null && recurring >= 80;
  const diversified = (diversification !== null && diversification >= 3)
    || (concentration !== null && concentration < 15);
  const longTermContracts = contractDuration !== null && contractDuration >= 3;
  if (highRecurring && diversified && longTermContracts) {
    return { adjustment: 0.25, classification: 'premium', missing: [] };
  }

  // If recurring revenue and concentration are both known and neither explicit
  // premium/discount case applies, the adjustment is neutral. This prevents
  // valuation from being blocked by optional qualitative fields while still
  // refusing to guess when core revenue-quality evidence is absent.
  const missing = [];
  if (recurring === null) missing.push('recurring revenue %');
  if (concentration === null) missing.push('largest client concentration %');
  if (missing.length) return { adjustment: null, classification: 'insufficient_evidence', missing };
  return { adjustment: 0.00, classification: 'neutral', missing: [] };
}

export function buildValuationSnapshot(indexRows = [], options = {}) {
  const map = indexMap(indexRows);
  const performance = map.performance || {};
  const strength = map.strength || {};
  const independence = map.independence || {};
  const performanceDetails = performance.details && typeof performance.details === 'object' ? performance.details : {};

  const adjustedSDE = firstNumber([performanceDetails], [
    'adjustedSDE', 'adjustedSde', 'adjusted_sde', 'sde',
    'financials.adjustedSDE', 'financials.adjustedSde', 'financials.adjusted_sde'
  ]);
  const performanceScore = finite(performance.score);
  const strengthScore = finite(strength.score);
  const independenceScore = finite(independence.score);
  const performanceCategories = performance?.category_scores && typeof performance.category_scores === 'object'
    ? performance.category_scores
    : (performanceDetails.categoryScores && typeof performanceDetails.categoryScores === 'object' ? performanceDetails.categoryScores : {});
  const capitalCategory = performanceCategories.capital || {};
  const roicMetric = revenueMetric(capitalCategory, 'returnOnCapital');
  const roicLite = firstNumber([performanceDetails], [
    'roicLite', 'roic_lite', 'financials.roicLite', 'financials.roic_lite'
  ]) ?? firstNumber([roicMetric], ['value']);
  const revenueQuality = revenueQualityEvidence(performance);
  const revenueQualityResult = revenueQualityMultipleAdjustment(revenueQuality);

  // The valuation document still produces an estimate when some supporting
  // evidence is missing; it lowers confidence rather than declaring the
  // valuation impossible. Only the earnings base and the three index scores
  // are hard blockers. Missing optional adjustments are neutral (0.00) and
  // are disclosed as evidence gaps instead of being fabricated.
  const missingInputs = [];
  if (adjustedSDE === null || adjustedSDE <= 0) missingInputs.push('positive Adjusted SDE');
  if (performanceScore === null) missingInputs.push('Agency Performance Index score');
  if (strengthScore === null) missingInputs.push('Agency Strength Index score');
  if (independenceScore === null) missingInputs.push('Owner Independence Index score');
  const evidenceGaps = [];
  if (roicLite === null) evidenceGaps.push('ROIC-Lite');
  evidenceGaps.push(...revenueQualityResult.missing);

  const calculatedAt = options.calculatedAt || new Date().toISOString();
  const common = {
    methodology: 'Agency Valuation™',
    methodologyVersion: 'agency-valuation-2026-step7b',
    calculatedAt,
    diagnosticRunId: options.diagnosticRunId || null,
    adjustedSDE,
    inputs: {
      performanceScore,
      strengthScore,
      independenceScore,
      roicLite,
      revenueQuality
    },
    evidenceGaps: [...new Set(evidenceGaps)],
    confidence: null,
    confidenceNote: 'The approved valuation document does not define a numeric valuation-confidence formula, so no confidence percentage is fabricated.'
  };

  if (missingInputs.length) {
    return {
      ...common,
      status: 'insufficient_evidence',
      available: false,
      missingInputs: [...new Set(missingInputs)],
      baseMultiple: null,
      adjustments: {
        strength: strengthScore === null ? null : strengthMultipleAdjustment(strengthScore),
        ownerIndependence: independenceScore === null ? null : independenceMultipleAdjustment(independenceScore),
        roicLite: roicLite === null ? null : roicLiteMultipleAdjustment(roicLite),
        revenueQuality: revenueQualityResult.adjustment
      },
      revenueQualityClassification: revenueQualityResult.classification,
      finalMultiple: null,
      enterpriseValue: null
    };
  }

  const baseMultiple = performanceBaseMultiple(performanceScore);
  const adjustments = {
    strength: strengthMultipleAdjustment(strengthScore),
    ownerIndependence: independenceMultipleAdjustment(independenceScore),
    roicLite: roicLite === null ? 0.00 : roicLiteMultipleAdjustment(roicLite),
    revenueQuality: revenueQualityResult.adjustment === null ? 0.00 : revenueQualityResult.adjustment
  };
  const finalMultiple = round2(baseMultiple
    + adjustments.strength
    + adjustments.ownerIndependence
    + adjustments.roicLite
    + adjustments.revenueQuality);
  const enterpriseValue = roundMoney(adjustedSDE * finalMultiple);

  return {
    ...common,
    status: evidenceGaps.length ? 'complete_with_evidence_gaps' : 'complete',
    available: true,
    missingInputs: [],
    baseMultiple,
    adjustments,
    revenueQualityClassification: revenueQualityResult.classification,
    finalMultiple,
    enterpriseValue
  };
}

export function withValuationReportData(reportData = {}, snapshot) {
  const current = reportData && typeof reportData === 'object' ? reportData : {};
  const next = {
    ...current,
    valuation: snapshot,
    enterpriseValuation: snapshot?.available ? snapshot.enterpriseValue : null,
    enterprise_valuation: snapshot?.available ? snapshot.enterpriseValue : null
  };
  return next;
}
