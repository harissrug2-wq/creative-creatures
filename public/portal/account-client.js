(() => {
  const DESTINATIONS = {
    platform: '/platform/',
    diagnostic: '/diagnostic/',
    accelerator: '/accelerator/'
  };

  const ACCOUNT_API_BASE = String(window.CC_ACCOUNT_API_BASE || '/api/accounts').replace(/\/+$/, '');

  function safeJson(value, fallback = null) {
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function normalizeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const url = new URL(withProtocol);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      const path = url.pathname.replace(/\/+$/, '');
      return `${host}${path === '/' ? '' : path}`.toLowerCase();
    } catch {
      return raw.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
    }
  }

  function destinationPath(value) {
    return DESTINATIONS[value] || DESTINATIONS.diagnostic;
  }

  function getAccount() {
    return safeJson(localStorage.getItem('cc_account'), null)
      || safeJson(localStorage.getItem('ccUserAccount'), null);
  }

  function hydrateAccount(account) {
    if (!account) return null;
    const name = String(account.name || account.displayName || '').trim();
    const names = name.split(/\s+/).filter(Boolean);
    const firstName = account.first_name || account.firstName || names[0] || '';
    const lastName = account.last_name || account.lastName || names.slice(1).join(' ');
    const agencyUrl = account.agency_url || account.agencyUrl || account.agencyWebsite || '';
    const agencyName = account.agency_name || account.agencyName || '';
    const reportData = account.report_data || account.reportData || null;

    localStorage.setItem('ccSignedIn', 'true');
    if (firstName) localStorage.setItem('ccOwnerFirstName', firstName);
    if (lastName) localStorage.setItem('ccOwnerLastName', lastName);
    if (account.email) localStorage.setItem('ccOwnerEmail', String(account.email));
    if (agencyUrl) localStorage.setItem('ccAgencyWebsite', agencyUrl);
    if (agencyName) localStorage.setItem('ccAgencyName', agencyName);
    if (account.journey) localStorage.setItem('ccProgramPath', account.journey);

    if (reportData && Object.keys(reportData).length) {
      localStorage.setItem('ownerArchetypeReportData', JSON.stringify(reportData));
      localStorage.setItem('ownerIdentityComplete', 'true');
      if (reportData.token) localStorage.setItem('ownerArchetypeReportToken', reportData.token);
    } else if (account.archetype_result && Object.keys(account.archetype_result).length) {
      localStorage.setItem('ownerIdentityComplete', 'true');
    }

    const diagnosticState = account.diagnostic_state || account.diagnosticState;
    if (diagnosticState) {
      if (window.CCDiagnostic?.restore) window.CCDiagnostic.restore(diagnosticState);
      else localStorage.setItem('ccPendingDiagnosticState', JSON.stringify(diagnosticState));
    }

    return account;
  }

  function saveAccount(account) {
    localStorage.setItem('cc_account', JSON.stringify(account));
    localStorage.setItem('ccUserAccount', JSON.stringify(account));
    hydrateAccount(account);
    window.dispatchEvent(new CustomEvent('cc-account-updated', { detail: account }));
    return account;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || payload.message || 'Request failed.');
      error.status = response.status;
      error.code = payload.code;
      throw error;
    }
    return payload;
  }

  function provisionalAccount(payload) {
    const displayName = String(payload.name || `${payload.firstName || ''} ${payload.lastName || ''}`).trim();
    return {
      id: payload.id || `local-${Date.now().toString(36)}`,
      name: displayName,
      first_name: String(payload.firstName || '').trim(),
      last_name: String(payload.lastName || '').trim(),
      email: String(payload.email || '').trim() || null,
      agency_url: String(payload.agencyUrl || '').trim(),
      agency_url_normalized: normalizeUrl(payload.agencyUrl),
      agency_name: String(payload.agencyName || '').trim(),
      journey: payload.journey || 'diagnostic',
      archetype_result: payload.archetypeResult || {},
      report_data: payload.reportData || {},
      diagnostic_state: payload.diagnosticState || {},
      backend_saved: false,
      updated_at: new Date().toISOString()
    };
  }

  async function createAccount(payload) {
    const localAccount = provisionalAccount(payload);
    saveAccount(localAccount);

    try {
      const result = await request(ACCOUNT_API_BASE, {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          agencyUrl: payload.agencyUrl,
          agencyUrlNormalized: normalizeUrl(payload.agencyUrl)
        })
      });
      if (result.account) return saveAccount({ ...result.account, backend_saved: true });
    } catch (error) {
      console.warn('Creative Creatures account sync is unavailable; the local report remains usable.', error);
    }

    return localAccount;
  }

  function matchesLocal(account, { name, email, agencyUrl }) {
    if (!account) return false;
    const requestedEmail = String(email || '').trim().toLowerCase();
    const requestedUrl = normalizeUrl(agencyUrl);
    const localEmail = String(account.email || '').trim().toLowerCase();
    const localUrl = normalizeUrl(account.agency_url || account.agencyUrl || account.agencyWebsite);
    const identifierMatches = (requestedEmail && localEmail === requestedEmail) || (requestedUrl && localUrl === requestedUrl);
    if (!identifierMatches) return false;
    return true;
  }

  async function lookupAccount({ name, email, agencyUrl }) {
    const cleanEmail = String(email || '').trim();
    const cleanUrl = String(agencyUrl || '').trim();
    if (!cleanEmail && !cleanUrl) throw new Error('Enter an email address or agency URL.');

    const params = new URLSearchParams();
    if (name) params.set('name', String(name).trim());
    if (cleanEmail) params.set('email', cleanEmail);
    if (cleanUrl) params.set('agencyUrl', cleanUrl);

    try {
      const result = await request(`${ACCOUNT_API_BASE}?${params.toString()}`);
      if (result.account) return saveAccount({ ...result.account, backend_saved: true });
    } catch (error) {
      const local = getAccount();
      if (matchesLocal(local, { name, email: cleanEmail, agencyUrl: cleanUrl })) return saveAccount(local);
      throw error;
    }

    throw new Error('No matching account was found.');
  }

  function currentDiagnosticPayload(state) {
    const diagnostic = state || window.CCDiagnostic?.serialize?.() || {};
    return {
      diagnosticState: diagnostic,
      reportData: safeJson(localStorage.getItem('ownerArchetypeReportData'), {}),
      email: localStorage.getItem('ccOwnerEmail') || getAccount()?.email || '',
      agencyUrl: localStorage.getItem('ccAgencyWebsite') || getAccount()?.agency_url || ''
    };
  }

  async function syncDiagnosticState(state) {
    const account = getAccount();
    if (!account) return null;
    const payload = currentDiagnosticPayload(state);
    try {
      const result = await request(ACCOUNT_API_BASE, {
        method: 'PATCH',
        body: JSON.stringify({
          id: account.id && !String(account.id).startsWith('local-') ? account.id : undefined,
          email: payload.email,
          agencyUrl: payload.agencyUrl,
          diagnosticState: payload.diagnosticState,
          reportData: payload.reportData
        })
      });
      if (result.account) return saveAccount({ ...result.account, backend_saved: true });
    } catch (error) {
      console.warn('Diagnostic progress could not be synced yet.', error);
    }
    return account;
  }

  const pending = safeJson(localStorage.getItem('ccPendingDiagnosticState'), null);
  if (pending && window.CCDiagnostic?.restore) {
    window.CCDiagnostic.restore(pending);
    localStorage.removeItem('ccPendingDiagnosticState');
  }
  const existingAccount = getAccount();
  if (existingAccount) hydrateAccount(existingAccount);

  window.CCAccount = {
    normalizeUrl,
    getAccount,
    saveAccount,
    hydrateAccount,
    createAccount,
    lookupAccount,
    syncDiagnosticState,
    destinationPath,
    accountApiBase: ACCOUNT_API_BASE
  };
})();
