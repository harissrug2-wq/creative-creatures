(() => {
  const API_BASE = String(window.CC_ARCHETYPE_API_BASE || 'https://mkgohvukpckcfwimxrra.supabase.co/functions/v1/api-v1').replace(/\/$/, '');
  const TOKEN_KEY = 'ownerArchetypeRemoteReportToken';
  const ASSESSMENT_KEY = 'ownerArchetypeRemoteAssessment';
  let requestInFlight = null;

  const readJSON = key => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch { return null; }
  };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const fetchJSON = async (url, options = {}) => {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 202) {
      throw new Error(data?.error || data?.message || `Report service returned ${response.status}`);
    }
    return data;
  };

  function localReport() {
    const direct = readJSON('ownerArchetypeReportData');
    if (direct?.answers) return direct;
    const account = readJSON('cc_account') || readJSON('ccUserAccount');
    const report = account?.report_data || account?.reportData;
    return report?.answers ? report : null;
  }

  function reportPayload(report) {
    const answers = { ...(report?.answers || {}) };
    const firstName = String(report?.firstName || answers.first_name || localStorage.getItem('ccOwnerFirstName') || '').trim();
    const lastName = String(report?.lastName || answers.last_name || localStorage.getItem('ccOwnerLastName') || '').trim();
    const agencyWebsite = String(report?.agencyWebsite || answers.agency_website || localStorage.getItem('ccAgencyWebsite') || '').trim();
    const email = String(report?.email || localStorage.getItem('ccOwnerEmail') || '').trim().toLowerCase();
    const annualRevenue = String(report?.annualRevenue || answers.annual_revenue || '').trim();
    return {
      ...answers,
      first_name: firstName,
      last_name: lastName,
      agency_website: agencyWebsite,
      email,
      annual_revenue: annualRevenue
    };
  }

  async function pollForToken(id, draftToken, initial) {
    if (initial?.report_token) return initial.report_token;
    for (let attempt = 0; attempt < 18; attempt += 1) {
      await sleep(attempt < 3 ? 700 : 1100);
      const status = await fetchJSON(`${API_BASE}/assessments/${encodeURIComponent(id)}/status`, {
        headers: { 'x-draft-token': draftToken }
      });
      if (status?.report_token) return status.report_token;
      if (status?.status === 'failed') throw new Error(status?.message || 'Owner Identity report generation failed');
    }
    throw new Error('Owner Identity PDF is still processing. Please try View report again in a moment.');
  }

  async function createRemoteReport() {
    const existingToken = localStorage.getItem(TOKEN_KEY);
    if (existingToken) return existingToken;

    const report = localReport();
    if (!report?.answers) throw new Error('Owner Identity questionnaire answers are not available in this browser.');
    const payload = reportPayload(report);
    if (!payload.annual_revenue) throw new Error('Annual revenue answer is missing from this Owner Identity assessment.');

    const cachedAssessment = readJSON(ASSESSMENT_KEY);
    let id = cachedAssessment?.id;
    let draftToken = cachedAssessment?.draftToken;

    if (!id || !draftToken) {
      const draft = await fetchJSON(`${API_BASE}/assessments`, { method: 'POST' });
      id = draft.id;
      draftToken = draft.draft_token;
      if (!id || !draftToken) throw new Error('Unable to create the PDF report draft.');
      localStorage.setItem(ASSESSMENT_KEY, JSON.stringify({ id, draftToken }));
    }

    await fetchJSON(`${API_BASE}/assessments/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-draft-token': draftToken
      },
      body: JSON.stringify(payload)
    });

    const idempotencyKey = `cc-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const submitted = await fetchJSON(`${API_BASE}/assessments/${encodeURIComponent(id)}/submit`, {
      method: 'POST',
      headers: {
        'x-draft-token': draftToken,
        'idempotency-key': idempotencyKey
      }
    });

    const token = await pollForToken(id, draftToken, submitted);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ASSESSMENT_KEY, JSON.stringify({ id, draftToken, reportToken: token }));
    return token;
  }

  function ensureReportToken() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) return Promise.resolve(token);
    if (!requestInFlight) {
      requestInFlight = createRemoteReport().finally(() => { requestInFlight = null; });
    }
    return requestInFlight;
  }

  async function openPdf({ fallbackUrl = '' } = {}) {
    const popup = window.open('about:blank', '_blank');
    if (popup) {
      try {
        popup.document.title = 'Preparing Owner Identity Report…';
        popup.document.body.style.cssText = 'font-family:Inter,Arial,sans-serif;padding:32px;color:#111827;background:#f8f8f6';
        popup.document.body.innerHTML = '<p style="margin:0;font-size:14px">Preparing your Owner Identity PDF…</p>';
      } catch {}
    }
    try {
      const token = await ensureReportToken();
      const url = `${API_BASE}/reports/${encodeURIComponent(token)}/pdf/download`;
      if (popup && !popup.closed) popup.location.replace(url);
      else window.location.href = url;
      return true;
    } catch (error) {
      console.warn('Owner Identity PDF unavailable:', error);
      if (popup && !popup.closed) {
        if (fallbackUrl) popup.location.replace(fallbackUrl);
        else popup.close();
      } else if (fallbackUrl) {
        window.location.href = fallbackUrl;
      }
      return false;
    }
  }

  window.CCArchetypePDF = { API_BASE, ensureReportToken, openPdf };
})();
