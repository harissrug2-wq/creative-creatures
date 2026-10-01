(() => {
  const API_BASE = '/api/scorecard';
  let cached = null;
  let cachedHistory = [];
  let loadPromise = null;
  const SESSION_TTL = 120000;

  const safeJson = (value, fallback = null) => {
    try { return JSON.parse(value); } catch { return fallback; }
  };

  const account = () => window.CCAccount?.getAccount?.()
    || safeJson(localStorage.getItem('cc_account'), null)
    || safeJson(localStorage.getItem('ccUserAccount'), null);

  function identity() {
    const current = account() || {};
    const params = new URLSearchParams(location.search);
    const tenant = params.get('tenant') || params.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
    return {
      accountId: tenant || (current.id && !String(current.id).startsWith('local-') ? current.id : ''),
      email: tenant ? '' : (current.email || localStorage.getItem('ccOwnerEmail') || ''),
      agencyUrl: tenant ? '' : (current.agency_url || current.agencyUrl || localStorage.getItem('ccAgencyWebsite') || '')
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

  function sessionKey(current=identity()){
    const key=current.accountId||current.email||current.agencyUrl||'';
    return key?`cc_scorecard_cache:${key}`:'';
  }
  function readSession(current){
    try{
      const key=sessionKey(current);if(!key)return null;
      const row=safeJson(sessionStorage.getItem(key),null);
      if(!row||Date.now()-Number(row.at||0)>SESSION_TTL)return null;
      return row;
    }catch{return null}
  }
  function writeSession(current){
    try{
      const key=sessionKey(current);if(key)sessionStorage.setItem(key,JSON.stringify({at:Date.now(),scorecard:cached,history:cachedHistory}));
    }catch{}
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

  function normalizeScorecard(value) {
    if (!value || typeof value !== 'object') return null;
    const legacyWeakness = Array.isArray(value.weakness) ? value.weakness : [];
    const weakest = Array.isArray(value.weakest) ? value.weakest : legacyWeakness;
    return { ...value, weakest };
  }

  async function load(options = {}) {
    try{await window.CCAccount?.ready}catch{}
    if (window.CCDemo?.enabled && window.CCDemo?.scorecard) {
      cached = normalizeScorecard(window.CCDemo.scorecard);
      cachedHistory = Array.isArray(window.CCDemo.scorecardHistory) ? window.CCDemo.scorecardHistory.slice() : [];
      return cached;
    }
    if (cached && options.fresh !== true) return cached;
    const current = requireIdentity();
    if(options.fresh!==true){
      const saved=readSession(current);
      if(saved){
        cached=normalizeScorecard(saved.scorecard);
        cachedHistory=Array.isArray(saved.history)?saved.history:[];
        return cached;
      }
      if(loadPromise)return loadPromise;
    }
    const params = new URLSearchParams();
    if (current.accountId) params.set('accountId', current.accountId);
    if (current.email) params.set('email', current.email);
    if (current.agencyUrl) params.set('agencyUrl', current.agencyUrl);
    loadPromise=request(`${API_BASE}?${params.toString()}`).then(payload=>{
      cached = normalizeScorecard(payload.scorecard);
      cachedHistory = Array.isArray(payload.history) ? payload.history : [];
      writeSession(current);
      return cached;
    }).finally(()=>{loadPromise=null;});
    return loadPromise;
  }

  async function generate() {
    try{await window.CCAccount?.ready}catch{}
    if (window.CCDemo?.enabled && window.CCDemo?.scorecard) {
      cached = normalizeScorecard(window.CCDemo.scorecard);
      cachedHistory = Array.isArray(window.CCDemo.scorecardHistory) ? window.CCDemo.scorecardHistory.slice() : [];
      return cached;
    }
    const current = requireIdentity();
    const payload = await request(API_BASE, {
      method: 'POST',
      body: JSON.stringify(current)
    });
    cached = normalizeScorecard(payload.scorecard);
    cachedHistory = Array.isArray(payload.history) ? payload.history : [];
    writeSession(current);
    return cached;
  }

  const getCached = () => cached;
  const getHistory = () => cachedHistory.slice();
  const clear = () => {
    const current=identity();
    cached = null; cachedHistory = []; loadPromise=null;
    try{const key=sessionKey(current);if(key)sessionStorage.removeItem(key)}catch{}
  };

  window.CCScorecard = { load, generate, getCached, getHistory, clear };
})();
