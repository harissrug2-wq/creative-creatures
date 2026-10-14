(() => {
  const API_BASE = '/api/goals';
  let cached = null;
  let loadPromise = null;
  const SESSION_TTL = 20000;

  const safeJson = (value, fallback = null) => {
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const clean = value => String(value ?? '').trim();
  const finite = value => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const account = () => window.CCAccount?.getAccount?.()
    || safeJson(localStorage.getItem('cc_account'), null)
    || safeJson(localStorage.getItem('ccUserAccount'), null)
    || {};

  function identity() {
    const current = account();
    const params = new URLSearchParams(location.search);
    const tenant = params.get('tenant') || params.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
    return {
      accountId: tenant || (current.id && !String(current.id).startsWith('local-') ? current.id : ''),
      email: tenant ? '' : clean(current.email || localStorage.getItem('ccOwnerEmail')),
      agencyUrl: tenant ? '' : clean(current.agency_url || current.agencyUrl || localStorage.getItem('ccAgencyWebsite'))
    };
  }

  function sessionKey(current = identity()) {
    const key = current.accountId || current.email || current.agencyUrl || 'session';
    return `cc_goals_cache:${key}`;
  }
  function readSession(current) {
    try {
      const row = safeJson(sessionStorage.getItem(sessionKey(current)), null);
      if (!row || Date.now() - Number(row.at || 0) > SESSION_TTL) return null;
      return row.goals || null;
    } catch { return null; }
  }
  function writeSession(current, goals) {
    try { sessionStorage.setItem(sessionKey(current), JSON.stringify({ at: Date.now(), goals })); } catch {}
  }
  function clearSession() {
    try { sessionStorage.removeItem(sessionKey()); } catch {}
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Agency Goals request failed.');
      error.status = response.status;
      error.code = payload.code || null;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  const FALLBACK_DEPARTMENTS = ['Leadership','Marketing','Sales','Onboarding','Billing','Service Delivery','Client Success','Talent Acquisition','Finance','Communication','Systems / IT','SOPs'];
  const FALLBACK_METRICS = [
    { id:'ownerDelivery', group:'Owner Dependency', label:'Owner Time in Delivery (%)', unit:'%' },
    { id:'ownerSales', group:'Owner Dependency', label:'Owner Time in Sales (%)', unit:'%' },
    { id:'revenue', group:'Financial', label:'Revenue (TTM)', unit:'$' },
    { id:'cogs', group:'Financial', label:'COGS % of Revenue', unit:'%' },
    { id:'margin', group:'Financial', label:'Net (Profit) Margin', unit:'%' },
    { id:'sde', group:'Financial', label:'SDE', unit:'$' },
    { id:'leadership', group:'Operational', label:'Leadership Maturity Level', unit:'level' },
    { id:'aofi', group:'Operational', label:'Agency Owner Freedom Index (AOFI) Score', unit:'score' },
    { id:'valuation', group:'Agency Value', label:'Enterprise Valuation', unit:'$' }
  ];

  function display(definition, value) {
    const n = finite(value);
    if (n === null) return '—';
    if (definition.unit === '$') return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
    if (definition.unit === '%') return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
    if (definition.unit === 'level') return `${Number.isInteger(n) ? n : n.toFixed(1)} / 5`;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  async function loadScorecardFallback() {
    const payload = await request('/api/scorecard', { headers: { Accept: 'application/json' } });
    const report = payload.scorecard;
    if (!report) {
      const error = new Error('Generate your AOFI™ Score before defining Agency Goals.');
      error.code = 'SCORECARD_REQUIRED';
      throw error;
    }
    const current = account();
    const valuation = report.valuation && typeof report.valuation === 'object' ? report.valuation : {};
    const values = {
      sde: finite(valuation.adjustedSDE),
      aofi: finite(report.score ?? report.aofiScore ?? report.aofi_score),
      valuation: finite(valuation.enterpriseValue ?? report.enterpriseValue)
    };
    const metrics = FALLBACK_METRICS.map(definition => {
      const value = values[definition.id] ?? null;
      return {
        ...definition,
        available: value !== null,
        evidenceAvailable: value !== null,
        actualValue: value,
        actualDisplay: display(definition, value),
        source: value !== null ? 'Generated Agency Scorecard' : 'Data not available',
        currentSourceType: value !== null ? 'scorecard' : null,
        actualUpdatedAt: report.generatedAt || report.generated_at || null
      };
    });
    const departments = FALLBACK_DEPARTMENTS.map(name => ({
      name, goal:'', owner:'', status:'Needs Definition', done:'', completion:'', completionDate:'', suggestion:null
    }));
    return {
      fallback: true,
      account: {
        id: current.id || payload.accountId || '',
        name: current.name || '',
        email: current.email || '',
        agencyName: current.agency_name || current.agencyName || '',
        accessPlan: current.accessPlan || current.access_plan || current.journey || 'platform',
        journey: current.journey || current.accessPlan || current.access_plan || 'platform'
      },
      hasMonitorAccess: true,
      canManageTeam: true,
      memberCount: 0,
      members: [],
      cardLayout: { metricIds: metrics.map(row => row.id), departmentNames: [] },
      diagnosticRun: { id: payload.diagnosticRunId || '', status:'generated' },
      scorecard: { id: payload.scorecardId || '', aofiScore: values.aofi, generatedAt: report.generatedAt || report.generated_at || null },
      metrics,
      targets: {},
      progress: {},
      progressHistory: {},
      departments,
      rocks: [],
      readiness: {
        targetCount: 0,
        targetTotal: metrics.length,
        definedDepartmentCount: 0,
        departmentTotal: departments.length,
        rockCount: 0,
        evidenceGaps: metrics.filter(row => !row.available).map(row => ({metricId:row.id,label:row.label,reason:'Data not available'})),
        partialDepartments: [],
        incompleteRocks: [],
        canComplete: false
      },
      goalsComplete: Boolean(current.diagnostic_state?.goalsComplete),
      goalsCompletedAt: current.diagnostic_state?.goalsCompletedAt || null
    };
  }

  async function load(options = {}) {
    if (window.CCDemo?.enabled && window.CCDemo?.goals) return window.CCDemo.goals;
    if (cached && options.fresh !== true) return cached;

    try { await window.CCAccount?.ready; } catch {}
    const current = identity();
    if (options.fresh !== true) {
      const saved = readSession(current);
      if (saved) { cached = saved; return cached; }
      if (loadPromise) return loadPromise;
    }

    const pageParams = new URLSearchParams(location.search);
    const adminView = pageParams.get('admin') === '1' || sessionStorage.getItem('cc_admin_mode') === '1';
    const params = new URLSearchParams();
    if (adminView) {
      const tenant = pageParams.get('tenant') || pageParams.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
      if (tenant) {
        params.set('admin','1');
        params.set('tenant',tenant);
        params.set('accountId',tenant);
      }
    }
    const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;

    loadPromise = request(url)
      .then(payload => payload.goals || null)
      .catch(async error => {
        console.warn('Agency Goals API unavailable; using generated Scorecard fallback.', error);
        return loadScorecardFallback();
      })
      .then(model => {
        if (!model) throw new Error('Agency Goals returned no account data.');
        cached = model;
        writeSession(current, model);
        return model;
      })
      .finally(() => { loadPromise = null; });

    return loadPromise;
  }

  async function action(actionName, fields = {}) {
    if (window.CCDemo?.enabled && window.CCDemo?.goals) {
      return { success:true, goals:window.CCDemo.goals, demo:true };
    }
    try { await window.CCAccount?.ready; } catch {}
    const pageParams = new URLSearchParams(location.search);
    const adminView = pageParams.get('admin') === '1' || sessionStorage.getItem('cc_admin_mode') === '1';
    const selector = {};
    if (adminView) {
      const tenant = pageParams.get('tenant') || pageParams.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
      if (tenant) Object.assign(selector,{admin:'1',tenant,accountId:tenant});
    }
    const payload = await request(API_BASE,{
      method:'POST',
      body:JSON.stringify({ ...selector, action:actionName, ...fields })
    });
    cached = null;
    loadPromise = null;
    clearSession();
    return payload;
  }

  const saveTarget = (metricId,targetType,targetValue,targetNotes='',targetDirection='increase') =>
    action('set_target',{metricId,targetType,targetValue,targetNotes,targetDirection});
  const saveTargets = targets => action('bulk_set_targets',{targets});
  const saveProgress = (metricId,actualValue,note='') => action('save_progress',{metricId,actualValue,note});
  const saveDepartment = department => action('save_department',department);
  const createRocks = rocks => action('create_rocks',{rocks});
  const updateRock = rock => action('update_rock',rock);
  const saveCardLayout = (metricIds,departmentNames) => action('save_card_layout',{metricIds,departmentNames});
  const complete = () => action('complete');
  const clear = () => { cached=null; loadPromise=null; clearSession(); };

  window.CCGoals = {
    load,
    loadScorecardFallback,
    saveTarget,
    saveTargets,
    saveProgress,
    saveDepartment,
    createRocks,
    updateRock,
    saveCardLayout,
    complete,
    clear
  };
})();