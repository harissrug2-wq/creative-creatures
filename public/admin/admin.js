(() => {
  const ACCOUNT_API = '/api/accounts';
  const OWNER_LEAD_API = '/api/owner-archetype-leads';
  const REFRESH_MS = 60000;

  const safeJson = (value, fallback = null) => {
    try { return JSON.parse(value); } catch { return fallback; }
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const normalizeUrl = value => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      return parsed.href;
    } catch {
      return raw;
    }
  };

  const displayUrl = value => String(value || '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '') || '—';

  function formatDate(value, includeTime = false) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).split('T')[0] || '—';
    return new Intl.DateTimeFormat('en-US', includeTime
      ? { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { year: 'numeric', month: 'short', day: 'numeric' }
    ).format(date);
  }

  function diagnosticState(item) {
    return item?.diagnostic_state && typeof item.diagnostic_state === 'object'
      ? item.diagnostic_state
      : {};
  }

  function indexSummary(item) {
    const state = diagnosticState(item);
    const indexes = state.indexes && typeof state.indexes === 'object' ? state.indexes : {};
    const names = ['strength', 'independence', 'performance'];
    const completeCount = names.filter(name => indexes?.[name]?.complete === true).length;
    const progressValues = names.map(name => {
      const value = Number(indexes?.[name]?.progress || 0);
      return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    });
    const averageProgress = Math.round(progressValues.reduce((sum, value) => sum + value, 0) / names.length);
    return {
      completeCount,
      averageProgress,
      allComplete: state.allComplete === true || completeCount === 3,
      reportReady: state.reportReady === true,
      integrationsComplete: state.integrationsComplete === true,
      paymentComplete: state.paymentComplete === true
    };
  }

  function isActivatedDiagnostic(item) {
    const state = diagnosticState(item);
    const indexes = state.indexes && typeof state.indexes === 'object' ? state.indexes : {};
    const hasIndexActivity = Object.values(indexes).some(value =>
      value?.complete === true || Number(value?.progress || 0) > 0
    );

    // Accounts created manually by the admin are already diagnostic tenants.
    if (String(item?.source || '').toLowerCase() !== 'owner-archetype') return true;

    // Owner Archetype leads become Diagnostics only after payment/activation.
    return state.paymentComplete === true ||
      state.integrationsComplete === true ||
      state.reportReady === true ||
      state.allComplete === true ||
      Number(state.count || 0) > 0 ||
      hasIndexActivity;
  }

  function isOwnerArchetypeLead(item) {
    return String(item?.source || '').toLowerCase() === 'owner-archetype' && !isActivatedDiagnostic(item);
  }

  function normalizeAccount(item) {
    if (!item) return null;
    const report = item.report_data && typeof item.report_data === 'object' ? item.report_data : {};
    const archetype = item.archetype_result && typeof item.archetype_result === 'object' ? item.archetype_result : {};
    const summary = indexSummary(item);
    const visitDate = report.completedAt || report.completed_at || item.created_at || item.updated_at || null;

    return {
      ...item,
      id: String(item.id || ''),
      name: String(item.name || `${report.firstName || ''} ${report.lastName || ''}` || '').trim() || 'Agency Owner',
      email: String(item.email || report.email || '').trim(),
      agencyName: String(item.agency_name || report.agencyName || '').trim() || 'Agency Diagnostic',
      agencyUrl: String(item.agency_url || report.agencyWebsite || '').trim(),
      source: String(item.source || '').trim(),
      journey: String(item.journey || 'diagnostic').trim(),
      archetypeTitle: String(archetype.title || report.archetypeTitle || '').trim(),
      reportData: report,
      visitDate,
      createdAt: item.created_at || visitDate,
      updatedAt: item.updated_at || visitDate,
      ...summary
    };
  }


  function normalizeLead(item) {
    if (!item) return null;
    const report = item.report_data && typeof item.report_data === 'object' ? item.report_data : {};
    const archetype = item.archetype_result && typeof item.archetype_result === 'object' ? item.archetype_result : {};
    const visitDate = report.completedAt || report.completed_at || item.created_at || item.updated_at || null;
    return {
      ...item,
      id: String(item.id || ''),
      name: String(item.name || `${report.firstName || ''} ${report.lastName || ''}`).trim() || 'Agency Owner',
      email: String(item.email || report.email || '').trim(),
      agencyName: String(item.agency_name || report.agencyName || '').trim() || 'Agency',
      agencyUrl: String(item.agency_url || report.agencyWebsite || '').trim(),
      archetypeTitle: String(archetype.title || report.archetypeTitle || '').trim(),
      reportData: report,
      visitDate,
      createdAt: item.created_at || visitDate,
      updatedAt: item.updated_at || visitDate
    };
  }

  let allAccounts = [];
  let diagnostics = [];
  let ownerArchetypes = [];

  async function fetchAccounts() {
    const needsOwnerHistory = Boolean(document.querySelector('#ownerArchetypeRows'));
    const needsDiagnostics = Boolean(
      document.querySelector('#agencyGrid') ||
      document.querySelector('#platformMetrics') ||
      document.querySelector('#agencyRollup')
    );

    const accountPromise = needsDiagnostics
      ? fetch(`${ACCOUNT_API}?all=true`, { cache: 'no-store' })
      : Promise.resolve(null);
    const leadPromise = needsOwnerHistory
      ? fetch(OWNER_LEAD_API, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'admin_history' }) })
      : Promise.resolve(null);

    const [accountResult, leadResult] = await Promise.allSettled([accountPromise, leadPromise]);
    const accountsResponse = accountResult.status === 'fulfilled' ? accountResult.value : null;
    const leadsResponse = leadResult.status === 'fulfilled' ? leadResult.value : null;

    if (accountsResponse?.status === 401 || leadsResponse?.status === 401) {
      location.href = '/admin/login/';
      throw new Error('Admin session expired.');
    }

    let accountError = null;
    let leadError = null;

    if (needsDiagnostics) {
      if (!accountsResponse?.ok) {
        const payload = await accountsResponse?.json().catch(() => ({})) || {};
        accountError = new Error(payload.error || `Unable to load Diagnostics (${accountsResponse?.status || 'network error'}).`);
      } else {
        const payload = await accountsResponse.json();
        allAccounts = (Array.isArray(payload.accounts) ? payload.accounts : []).map(normalizeAccount).filter(Boolean);
        diagnostics = allAccounts.filter(account => account.journey === 'diagnostic' && isActivatedDiagnostic(account));
      }
    }

    let leadRecords = [];
    if (needsOwnerHistory) {
      if (!leadsResponse?.ok) {
        const payload = await leadsResponse?.json().catch(() => ({})) || {};
        leadError = new Error(payload.error || `Unable to load Owner Archetype history (${leadsResponse?.status || 'network error'}).`);
      } else {
        const payload = await leadsResponse.json();
        leadRecords = (Array.isArray(payload.leads) ? payload.leads : []).map(normalizeLead).filter(Boolean);
      }

      // The Owner Archetype API already returns the complete questionnaire
      // history merged across lead records and converted diagnostic accounts.
      ownerArchetypes = leadRecords.sort((a,b) => new Date(b.visitDate || b.createdAt || 0) - new Date(a.visitDate || a.createdAt || 0));
    }

    // Diagnostics and Performance must not be blanked just because the
    // Owner Archetype endpoint has a problem. Only fail the current page when
    // the dataset that page actually needs could not be loaded.
    if (needsDiagnostics && accountError) throw accountError;
    if (needsOwnerHistory && leadError) throw leadError;

    return { allAccounts, diagnostics, ownerArchetypes };
  }

  function diagnosticStatus(account) {
    if (account.reportReady) return { label: 'Scorecard Ready', className: 'success' };
    if (account.allComplete) return { label: 'Ready to Generate', className: 'info' };
    if (account.completeCount > 0 || account.averageProgress > 0) return { label: 'In Progress', className: 'warning' };
    if (account.integrationsComplete) return { label: 'Integrations Complete', className: 'info' };
    return { label: 'Activated', className: 'neutral' };
  }

  function renderDiagnosticsGrid(items) {
    const grid = document.querySelector('#agencyGrid');
    if (!grid) return;

    if (!items.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>No paid diagnostics yet</h3>
          <p>Owner Archetype leads will move here automatically after their Agency Diagnostic payment is recorded.</p>
        </div>`;
      return;
    }

    grid.innerHTML = items.map(account => {
      const status = diagnosticStatus(account);
      return `
        <article class="agency-card" data-agency-id="${escapeHtml(account.id)}">
          <div class="agency-title">
            <div class="agency-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect x="5" y="8" width="14" height="12" rx="2"/>
                <path d="M9 8V4h6v4M9 12v5M13 10v7M17 13v4"/>
              </svg>
            </div>
            <div class="agency-name">
              <h2>${escapeHtml(account.agencyName)} <span class="plan">Diagnostic</span></h2>
              <p>${escapeHtml(account.email || 'No email')}</p>
              ${account.archetypeTitle ? `<div class="archetype-pill">⚡ ${escapeHtml(account.archetypeTitle)}</div>` : ''}
            </div>
          </div>

          <div class="diagnostic-stats">
            <div class="agency-stat">
              <label>Assessments</label>
              <strong>${account.completeCount}/3</strong>
            </div>
            <div class="agency-stat">
              <label>Analysis</label>
              <strong>${account.averageProgress}%</strong>
            </div>
            <div class="agency-stat">
              <label>Integrations</label>
              <strong>${account.integrationsComplete ? 'Done' : 'Pending'}</strong>
            </div>
          </div>

          <div class="diagnostic-progress">
            <div class="health-head">
              <span>Diagnostic progress</span>
              <span class="status-pill ${status.className}">${escapeHtml(status.label)}</span>
            </div>
            <div class="health-track"><span style="width:${Math.max(account.averageProgress, account.reportReady ? 100 : 0)}%"></span></div>
          </div>

          <div class="card-foot">
            <span class="since">since ${escapeHtml(formatDate(account.createdAt))}</span>
            <button class="mini-btn" data-delete-id="${escapeHtml(account.id)}">Delete</button>
            <a class="mini-btn" href="/platform/?admin=1&tenant=${encodeURIComponent(account.id)}" data-admin-view>◉ Dashboard</a>
            <a class="mini-btn primary" href="/platform/?admin=1&tenant=${encodeURIComponent(account.id)}" data-admin-view>Manage →</a>
          </div>
        </article>`;
    }).join('');

    grid.querySelectorAll('[data-delete-id]').forEach(button => {
      button.addEventListener('click', async () => {
        const id = button.dataset.deleteId;
        if (!confirm('Are you sure you want to remove this diagnostic account?')) return;
        await deleteAccount(id);
      });
    });
  }

  function renderOwnerArchetypeTable(items) {
    const body = document.querySelector('#ownerArchetypeRows');
    const empty = document.querySelector('#ownerArchetypeEmpty');
    const count = document.querySelector('#ownerArchetypeCount');
    if (!body) return;
    if (count) count.textContent = `${items.length} ${items.length === 1 ? 'record' : 'records'}`;

    if (!items.length) {
      body.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    body.innerHTML = items.map(account => {
      const url = normalizeUrl(account.agencyUrl);
      return `
        <tr>
          <td data-label="Name"><strong>${escapeHtml(account.name)}</strong>${account.archetypeTitle ? `<span class="table-sub">${escapeHtml(account.archetypeTitle)}</span>` : ''}</td>
          <td data-label="URL">${url ? `<a class="table-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(displayUrl(account.agencyUrl))}</a>` : '—'}</td>
          <td data-label="Email"><a class="table-link" href="mailto:${escapeHtml(account.email)}">${escapeHtml(account.email || '—')}</a></td>
          <td data-label="Date of Visit"><span>${escapeHtml(formatDate(account.visitDate, true))}</span></td>
          <td data-label="View Report"><button class="mini-btn primary report-btn" data-view-owner-report="${escapeHtml(account.id)}">View Report</button></td>
        </tr>`;
    }).join('');

    body.querySelectorAll('[data-view-owner-report]').forEach(button => {
      button.addEventListener('click', () => openOwnerReport(button.dataset.viewOwnerReport, button));
    });
  }

  async function openOwnerReport(id, button) {
    const account = ownerArchetypes.find(item => item.id === id);
    if (!account?.reportData?.answers) {
      alert('This Owner Archetype record does not contain enough questionnaire data to rebuild the PDF report.');
      return;
    }

    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Preparing…';
    window.CC_ARCHETYPE_REPORT_OVERRIDE = account.reportData;
    try {
      const opened = await window.CCArchetypePDF?.openPdf?.();
      if (!opened) alert('The Owner Archetype PDF could not be prepared. Please try again.');
    } catch (error) {
      console.warn('Admin Owner Archetype report failed.', error);
      alert('The Owner Archetype PDF could not be prepared. Please try again.');
    } finally {
      window.CC_ARCHETYPE_REPORT_OVERRIDE = null;
      button.disabled = false;
      button.textContent = original;
    }
  }

  function renderPerformanceMetrics(items) {
    const grid = document.querySelector('#metricGrid');
    if (!grid) return;

    const total = items.length;
    const generated = items.filter(item => item.reportReady).length;
    const inProgress = items.filter(item => !item.reportReady && (item.completeCount > 0 || item.averageProgress > 0)).length;
    const integrations = items.filter(item => item.integrationsComplete).length;
    const avgProgress = total ? Math.round(items.reduce((sum, item) => sum + item.averageProgress, 0) / total) : 0;

    grid.innerHTML = `
      <article class="platform-metric"><label>▥ Diagnostics</label><strong>${total}</strong></article>
      <article class="platform-metric"><label>✓ Scorecards Ready</label><strong>${generated}</strong></article>
      <article class="platform-metric"><label>↻ In Progress</label><strong>${inProgress}</strong></article>
      <article class="platform-metric amber"><label>〽 Avg Analysis</label><strong>${avgProgress}%</strong></article>
      <article class="platform-metric"><label>♧ Integrations Complete</label><strong>${integrations}</strong></article>`;
  }

  function renderRollupTable(items, filterText = '', sortOption = 'progress-desc') {
    const container = document.querySelector('#rollupTableContainer');
    if (!container) return;

    const query = filterText.trim().toLowerCase();
    const filtered = items.filter(account => !query || [account.agencyName, account.name, account.email, account.archetypeTitle]
      .some(value => String(value || '').toLowerCase().includes(query)));

    filtered.sort((a, b) => {
      if (sortOption === 'progress-desc') return b.averageProgress - a.averageProgress;
      if (sortOption === 'status-desc') return Number(b.reportReady) - Number(a.reportReady) || b.completeCount - a.completeCount;
      if (sortOption === 'name-asc') return a.agencyName.localeCompare(b.agencyName);
      if (sortOption === 'date-desc') return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      return 0;
    });

    if (!filtered.length) {
      container.innerHTML = `
        <div class="roll-row diagnostic header"><span>Diagnostic</span><span>Assessments</span><span>Analysis</span><span>Status</span><span>Action</span></div>
        <div class="admin-table-empty">No matching diagnostic accounts found.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="roll-row diagnostic header"><span>Diagnostic</span><span>Assessments</span><span>Analysis</span><span>Status</span><span>Action</span></div>
      ${filtered.map(account => {
        const status = diagnosticStatus(account);
        return `
          <div class="roll-row diagnostic">
            <div class="roll-agency">
              <span class="agency-icon"><svg viewBox="0 0 24 24"><rect x="5" y="7" width="14" height="14" rx="1"/><path d="M9 7V3h6v4M9 11v6M15 11v6M6 14h12"/></svg></span>
              <div><h3>${escapeHtml(account.agencyName)} <span class="plan">Diagnostic</span></h3><p>${escapeHtml(account.email)}</p>${account.archetypeTitle ? `<div class="archetype-pill">⚡ ${escapeHtml(account.archetypeTitle)}</div>` : ''}</div>
            </div>
            <strong>${account.completeCount}/3</strong>
            <div class="progress-cell"><div class="bar"><span style="width:${account.averageProgress}%"></span></div><span>${account.averageProgress}%</span></div>
            <div><span class="status-pill ${status.className}">${escapeHtml(status.label)}</span></div>
            <div class="action-icons"><a class="circle-btn" href="/platform/?admin=1&tenant=${encodeURIComponent(account.id)}" title="Open Dashboard">◉</a><a class="circle-btn primary" href="/platform/?admin=1&tenant=${encodeURIComponent(account.id)}" title="Manage Diagnostic">→</a></div>
          </div>`;
      }).join('')}`;
  }

  async function deleteAccount(id) {
    const response = await fetch(`${ACCOUNT_API}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      alert(payload.error || 'The diagnostic could not be deleted.');
      return;
    }
    await refresh();
  }

  function wireShell() {
    document.querySelectorAll('.admin-profile').forEach(profile=>profile.addEventListener('click',()=>{ if(confirm('Sign out of the Creative Creatures admin?')) window.CCAdminAuth?.logout?.(); }));
    const side = document.querySelector('.admin-side');
    const overlay = document.querySelector('.admin-overlay');
    document.querySelector('.admin-mobile')?.addEventListener('click', () => {
      side?.classList.toggle('open');
      overlay?.classList.toggle('open');
    });
    overlay?.addEventListener('click', () => {
      side?.classList.remove('open');
      overlay?.classList.remove('open');
    });
  }

  function wireNewDiagnostic() {
    const modal = document.querySelector('#newAgencyModal');
    const form = document.querySelector('#newAgencyForm');
    document.querySelectorAll('[data-new-agency]').forEach(button => button.addEventListener('click', () => modal?.classList.add('open')));
    document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', () => modal?.classList.remove('open')));

    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const name = document.querySelector('#newAgencyName')?.value.trim();
      const email = document.querySelector('#newAgencyEmail')?.value.trim();
      const website = document.querySelector('#newAgencyWebsite')?.value.trim();
      if (!name || !email || !website) return;

      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      const original = submit.textContent;
      submit.textContent = 'Creating…';
      try {
        const response = await fetch(ACCOUNT_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            agencyUrl: website,
            agencyName: name,
            journey: 'diagnostic',
            source: 'admin-console'
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Unable to create diagnostic.');
        modal?.classList.remove('open');
        form.reset();
        await refresh();
      } catch (error) {
        alert(error.message || 'Unable to create diagnostic.');
      } finally {
        submit.disabled = false;
        submit.textContent = original;
      }
    });
  }

  function wirePerformanceFilters() {
    const search = document.querySelector('#agencySearch');
    const sort = document.querySelector('#agencySort');
    const update = () => renderRollupTable(diagnostics, search?.value || '', sort?.value || 'progress-desc');
    search?.addEventListener('input', update);
    sort?.addEventListener('change', update);
  }

  function renderCurrentPage() {
    renderDiagnosticsGrid(diagnostics);
    renderOwnerArchetypeTable(ownerArchetypes);
    renderPerformanceMetrics(diagnostics);
    const search = document.querySelector('#agencySearch');
    const sort = document.querySelector('#agencySort');
    renderRollupTable(diagnostics, search?.value || '', sort?.value || 'progress-desc');
  }

  async function refresh() {
    try {
      await fetchAccounts();
      renderCurrentPage();
      document.querySelectorAll('[data-admin-error]').forEach(node => { node.hidden = true; node.textContent = ''; });
      document.querySelectorAll('[data-admin-updated]').forEach(node => {
        node.textContent = `Updated ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date())}`;
      });
    } catch (error) {
      console.error('Admin data refresh failed.', error);
      document.querySelectorAll('[data-admin-error]').forEach(node => {
        node.hidden = false;
        node.textContent = error?.message || 'Live admin data could not be loaded. Refresh the page to try again.';
      });
    }
  }

  async function init() {
    wireShell();
    wireNewDiagnostic();
    wirePerformanceFilters();
    await refresh();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });
    setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, REFRESH_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
