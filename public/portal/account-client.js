(() => {
  const DESTINATIONS = {
    platform: '/platform/',
    diagnostic: '/diagnostic/',
    accelerator: '/accelerator/'
  };

  const ACCOUNT_API_BASE = String(window.CC_ACCOUNT_API_BASE || '/api/accounts').replace(/\/+$/, '');
  const DIAGNOSTIC_API_BASE = String(window.CC_DIAGNOSTIC_API_BASE || '/api/diagnostic-state').replace(/\/+$/, '');
  const OWNER_LEAD_API_BASE = String(window.CC_OWNER_LEAD_API_BASE || '/api/owner-archetype-leads').replace(/\/+$/, '');

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

  function cleanDiagnosticState() {
    return {
      indexes: {},
      count: 0,
      allComplete: false,
      reportReady: false,
      generatedAt: null
    };
  }

  function accountIdentity(account) {
    if (!account) return { id: '', email: '', agencyUrl: '' };
    const id = String(account.id || '').trim();
    return {
      id: id && !id.startsWith('local-') ? id : '',
      email: String(account.email || '').trim().toLowerCase(),
      agencyUrl: normalizeUrl(account.agency_url || account.agencyUrl || account.agencyWebsite || '')
    };
  }

  function sameAccount(left, right) {
    if (!left || !right) return false;
    const a = accountIdentity(left);
    const b = accountIdentity(right);
    if (a.id && b.id) return a.id === b.id;
    if (a.email && b.email && a.email === b.email) return true;
    if (a.agencyUrl && b.agencyUrl && a.agencyUrl === b.agencyUrl) return true;
    return false;
  }

  function clearIdentityStorage() {
    [
      'ownerArchetypeReportData',
      'ownerArchetypeReportToken',
      'ownerArchetypeRemoteReportToken',
      'ownerArchetypeRemoteAssessment',
      'ownerIdentityComplete',
      'ccOwnerFirstName',
      'ccOwnerLastName',
      'ccOwnerEmail',
      'ccAgencyWebsite',
      'ccAgencyName',
      'ccPendingDiagnosticState',
      'ccProgramPath',
      'ccAccountCreated'
    ].forEach(key => localStorage.removeItem(key));
  }

  function resetAccountScopedState() {
    window.CCDiagnostic?.reset?.({ silent: true });
    clearIdentityStorage();
  }

  function getAccount() {
    return safeJson(localStorage.getItem('cc_account'), null)
      || safeJson(localStorage.getItem('ccUserAccount'), null);
  }

  function hydrateAccount(account, options = {}) {
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

    const hasDiagnosticState = Object.prototype.hasOwnProperty.call(account, 'diagnostic_state')
      || Object.prototype.hasOwnProperty.call(account, 'diagnosticState');
    const diagnosticState = account.diagnostic_state ?? account.diagnosticState ?? {};
    if (hasDiagnosticState) {
      if (window.CCDiagnostic?.restore) {
        window.CCDiagnostic.restore(diagnosticState, { replace: options.replaceDiagnostic === true });
      } else {
        localStorage.setItem('ccPendingDiagnosticState', JSON.stringify({
          state: diagnosticState,
          replace: options.replaceDiagnostic === true
        }));
      }
    }

    return account;
  }

  function saveAccount(account, options = {}) {
    const previous = getAccount();
    const switching = Boolean(previous && !sameAccount(previous, account));
    if (options.forceReset === true || switching) resetAccountScopedState();

    localStorage.setItem('cc_account', JSON.stringify(account));
    localStorage.setItem('ccUserAccount', JSON.stringify(account));
    hydrateAccount(account, {
      replaceDiagnostic: options.replaceDiagnostic === true || options.forceReset === true || switching
    });
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


  async function createOwnerArchetypeLead(payload) {
    const previous = getAccount();
    const candidate = provisionalAccount(payload);
    const isNewIdentity = !previous || !sameAccount(previous, candidate);
    if (isNewIdentity) resetAccountScopedState();
    const localAccount = saveAccount({ ...candidate, id: candidate.id || `local-${Date.now()}`, backend_saved: false, lead_only: true, diagnostic_state: cleanDiagnosticState() }, { replaceDiagnostic: isNewIdentity });
    const result = await request(OWNER_LEAD_API_BASE, { method: 'POST', body: JSON.stringify(payload) });
    if (result?.alreadyActivated && result.account) return saveAccount({ ...result.account, backend_saved: true, lead_only: false }, { replaceDiagnostic: false });
    if (result?.lead) return saveAccount({ ...localAccount, lead_id: result.lead.id, backend_saved: true, lead_only: true, report_data: result.lead.report_data || localAccount.report_data, archetype_result: result.lead.archetype_result || localAccount.archetype_result });
    return localAccount;
  }

  async function createAccount(payload) {
    const previous = getAccount();
    const candidate = provisionalAccount(payload);
    const isNewIdentity = !previous || !sameAccount(previous, candidate);
    const initialDiagnosticState = isNewIdentity ? cleanDiagnosticState() : (payload.diagnosticState || candidate.diagnostic_state || {});
    const localAccount = { ...candidate, diagnostic_state: initialDiagnosticState };

    // A brand-new signup must start from a clean diagnostic workspace even
    // when another owner previously used this browser/profile.
    if (isNewIdentity) resetAccountScopedState();
    saveAccount(localAccount, { replaceDiagnostic: isNewIdentity });

    try {
      const result = await request(ACCOUNT_API_BASE, {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          // A new account never inherits browser diagnostic state. The API
          // also enforces this server-side; this is a client-side safeguard.
          diagnosticState: initialDiagnosticState,
          agencyUrl: payload.agencyUrl,
          agencyUrlNormalized: normalizeUrl(payload.agencyUrl)
        })
      });
      if (result.account) {
        return saveAccount(
          { ...result.account, backend_saved: true },
          { replaceDiagnostic: isNewIdentity }
        );
      }
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
      if (result.account) {
        // Backend state is authoritative for a returning account. Clear any
        // other owner's local workflow before restoring this account.
        return saveAccount(
          { ...result.account, backend_saved: true },
          { forceReset: true, replaceDiagnostic: true }
        );
      }
    } catch (error) {
      const local = getAccount();
      if (matchesLocal(local, { name, email: cleanEmail, agencyUrl: cleanUrl })) return saveAccount(local);
      throw error;
    }

    throw new Error('No matching account was found.');
  }


  async function lookupOwnerArchetypeLead({ name, email, agencyUrl }) {
    const params = new URLSearchParams();
    if (name) params.set('name', String(name).trim());
    if (email) params.set('email', String(email).trim());
    if (agencyUrl) params.set('agencyUrl', String(agencyUrl).trim());
    if (!params.toString()) throw new Error('Enter a name, email address, or agency URL.');
    const result = await request(`${OWNER_LEAD_API_BASE}?${params.toString()}`);
    return Array.isArray(result.leads) ? result.leads : [];
  }

  function useOwnerArchetypeLead(lead) {
    if (!lead) return null;
    resetAccountScopedState();
    return saveAccount({
      id: `lead-${lead.id}`,
      lead_id: lead.id,
      lead_only: true,
      backend_saved: true,
      name: lead.name,
      email: lead.email,
      agency_url: lead.agency_url,
      agency_name: lead.agency_name,
      journey: 'diagnostic',
      source: 'owner-archetype',
      archetype_result: lead.archetype_result || {},
      report_data: lead.report_data || {},
      diagnostic_state: cleanDiagnosticState()
    }, { forceReset: true, replaceDiagnostic: true });
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

  async function syncDiagnosticState(state, options = {}) {
    const account = getAccount();
    if (!account) return null;

    const payload = currentDiagnosticPayload(state);

    try {
      // Dedicated diagnostic sync writes the normalized diagnostic tables
      // (diagnostic_runs + index_results) and also maintains accounts.diagnostic_state
      // for backwards compatibility while the frontend is migrated gradually.
      await request(DIAGNOSTIC_API_BASE, {
        method: 'POST',
        body: JSON.stringify({
          accountId: account.id && !String(account.id).startsWith('local-') ? account.id : undefined,
          email: payload.email,
          agencyUrl: payload.agencyUrl,
          diagnosticState: payload.diagnosticState,
          reportData: payload.reportData
        })
      });

      // Keep the local account snapshot current without requiring another
      // database round-trip. Returning-user hydration still works from
      // accounts.diagnostic_state because the API updates it above.
      const updated = {
        ...account,
        diagnostic_state: payload.diagnosticState,
        report_data: payload.reportData || account.report_data || {},
        backend_saved: true,
        updated_at: new Date().toISOString()
      };
      return saveAccount(updated);
    } catch (error) {
      // Background progress saves stay non-blocking. Completion/retake flows
      // can opt into strict mode so reports never regenerate from stale data.
      if (options.throwOnError === true) throw error;
      console.warn('Diagnostic progress could not be synced yet.', error);
      return account;
    }
  }

  const pending = safeJson(localStorage.getItem('ccPendingDiagnosticState'), null);
  if (pending && window.CCDiagnostic?.restore) {
    const pendingState = pending?.state ?? pending;
    const replace = pending?.state ? pending.replace === true : true;
    window.CCDiagnostic.restore(pendingState, { replace });
    localStorage.removeItem('ccPendingDiagnosticState');
  }
  const existingAccount = getAccount();
  // Normal page navigation keeps the current account's newer local progress.
  // Exact backend replacement happens only during account lookup/switch.
  if (existingAccount) hydrateAccount(existingAccount, { replaceDiagnostic: false });

  window.CCAccount = {
    normalizeUrl,
    getAccount,
    saveAccount,
    hydrateAccount,
    createAccount,
    createOwnerArchetypeLead,
    lookupAccount,
    lookupOwnerArchetypeLead,
    useOwnerArchetypeLead,
    syncDiagnosticState,
    resetAccountScopedState,
    sameAccount,
    destinationPath,
    accountApiBase: ACCOUNT_API_BASE,
    diagnosticApiBase: DIAGNOSTIC_API_BASE,
    ownerLeadApiBase: OWNER_LEAD_API_BASE
  };
})();
