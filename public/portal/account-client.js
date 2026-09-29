(() => {
  const DESTINATIONS = {
    platform: '/platform/',
    diagnostic: '/diagnostic/',
    accelerator: '/accelerator/',
    fractional_coo: '/fractional-coo/',
    owner_archetype: '/owner-archetype/'
  };

  const ACCOUNT_API_BASE = String(window.CC_ACCOUNT_API_BASE || '/api/accounts').replace(/\/+$/, '');
  const DIAGNOSTIC_API_BASE = String(window.CC_DIAGNOSTIC_API_BASE || '/api/diagnostic-state').replace(/\/+$/, '');
  const OWNER_LEAD_API_BASE = String(window.CC_OWNER_LEAD_API_BASE || '/api/owner-archetype-leads').replace(/\/+$/, '');

  const DEMO_ACCOUNT_EMAIL = 'immad@brandandbrains.co';
  const isDemoAccount = account => String(account?.email || '').trim().toLowerCase() === DEMO_ACCOUNT_EMAIL;
  const demoDiagnosticState = () => ({
    purchasedPlans:['platform'],
    paymentComplete:true,
    integrationsComplete:true,
    goalsComplete:true,
    count:3,
    allComplete:true,
    reportReady:true,
    generatedAt:'2026-09-28T12:00:00.000Z',
    indexes:{
      strength:{complete:true,progress:100,score:82,details:{results:{overallScore:82,confidenceScore:91,validationStatus:'Verified',categoryScores:{leadership:84,operating:76,financial:81,revenue:85,people:84}}}},
      independence:{complete:true,progress:100,score:74,details:{scores:{overallIndexScore:74,confidenceScore:88,validationStatus:'Verified',categoryDetails:{decision:{score:78},revenue:{score:69},delivery:{score:71},leadership:{score:76},strategic:{score:76}},ownerTime:{deliveryPercent:18,salesPercent:22}}}},
      performance:{complete:true,progress:100,score:86,details:{overallScore:86,confidenceScore:94,validationStatus:'Verified',categoryScores:{profitability:88,growth:82,revenueQuality:85,cash:84,capital:91},adjustedSDE:510000,roicLite:34.8,evidenceLevel:'Verified financial evidence',evidence:{files:[{label:'Profit & Loss'},{label:'Balance Sheet'},{label:'A/R Aging'},{label:'Client Revenue'}]}}}
    }
  });
  const demoGoals = () => ({
    account:{name:'Immad Uddin',agencyName:'Brand & Brains'},
    goalsComplete:true,goalsCompletedAt:'2026-09-25T12:00:00.000Z',
    hasMonitorAccess:true,canManageTeam:true,memberCount:3,
    metrics:[
      {id:'ownerDelivery',group:'Owner Dependency',label:'Owner Time in Delivery (%)',unit:'%',available:true,actualValue:18,actualDisplay:'18%',source:'Owner Independence evidence'},
      {id:'ownerSales',group:'Owner Dependency',label:'Owner Time in Sales (%)',unit:'%',available:true,actualValue:22,actualDisplay:'22%',source:'Owner Independence evidence'},
      {id:'revenue',group:'Financial',label:'Revenue (TTM)',unit:'

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
    account = applyDemoAccount(account);
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
    if (account.accessPlan || account.access_plan || account.journey) localStorage.setItem('ccProgramPath', account.accessPlan || account.access_plan || account.journey);

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
    account = applyDemoAccount(account);
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

  async function updateOwnerIdentity(payload = {}) {
    const account = getAccount();
    const id = String(account?.id || '').trim();
    if (!id || id.startsWith('local-') || id.startsWith('lead-')) {
      throw new Error('Sign in to your Creative Creatures account before saving Owner Identity.');
    }

    const result = await request(ACCOUNT_API_BASE, {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        reportData: payload.reportData || payload.report_data || {},
        archetypeResult: payload.archetypeResult || payload.archetype_result || {},
        archetypeAnswers: payload.archetypeAnswers || payload.archetype_answers || {}
      })
    });
    if (!result?.account) throw new Error('Owner Identity could not be saved to your account.');

    return saveAccount(
      { ...result.account, backend_saved: true, lead_only: false },
      { replaceDiagnostic: false }
    );
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

  async function hydrateAdminTenant() {
    const params = new URLSearchParams(location.search);
    const tenant = params.get('tenant') || params.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
    const adminMode = params.get('admin') === '1' || sessionStorage.getItem('cc_admin_mode') === '1';
    if (!adminMode || !tenant) return null;
    sessionStorage.setItem('cc_admin_mode','1');
    sessionStorage.setItem('cc_admin_tenant',tenant);
    const result = await request(`${ACCOUNT_API_BASE}?id=${encodeURIComponent(tenant)}&admin=1`);
    if (!result?.account) throw new Error('The selected agency could not be loaded.');
    return saveAccount({ ...result.account, backend_saved: true, admin_view: true }, { forceReset: true, replaceDiagnostic: true });
  }

  const ready = hydrateAdminTenant().catch(error => {
    console.error('Admin tenant hydration failed.', error);
    throw error;
  });

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
    updateOwnerIdentity,
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
    ownerLeadApiBase: OWNER_LEAD_API_BASE,
    ready
  };
})();
,available:true,actualValue:2400000,actualDisplay:'$2,400,000',source:'Financial evidence'},
      {id:'cogs',group:'Financial',label:'COGS % of Revenue',unit:'%',available:true,actualValue:41,actualDisplay:'41%',source:'Financial evidence'},
      {id:'margin',group:'Financial',label:'Net (Profit) Margin',unit:'%',available:true,actualValue:21,actualDisplay:'21%',source:'Financial evidence'},
      {id:'sde',group:'Financial',label:'SDE',unit:'

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
    if (account.accessPlan || account.access_plan || account.journey) localStorage.setItem('ccProgramPath', account.accessPlan || account.access_plan || account.journey);

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

  async function updateOwnerIdentity(payload = {}) {
    const account = getAccount();
    const id = String(account?.id || '').trim();
    if (!id || id.startsWith('local-') || id.startsWith('lead-')) {
      throw new Error('Sign in to your Creative Creatures account before saving Owner Identity.');
    }

    const result = await request(ACCOUNT_API_BASE, {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        reportData: payload.reportData || payload.report_data || {},
        archetypeResult: payload.archetypeResult || payload.archetype_result || {},
        archetypeAnswers: payload.archetypeAnswers || payload.archetype_answers || {}
      })
    });
    if (!result?.account) throw new Error('Owner Identity could not be saved to your account.');

    return saveAccount(
      { ...result.account, backend_saved: true, lead_only: false },
      { replaceDiagnostic: false }
    );
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

  async function hydrateAdminTenant() {
    const params = new URLSearchParams(location.search);
    const tenant = params.get('tenant') || params.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
    const adminMode = params.get('admin') === '1' || sessionStorage.getItem('cc_admin_mode') === '1';
    if (!adminMode || !tenant) return null;
    sessionStorage.setItem('cc_admin_mode','1');
    sessionStorage.setItem('cc_admin_tenant',tenant);
    const result = await request(`${ACCOUNT_API_BASE}?id=${encodeURIComponent(tenant)}&admin=1`);
    if (!result?.account) throw new Error('The selected agency could not be loaded.');
    return saveAccount({ ...result.account, backend_saved: true, admin_view: true }, { forceReset: true, replaceDiagnostic: true });
  }

  const ready = hydrateAdminTenant().catch(error => {
    console.error('Admin tenant hydration failed.', error);
    throw error;
  });

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
    updateOwnerIdentity,
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
    ownerLeadApiBase: OWNER_LEAD_API_BASE,
    ready
  };
})();
,available:true,actualValue:510000,actualDisplay:'$510,000',source:'Agency Performance'},
      {id:'leadership',group:'Operational',label:'Leadership Maturity Level',unit:'level',available:true,actualValue:4,actualDisplay:'4 / 5',source:'Agency Strength'},
      {id:'aofi',group:'Operational',label:'Agency Owner Freedom Index (AOFI) Score',unit:'score',available:true,actualValue:82,actualDisplay:'82',source:'Generated Agency Scorecard'},
      {id:'valuation',group:'Agency Value',label:'Enterprise Valuation',unit:'

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
    if (account.accessPlan || account.access_plan || account.journey) localStorage.setItem('ccProgramPath', account.accessPlan || account.access_plan || account.journey);

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

  async function updateOwnerIdentity(payload = {}) {
    const account = getAccount();
    const id = String(account?.id || '').trim();
    if (!id || id.startsWith('local-') || id.startsWith('lead-')) {
      throw new Error('Sign in to your Creative Creatures account before saving Owner Identity.');
    }

    const result = await request(ACCOUNT_API_BASE, {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        reportData: payload.reportData || payload.report_data || {},
        archetypeResult: payload.archetypeResult || payload.archetype_result || {},
        archetypeAnswers: payload.archetypeAnswers || payload.archetype_answers || {}
      })
    });
    if (!result?.account) throw new Error('Owner Identity could not be saved to your account.');

    return saveAccount(
      { ...result.account, backend_saved: true, lead_only: false },
      { replaceDiagnostic: false }
    );
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

  async function hydrateAdminTenant() {
    const params = new URLSearchParams(location.search);
    const tenant = params.get('tenant') || params.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
    const adminMode = params.get('admin') === '1' || sessionStorage.getItem('cc_admin_mode') === '1';
    if (!adminMode || !tenant) return null;
    sessionStorage.setItem('cc_admin_mode','1');
    sessionStorage.setItem('cc_admin_tenant',tenant);
    const result = await request(`${ACCOUNT_API_BASE}?id=${encodeURIComponent(tenant)}&admin=1`);
    if (!result?.account) throw new Error('The selected agency could not be loaded.');
    return saveAccount({ ...result.account, backend_saved: true, admin_view: true }, { forceReset: true, replaceDiagnostic: true });
  }

  const ready = hydrateAdminTenant().catch(error => {
    console.error('Admin tenant hydration failed.', error);
    throw error;
  });

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
    updateOwnerIdentity,
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
    ownerLeadApiBase: OWNER_LEAD_API_BASE,
    ready
  };
})();
,available:true,actualValue:2550000,actualDisplay:'$2,550,000',source:'Agency Valuation'}
    ],
    targets:{
      revenue:{type:'number',value:3000000,resolvedValue:3000000,baselineValue:2400000},
      cogs:{type:'number',value:35,resolvedValue:35,baselineValue:41},
      margin:{type:'number',value:25,resolvedValue:25,baselineValue:21},
      aofi:{type:'number',value:90,resolvedValue:90,baselineValue:82},
      valuation:{type:'number',value:3200000,resolvedValue:3200000,baselineValue:2550000},
      ownerDelivery:{type:'number',value:10,resolvedValue:10,baselineValue:18},
      ownerSales:{type:'number',value:12,resolvedValue:12,baselineValue:22},
      leadership:{type:'number',value:5,resolvedValue:5,baselineValue:4}
    },
    progress:{
      revenue:{percent:46,achieved:false},cogs:{percent:32,achieved:false},margin:{percent:50,achieved:false},
      aofi:{percent:55,achieved:false},valuation:{percent:42,achieved:false},ownerDelivery:{percent:38,achieved:false},
      ownerSales:{percent:44,achieved:false},leadership:{percent:70,achieved:false}
    },
    progressHistory:{
      revenue:[{actualValue:2150000,capturedAt:'2026-03-31T12:00:00Z'},{actualValue:2280000,capturedAt:'2026-06-30T12:00:00Z'},{actualValue:2400000,capturedAt:'2026-09-25T12:00:00Z'}],
      margin:[{actualValue:18,capturedAt:'2026-03-31T12:00:00Z'},{actualValue:19.5,capturedAt:'2026-06-30T12:00:00Z'},{actualValue:21,capturedAt:'2026-09-25T12:00:00Z'}]
    },
    departments:[
      {name:'Leadership',goal:'Move weekly operating review to leadership team',owner:'Immad Uddin',status:'On Track',done:'Leadership team runs weekly review without founder',completionDate:'2026-12-15'},
      {name:'Marketing',goal:'Generate 45 qualified opportunities per month',owner:'Sarah Khan',status:'On Track',done:'45 qualified opportunities for 3 consecutive months',completionDate:'2026-12-31'},
      {name:'Sales',goal:'Increase close rate to 32%',owner:'Ali Raza',status:'Watch',done:'32% rolling 90-day close rate',completionDate:'2026-12-31'},
      {name:'Onboarding',goal:'Reduce onboarding cycle to 7 days',owner:'Operations Lead',status:'On Track',done:'90% of clients live within 7 days',completionDate:'2026-11-30'},
      {name:'Billing',goal:'Keep receivables over 60 days below 5%',owner:'Finance Lead',status:'On Track',done:'Over-60-day AR below 5% for 2 months',completionDate:'2026-12-31'},
      {name:'Service Delivery',goal:'Raise delivery gross margin to 59%',owner:'Delivery Lead',status:'Watch',done:'59% gross margin for 2 consecutive months',completionDate:'2026-12-31'},
      {name:'Client Success',goal:'Maintain NPS above 60',owner:'Client Success Lead',status:'On Track',done:'NPS >= 60 with quarterly survey',completionDate:'2026-12-31'}
    ],
    rocks:[
      {id:'demo-rock-1',title:'Delegate pricing approvals',description:'Move standard discount and pricing decisions to sales leadership.',owner:'Ali Raza',dueDate:'2026-11-15',status:'On track',sourceType:'scorecard'},
      {id:'demo-rock-2',title:'Install weekly KPI operating cadence',description:'Leadership owns a weekly scorecard review with actions and owners.',owner:'Immad Uddin',dueDate:'2026-10-31',status:'On track',sourceType:'scorecard'},
      {id:'demo-rock-3',title:'Improve project margin visibility',description:'Track estimated vs actual hours and gross margin by service line.',owner:'Delivery Lead',dueDate:'2026-12-01',status:'Watch',sourceType:'manual'}
    ],
    members:[
      {name:'Sarah Khan',email:'sarah@brandandbrains.co',departments:['marketing']},
      {name:'Ali Raza',email:'ali@brandandbrains.co',departments:['sales']},
      {name:'Ayesha Malik',email:'ayesha@brandandbrains.co',departments:['client-success']}
    ],
    readiness:{targetCount:8,targetTotal:9,definedDepartmentCount:7,departmentTotal:7,rockCount:3,evidenceGaps:[]}
  });
  const demoEvidence = () => ({evidence:[
    {evidence_type:'profit_loss',extraction_status:'processed',validation_status:'verified',updated_at:'2026-09-25T12:00:00Z',extracted_data:{revenueTTM:2400000,cogsPercent:41,netMargin:21,netIncomeTTM:504000}},
    {evidence_type:'balance_sheet',extraction_status:'processed',validation_status:'verified',updated_at:'2026-09-25T12:00:00Z',extracted_data:{cash:420000,currentAssets:690000,currentLiabilities:230000,currentRatio:3}},
    {evidence_type:'client_revenue',extraction_status:'processed',validation_status:'verified',updated_at:'2026-09-25T12:00:00Z',extracted_data:{totalRevenue:2400000,clients:[{name:'Northstar',revenue:420000},{name:'BluePeak',revenue:310000},{name:'Vertex',revenue:285000},{name:'Nexa',revenue:240000},{name:'Orbit',revenue:220000},{name:'Other clients',revenue:925000}]}},
    {evidence_type:'service_revenue_mix',extraction_status:'processed',validation_status:'verified',updated_at:'2026-09-25T12:00:00Z',extracted_data:{totalRevenue:2400000,recurringRevenue:1680000,projectRevenue:720000,recurringRevenuePercent:70,projectRevenuePercent:30}}
  ]});
  function applyDemoAccount(account){
    if(!isDemoAccount(account))return account;
    const diagnostic=demoDiagnosticState();
    const reportData={
      ...(account.report_data||account.reportData||{}),
      token:'demo-owner-report',
      title:'Strategic Builder',
      archetypeTitle:'Strategic Builder',
      summary:'A growth-oriented agency owner building systems, leadership capacity, and founder independence.'
    };
    const resolved={...account,journey:'platform',access_plan:'platform',accessPlan:'platform',agency_name:account.agency_name||account.agencyName||'Brand & Brains',agencyName:account.agency_name||account.agencyName||'Brand & Brains',archetype_result:{...(account.archetype_result||{}),title:'Strategic Builder'},report_data:reportData,reportData,diagnostic_state:diagnostic,diagnosticState:diagnostic};
    window.CCDemo={enabled:true,email:DEMO_ACCOUNT_EMAIL,goals:demoGoals(),evidence:demoEvidence()};
    return resolved;
  }

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
    if (account.accessPlan || account.access_plan || account.journey) localStorage.setItem('ccProgramPath', account.accessPlan || account.access_plan || account.journey);

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

  async function updateOwnerIdentity(payload = {}) {
    const account = getAccount();
    const id = String(account?.id || '').trim();
    if (!id || id.startsWith('local-') || id.startsWith('lead-')) {
      throw new Error('Sign in to your Creative Creatures account before saving Owner Identity.');
    }

    const result = await request(ACCOUNT_API_BASE, {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        reportData: payload.reportData || payload.report_data || {},
        archetypeResult: payload.archetypeResult || payload.archetype_result || {},
        archetypeAnswers: payload.archetypeAnswers || payload.archetype_answers || {}
      })
    });
    if (!result?.account) throw new Error('Owner Identity could not be saved to your account.');

    return saveAccount(
      { ...result.account, backend_saved: true, lead_only: false },
      { replaceDiagnostic: false }
    );
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

  async function hydrateAdminTenant() {
    const params = new URLSearchParams(location.search);
    const tenant = params.get('tenant') || params.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
    const adminMode = params.get('admin') === '1' || sessionStorage.getItem('cc_admin_mode') === '1';
    if (!adminMode || !tenant) return null;
    sessionStorage.setItem('cc_admin_mode','1');
    sessionStorage.setItem('cc_admin_tenant',tenant);
    const result = await request(`${ACCOUNT_API_BASE}?id=${encodeURIComponent(tenant)}&admin=1`);
    if (!result?.account) throw new Error('The selected agency could not be loaded.');
    return saveAccount({ ...result.account, backend_saved: true, admin_view: true }, { forceReset: true, replaceDiagnostic: true });
  }

  const ready = hydrateAdminTenant().catch(error => {
    console.error('Admin tenant hydration failed.', error);
    throw error;
  });

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
    updateOwnerIdentity,
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
    ownerLeadApiBase: OWNER_LEAD_API_BASE,
    ready
  };
})();
