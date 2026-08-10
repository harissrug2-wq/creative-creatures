(() => {
  const INDEXES = ['strength', 'independence', 'performance'];
  const SCORE_KEYS = {
    strength: 'agencyStrengthScore',
    independence: 'ownerIndependenceScore',
    performance: 'agencyPerformanceScore'
  };
  const COMPLETE_KEYS = {
    strength: 'ccIndexStrengthComplete',
    independence: 'ccIndexIndependenceComplete',
    performance: 'ccIndexPerformanceComplete'
  };
  const PROGRESS_KEYS = {
    strength: 'ccIndexStrengthProgress',
    independence: 'ccIndexIndependenceProgress',
    performance: 'ccIndexPerformanceProgress'
  };

  const hasValue = (key) => {
    const value = localStorage.getItem(key);
    return value !== null && value !== '' && value !== 'null' && value !== 'undefined';
  };

  const asPercent = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(100, Math.round(number)));
  };

  const isOwnerComplete = () => {
    if (localStorage.getItem('ownerIdentityComplete') === 'true') return true;
    try {
      const account = JSON.parse(localStorage.getItem('cc_account') || 'null');
      return Boolean(account?.report_data && Object.keys(account.report_data).length);
    } catch {
      return false;
    }
  };

  const detailKey = index => `ccIndex${index[0].toUpperCase()}${index.slice(1)}Result`;
  const safeJson = (value, fallback = null) => { try { return JSON.parse(value); } catch { return fallback; } };

  const getIndex = (index) => {
    const complete = hasValue(SCORE_KEYS[index]) || localStorage.getItem(COMPLETE_KEYS[index]) === 'true';
    const progress = complete ? 100 : asPercent(localStorage.getItem(PROGRESS_KEYS[index]));
    const score = complete ? asPercent(localStorage.getItem(SCORE_KEYS[index])) : null;
    const details = safeJson(localStorage.getItem(detailKey(index)), null);
    return { complete, progress, score, details };
  };

  const getState = () => {
    const indexes = Object.fromEntries(INDEXES.map(index => [index, getIndex(index)]));
    const count = INDEXES.filter(index => indexes[index].complete).length;
    const allComplete = count === INDEXES.length;
    const reportReady = allComplete && localStorage.getItem('ccDiagnosticReportReady') === 'true';
    const next = !indexes.strength.complete
      ? 'strength'
      : !indexes.independence.complete
        ? 'independence'
        : !indexes.performance.complete
          ? 'performance'
          : reportReady ? 'scorecard' : 'generate';

    return {
      ownerComplete: isOwnerComplete(),
      strength: indexes.strength.complete,
      independence: indexes.independence.complete,
      performance: indexes.performance.complete,
      indexes,
      count,
      allComplete,
      reportReady,
      unlocked: reportReady,
      next,
      generatedAt: localStorage.getItem('ccDiagnosticGeneratedAt') || null
    };
  };

  const reportUrl = () => {
    const token = localStorage.getItem('ownerArchetypeReportToken');
    return token ? `/owner-archetype/report/${encodeURIComponent(token)}/` : '/owner-archetype/assessment/';
  };

  let syncTimer = null;
  const sync = (immediate = false) => {
    const run = () => {
      syncTimer = null;
      if (window.CCAccount?.syncDiagnosticState) {
        window.CCAccount.syncDiagnosticState(serialize()).catch(() => null);
      }
    };
    if (immediate) {
      if (syncTimer) clearTimeout(syncTimer);
      run();
      return;
    }
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(run, 650);
  };

  const invalidateReport = () => {
    localStorage.removeItem('ccDiagnosticReportReady');
    localStorage.removeItem('ccDiagnosticGeneratedAt');
    localStorage.removeItem('agencyScorecardGenerated');
    localStorage.removeItem('diagnosticComplete');
  };

  const setProgress = (index, progress, options = {}) => {
    if (!INDEXES.includes(index)) return getState();
    const current = getIndex(index);
    if (current.complete && !options.allowCompleted) return getState();
    localStorage.setItem(PROGRESS_KEYS[index], String(asPercent(progress)));
    localStorage.setItem('ccDiagnosticUpdatedAt', new Date().toISOString());
    sync();
    return getState();
  };

  const mark = (index, score, details = null) => {
    if (!INDEXES.includes(index)) return getState();
    const value = String(asPercent(score));
    localStorage.setItem(SCORE_KEYS[index], value);
    localStorage.setItem(COMPLETE_KEYS[index], 'true');
    localStorage.setItem(PROGRESS_KEYS[index], '100');
    if (details !== null) localStorage.setItem(detailKey(index), JSON.stringify(details));
    localStorage.setItem('ccDiagnosticUpdatedAt', new Date().toISOString());
    invalidateReport();
    sync(true);
    return getState();
  };

  const completeReportGeneration = () => {
    const state = getState();
    if (!state.allComplete) return state;
    localStorage.setItem('ccDiagnosticReportReady', 'true');
    const generatedAt = new Date().toISOString();
    localStorage.setItem('ccDiagnosticGeneratedAt', generatedAt);
    localStorage.setItem('agencyScorecardGenerated', 'true');
    localStorage.setItem('diagnosticComplete', 'true');
    localStorage.removeItem('ccDiagnosticProcessing');
    sync(true);
    return getState();
  };

  const restore = (diagnosticState = {}) => {
    const source = diagnosticState || {};
    INDEXES.forEach(index => {
      const data = source.indexes?.[index] || source[index] || {};
      if (data.score !== undefined && data.score !== null) localStorage.setItem(SCORE_KEYS[index], String(asPercent(data.score)));
      if (data.complete === true || data.score !== undefined) localStorage.setItem(COMPLETE_KEYS[index], 'true');
      if (data.progress !== undefined) localStorage.setItem(PROGRESS_KEYS[index], String(asPercent(data.progress)));
      if (data.details !== undefined && data.details !== null) localStorage.setItem(detailKey(index), JSON.stringify(data.details));
    });
    if (source.reportReady === true || source.report_ready === true) localStorage.setItem('ccDiagnosticReportReady', 'true');
    if (source.generatedAt || source.generated_at) localStorage.setItem('ccDiagnosticGeneratedAt', source.generatedAt || source.generated_at);
    return getState();
  };

  const serialize = () => {
    const state = getState();
    return {
      indexes: state.indexes,
      count: state.count,
      allComplete: state.allComplete,
      reportReady: state.reportReady,
      generatedAt: state.generatedAt,
      updatedAt: localStorage.getItem('ccDiagnosticUpdatedAt') || new Date().toISOString()
    };
  };

  window.CCDiagnostic = {
    INDEXES,
    getState,
    reportUrl,
    setProgress,
    mark,
    invalidateReport,
    completeReportGeneration,
    restore,
    serialize,
    isOwnerComplete
  };
})();
