(() => {
  const API_BASE = String(
    window.CC_ARCHETYPE_API_BASE ||
    'https://mkgohvukpckcfwimxrra.supabase.co/functions/v1/api-v1'
  ).replace(/\/$/, '');

  const TOKEN_KEY = 'ownerArchetypeRemoteReportToken';
  const ASSESSMENT_KEY = 'ownerArchetypeRemoteAssessment';
  let requestInFlight = null;

  const readJSON = key => {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const fetchJSON = async (url, options = {}) => {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok && response.status !== 202) {
      throw new Error(
        data?.error ||
        data?.message ||
        `Report service returned ${response.status}`
      );
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

    const firstName = String(
      report?.firstName ||
      answers.first_name ||
      localStorage.getItem('ccOwnerFirstName') ||
      ''
    ).trim();

    const lastName = String(
      report?.lastName ||
      answers.last_name ||
      localStorage.getItem('ccOwnerLastName') ||
      ''
    ).trim();

    const agencyWebsite = String(
      report?.agencyWebsite ||
      answers.agency_website ||
      localStorage.getItem('ccAgencyWebsite') ||
      ''
    ).trim();

    const email = String(
      report?.email ||
      localStorage.getItem('ccOwnerEmail') ||
      ''
    ).trim().toLowerCase();

    const annualRevenue = String(
      report?.annualRevenue ||
      answers.annual_revenue ||
      ''
    ).trim();

    return {
      ...answers,
      first_name: firstName,
      last_name: lastName,
      agency_website: agencyWebsite,
      email,
      annual_revenue: annualRevenue
    };
  }

  /*
   * The old implementation cached one remote report token globally.
   * That meant a later questionnaire could still open the first person's/
   * first archetype's PDF. This fingerprint binds the cached remote report
   * to the exact questionnaire answers that produced it.
   */
  function assessmentFingerprint(payload) {
    const orderedKeys = [
      'first_name',
      'last_name',
      'agency_website',
      'email',
      'archetype_q1',
      'archetype_q2',
      'archetype_q3',
      'archetype_q4',
      'stage_q5',
      'stage_q6',
      'stage_q7',
      'stage_q8',
      'annual_revenue'
    ];

    return orderedKeys
      .map(key => `${key}:${String(payload?.[key] ?? '').trim()}`)
      .join('|');
  }

  function clearRemoteCache() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ASSESSMENT_KEY);
  }

  async function pollForToken(id, draftToken, initial) {
    if (initial?.report_token) return initial.report_token;

    for (let attempt = 0; attempt < 18; attempt += 1) {
      await sleep(attempt < 3 ? 700 : 1100);

      const status = await fetchJSON(
        `${API_BASE}/assessments/${encodeURIComponent(id)}/status`,
        {
          headers: { 'x-draft-token': draftToken }
        }
      );

      if (status?.report_token) return status.report_token;

      if (status?.status === 'failed') {
        throw new Error(
          status?.message || 'Owner Identity report generation failed'
        );
      }
    }

    throw new Error(
      'Owner Identity PDF is still processing. Please try View report again in a moment.'
    );
  }

  async function createRemoteReport() {
    const report = localReport();

    if (!report?.answers) {
      throw new Error(
        'Owner Identity questionnaire answers are not available in this browser.'
      );
    }

    const payload = reportPayload(report);

    if (!payload.annual_revenue) {
      throw new Error(
        'Annual revenue answer is missing from this Owner Identity assessment.'
      );
    }

    const fingerprint = assessmentFingerprint(payload);
    const cachedAssessment = readJSON(ASSESSMENT_KEY);
    const existingToken = localStorage.getItem(TOKEN_KEY);

    /* Only reuse a report when it belongs to these exact answers. */
    if (
      existingToken &&
      cachedAssessment?.fingerprint === fingerprint
    ) {
      return existingToken;
    }

    /* Any old token without a fingerprint is from the previous broken cache. */
    if (
      existingToken ||
      (cachedAssessment && cachedAssessment.fingerprint !== fingerprint)
    ) {
      clearRemoteCache();
    }

    let id = null;
    let draftToken = null;

    const freshCachedAssessment = readJSON(ASSESSMENT_KEY);

    if (freshCachedAssessment?.fingerprint === fingerprint) {
      id = freshCachedAssessment.id;
      draftToken = freshCachedAssessment.draftToken;
    }

    if (!id || !draftToken) {
      const draft = await fetchJSON(`${API_BASE}/assessments`, {
        method: 'POST'
      });

      id = draft.id;
      draftToken = draft.draft_token;

      if (!id || !draftToken) {
        throw new Error('Unable to create the PDF report draft.');
      }

      localStorage.setItem(
        ASSESSMENT_KEY,
        JSON.stringify({ id, draftToken, fingerprint })
      );
    }

    await fetchJSON(`${API_BASE}/assessments/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-draft-token': draftToken
      },
      body: JSON.stringify(payload)
    });

    const idempotencyKey = [
      'cc',
      id,
      Date.now(),
      Math.random().toString(36).slice(2, 9)
    ].join('-');

    const submitted = await fetchJSON(
      `${API_BASE}/assessments/${encodeURIComponent(id)}/submit`,
      {
        method: 'POST',
        headers: {
          'x-draft-token': draftToken,
          'idempotency-key': idempotencyKey
        }
      }
    );

    const token = await pollForToken(id, draftToken, submitted);

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(
      ASSESSMENT_KEY,
      JSON.stringify({
        id,
        draftToken,
        reportToken: token,
        fingerprint
      })
    );

    return token;
  }

  function ensureReportToken() {
    const report = localReport();

    if (!report?.answers) {
      return Promise.reject(
        new Error(
          'Owner Identity questionnaire answers are not available in this browser.'
        )
      );
    }

    const payload = reportPayload(report);
    const fingerprint = assessmentFingerprint(payload);
    const cachedAssessment = readJSON(ASSESSMENT_KEY);
    const token = localStorage.getItem(TOKEN_KEY);

    if (token && cachedAssessment?.fingerprint === fingerprint) {
      return Promise.resolve(token);
    }

    if (!requestInFlight) {
      requestInFlight = createRemoteReport().finally(() => {
        requestInFlight = null;
      });
    }

    return requestInFlight;
  }

  async function fetchPdfBlob(token) {
    const response = await fetch(
      `${API_BASE}/reports/${encodeURIComponent(token)}/pdf/download`,
      {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      throw new Error(`PDF service returned ${response.status}`);
    }

    const bytes = await response.arrayBuffer();

    return new Blob([bytes], {
      type: 'application/pdf'
    });
  }

  async function openPdf({ fallbackUrl = '' } = {}) {
    /* Open synchronously so popup blockers do not block the PDF viewer. */
    const popup = window.open('about:blank', '_blank');

    if (popup) {
      try {
        popup.document.title = 'Preparing Owner Identity Report…';
        popup.document.body.style.cssText = [
          'font-family:Inter,Arial,sans-serif',
          'padding:32px',
          'color:#111827',
          'background:#f8f8f6'
        ].join(';');
        popup.document.body.innerHTML =
          '<p style="margin:0;font-size:14px">Preparing your Owner Identity PDF…</p>';
      } catch {}
    }

    try {
      const token = await ensureReportToken();
      const pdfBlob = await fetchPdfBlob(token);
      const objectUrl = URL.createObjectURL(pdfBlob);

      /*
       * Opening a Blob URL removes the backend's `attachment` disposition.
       * The browser therefore shows its normal PDF viewer instead of starting
       * a forced download.
       */
      if (popup && !popup.closed) {
        popup.location.replace(objectUrl);
      } else {
        window.location.href = objectUrl;
      }

      /* Give the PDF viewer plenty of time to acquire the Blob URL. */
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5 * 60 * 1000);
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

  window.CCArchetypePDF = {
    API_BASE,
    ensureReportToken,
    openPdf,
    clearRemoteCache
  };
})();
