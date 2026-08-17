(() => {
  const API_BASE = '/api/financial-evidence';
  const MAX_FILE_BYTES = 4 * 1024 * 1024;

  const safeJson = (value, fallback = null) => {
    try { return JSON.parse(value); } catch { return fallback; }
  };

  function accountIdentity() {
    const current = window.CCAccount?.getAccount?.()
      || safeJson(localStorage.getItem('cc_account'), null)
      || safeJson(localStorage.getItem('ccUserAccount'), null)
      || {};
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
      const error = new Error(payload.error || 'Financial evidence request failed.');
      error.status = response.status;
      error.code = payload.code;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  async function list() {
    const identity = accountIdentity();
    const params = new URLSearchParams();
    if (identity.accountId) params.set('accountId', identity.accountId);
    if (identity.email) params.set('email', identity.email);
    if (identity.agencyUrl) params.set('agencyUrl', identity.agencyUrl);
    return request(`${API_BASE}?${params.toString()}`);
  }

  async function prepareUpload(evidenceType, file) {
    return request(API_BASE, {
      method: 'POST',
      body: JSON.stringify({
        action: 'prepare_upload',
        ...accountIdentity(),
        evidenceType,
        filename: file.name,
        size: file.size,
        mimeType: file.type || 'application/pdf'
      })
    });
  }

  async function putSignedFile(signedUploadUrl, file) {
    const response = await fetch(signedUploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: file
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const error = new Error(text || 'The PDF could not be uploaded to secure storage.');
      error.status = response.status;
      error.code = 'STORAGE_UPLOAD_FAILED';
      error.phase = 'storage';
      throw error;
    }
    return true;
  }

  async function extract(evidenceId, evidenceType) {
    return request(API_BASE, {
      method: 'POST',
      body: JSON.stringify({
        action: 'extract',
        ...accountIdentity(),
        evidenceId,
        evidenceType
      })
    });
  }

  async function uploadPrepared(prepared, evidenceType, file) {
    if (!prepared?.evidence?.id) {
      const error = new Error('The financial evidence row was not created. The PDF was not uploaded.');
      error.code = 'EVIDENCE_ROW_NOT_CREATED';
      error.phase = 'database';
      throw error;
    }
    try {
      await putSignedFile(prepared.signedUploadUrl, file);
    } catch (error) {
      error.evidence = prepared.evidence;
      throw error;
    }

    try {
      const extracted = await extract(prepared.evidence.id, evidenceType);
      return { ...extracted, uploaded: true, prepared: true, extractionError: null };
    } catch (error) {
      // Storage success is independent from optional AI extraction. Preserve
      // the database row so the user can retry extraction without re-uploading.
      let evidence = prepared.evidence || null;
      try {
        const current = await list();
        evidence = (current.evidence || []).find(row => row.evidence_type === evidenceType) || evidence;
      } catch {}
      return {
        uploaded: true,
        prepared: true,
        evidence,
        extractionError: { message: error.message, code: error.code || null, status: error.status || null }
      };
    }
  }

  async function uploadPdf(evidenceType, file) {
    const prepared = await prepareUpload(evidenceType, file);
    return uploadPrepared(prepared, evidenceType, file);
  }

  async function retryExtraction(evidenceId, evidenceType) {
    return extract(evidenceId, evidenceType);
  }

  async function saveManual(evidenceType, values = {}) {
    return request(API_BASE, {
      method: 'POST',
      body: JSON.stringify({
        action: 'save_manual',
        ...accountIdentity(),
        evidenceType,
        values
      })
    });
  }

  async function saveSde({ benefits = [], ownershipPercent = null, values = {} } = {}) {
    return request(API_BASE, {
      method: 'POST',
      body: JSON.stringify({
        action: 'save_sde',
        ...accountIdentity(),
        benefits,
        ownershipPercent,
        values
      })
    });
  }

  async function calculatePerformance() {
    return request(API_BASE, {
      method: 'POST',
      body: JSON.stringify({
        action: 'calculate_performance',
        ...accountIdentity()
      })
    });
  }

  window.CCFinancialEvidence = {
    apiBase: API_BASE,
    maxFileBytes: MAX_FILE_BYTES,
    accountIdentity,
    list,
    prepareUpload,
    uploadPrepared,
    uploadPdf,
    retryExtraction,
    saveManual,
    saveSde,
    calculatePerformance
  };
})();
