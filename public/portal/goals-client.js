(() => {
  const API_BASE = '/api/goals';
  let cached = null;

  const safeJson = (value, fallback = null) => {
    try { return JSON.parse(value); } catch { return fallback; }
  };

  const account = () => window.CCAccount?.getAccount?.()
    || safeJson(localStorage.getItem('cc_account'), null)
    || safeJson(localStorage.getItem('ccUserAccount'), null);

  function identity() {
    const current = account() || {};
    return {
      accountId: current.id && !String(current.id).startsWith('local-') ? current.id : '',
      email: current.email || localStorage.getItem('ccOwnerEmail') || '',
      agencyUrl: current.agency_url || current.agencyUrl || localStorage.getItem('ccAgencyWebsite') || ''
    };
  }

  function requireIdentity() {
    const current = identity();
    if (!current.accountId && !current.email && !current.agencyUrl) {
      const error = new Error('Sign in to load Agency Goals.');
      error.code = 'ACCOUNT_REQUIRED';
      throw error;
    }
    return current;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Agency Goals request failed.');
      error.status = response.status;
      error.code = payload.code;
      throw error;
    }
    return payload;
  }

  async function load(options = {}) {
    if (cached && options.fresh !== true) return cached;
    const current = requireIdentity();
    const params = new URLSearchParams();
    if (current.accountId) params.set('accountId', current.accountId);
    if (current.email) params.set('email', current.email);
    if (current.agencyUrl) params.set('agencyUrl', current.agencyUrl);
    const payload = await request(`${API_BASE}?${params.toString()}`);
    cached = payload.goals || null;
    return cached;
  }

  async function action(actionName, fields = {}) {
    const current = requireIdentity();
    const payload = await request(API_BASE, {
      method: 'POST',
      body: JSON.stringify({ ...current, action: actionName, ...fields })
    });
    cached = null;
    return payload;
  }

  const saveTarget = (metricId, targetType, targetValue, targetNotes = '', targetDirection = 'increase') =>
    action('set_target', { metricId, targetType, targetValue, targetNotes, targetDirection });

  const saveProgress = (metricId, actualValue, note = '') => action('save_progress', { metricId, actualValue, note });
  const saveDepartment = department => action('save_department', department);
  const createRocks = rocks => action('create_rocks', { rocks });
  const updateRock = rock => action('update_rock', rock);
  const complete = () => action('complete');
  const clear = () => { cached = null; };

  window.CCGoals = { load, saveTarget, saveProgress, saveDepartment, createRocks, updateRock, complete, clear };
})();
