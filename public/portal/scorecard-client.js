(() => {
  const API_BASE = '/api/scorecard';
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

  async function request(url, options = {}) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Scorecard request failed.');
      error.status = response.status;
      error.code = payload.code;
      throw error;
    }
    return payload;
  }

  function requireIdentity() {
    const current = identity();
    if (!current.accountId && !current.email && !current.agencyUrl) {
      const error = new Error('Sign in to load your Agency Scorecard.');
      error.code = 'ACCOUNT_REQUIRED';
      throw error;
    }
    return current;
  }

  async function load(options = {}) {
    if (cached && options.fresh !== true) return cached;
    const current = requireIdentity();
    const params = new URLSearchParams();
    if (current.accountId) params.set('accountId', current.accountId);
    if (current.email) params.set('email', current.email);
    if (current.agencyUrl) params.set('agencyUrl', current.agencyUrl);
    const payload = await request(`${API_BASE}?${params.toString()}`);
    cached = payload.scorecard || null;
    return cached;
  }

  async function generate() {
    const current = requireIdentity();
    const payload = await request(API_BASE, {
      method: 'POST',
      body: JSON.stringify(current)
    });
    cached = payload.scorecard || null;
    return cached;
  }

  const getCached = () => cached;
  const clear = () => { cached = null; };

  window.CCScorecard = { load, generate, getCached, clear };
})();
