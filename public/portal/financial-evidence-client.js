(() => {
  const API_BASE = String(window.CC_FINANCIAL_EVIDENCE_API_BASE || '/api/financial-evidence').replace(/\/+$/, '');
  const MAX_FILE_BYTES = 4 * 1024 * 1024;

  function accountIdentity() {
    const account = window.CCAccount?.getAccount?.() || {};
    const id = String(account.id || '').trim();
    return {
      accountId: id && !id.startsWith('local-') ? id : undefined,
      email: String(account.email || localStorage.getItem('ccOwnerEmail') || '').trim(),
      agencyUrl: String(account.agency_url || account.agencyUrl || localStorage.getItem('ccAgencyWebsite') || '').trim()
    };
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || payload.message || 'Financial evidence request failed.');
      error.status = response.status;
      error.code = payload.code;
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
    if (!(file instanceof File)) throw new Error('Select a PDF report first.');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) throw new Error('Only PDF reports can be uploaded.');
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) throw new Error('PDF must be 4 MB or smaller.');

    return request(API_BASE, {
      method: 'POST',
      body: JSON.stringify({
        action: 'prepare_upload',
        ...accountIdentity(),
        evidenceType,
        filename: file.name,
        mimeType: file.type || 'application/pdf',
        size: file.size
      })
    });
  }

  async function putSignedFile(signedUploadUrl, file) {
    const formData = new FormData();
    formData.append('cacheControl', '3600');
    formData.append('', file);
    const response = await fetch(signedUploadUrl, {
      method: 'PUT',
      headers: { 'x-upsert': 'false' },
      body: formData
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let message = text;
      try { message = JSON.parse(text)?.message || JSON.parse(text)?.error || text; } catch {}
      throw new Error(message || 'The PDF could not be uploaded to secure storage.');
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

  async function uploadPdf(evidenceType, file) {
    const prepared = await prepareUpload(evidenceType, file);
    await putSignedFile(prepared.signedUploadUrl, file);

    try {
      const extracted = await extract(prepared.evidence?.id, evidenceType);
      return { ...extracted, uploaded: true, extractionError: null };
    } catch (error) {
      // The file is already safely stored. Return the current DB row so the
      // assessment does not lose the upload if extraction is unavailable.
      let evidence = prepared.evidence || null;
      try {
        const current = await list();
        evidence = (current.evidence || []).find(row => row.evidence_type === evidenceType) || evidence;
      } catch {}
      return {
        uploaded: true,
        evidence,
        extractionError: { message: error.message, code: error.code || null, status: error.status || null }
      };
    }
  }

  async function retryExtraction(evidenceId, evidenceType) {
    return extract(evidenceId, evidenceType);
  }

  async function saveSde({ benefits = [], ownershipPercent = null } = {}) {
    return request(API_BASE, {
      method: 'POST',
      body: JSON.stringify({
        action: 'save_sde',
        ...accountIdentity(),
        benefits,
        ownershipPercent
      })
    });
  }

  window.CCFinancialEvidence = {
    apiBase: API_BASE,
    maxFileBytes: MAX_FILE_BYTES,
    accountIdentity,
    list,
    uploadPdf,
    retryExtraction,
    saveSde
  };
})();
