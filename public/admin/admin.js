(() => {
  const BASELINE_AGENCIES = [
    {
      id: 'demo-directing-design',
      agencyName: 'Directing Design',
      ownerEmail: 'owner@directingdesign.com',
      agencyWebsite: 'directingdesign.com',
      archetypeTitle: 'The Creative Wizard',
      plan: 'Growth',
      mrr: 10040,
      accountsCount: 8,
      integrationsCount: 9,
      healthPct: 63,
      healthyCount: 5,
      riskCount: 3,
      createdAt: '2024-01-15',
      source: 'seed'
    },
    {
      id: 'demo-bright-foundry',
      agencyName: 'Bright Foundry Co.',
      ownerEmail: 'ops@brightfoundry.co',
      agencyWebsite: 'brightfoundry.co',
      archetypeTitle: 'The Control Builder',
      plan: 'Starter',
      mrr: 1400,
      accountsCount: 2,
      integrationsCount: 3,
      healthPct: 50,
      healthyCount: 1,
      riskCount: 1,
      createdAt: '2025-03-02',
      source: 'seed'
    }
  ];

  function safeJson(str, fallback = null) {
    try { return JSON.parse(str); } catch { return fallback; }
  }

  function formatMRR(val) {
    const num = Number(val) || 0;
    if (num >= 1000) {
      return `$${(num / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    }
    return `$${num.toLocaleString()}`;
  }

  function formatCurrency(val) {
    const num = Number(val) || 0;
    return `$${num.toLocaleString('en-US')}`;
  }

  function parseRevenue(revenueStr) {
    if (!revenueStr) return 5000;
    if (typeof revenueStr === 'number') return revenueStr;
    const lower = String(revenueStr).toLowerCase();
    if (lower.includes('under_1m') || lower.includes('under $1m')) return 4500;
    if (lower.includes('1m_2m') || lower.includes('$1m and $2m')) return 12000;
    if (lower.includes('2m_3m') || lower.includes('$2m and $3m')) return 22000;
    if (lower.includes('over_3m') || lower.includes('over $3m')) return 38000;
    return 5000;
  }

  function normalizeAccount(item) {
    if (!item) return null;
    const report = item.report_data || item.reportData || safeJson(localStorage.getItem('ownerArchetypeReportData'), {});
    const archetypeResult = item.archetype_result || item.archetypeResult || {};
    const archetypeTitle = archetypeResult.title || report?.archetypeTitle || (item.source === 'owner-archetype' ? 'Owner Identity' : '');

    const mrr = item.mrr !== undefined ? Number(item.mrr) : parseRevenue(report?.annualRevenue || item.annualRevenue);
    const accountsCount = item.accountsCount || item.accounts_count || (report ? 4 : 2);
    const integrationsCount = item.integrationsCount || item.integrations_count || Math.max(2, accountsCount + 1);
    const healthPct = item.healthPct || item.health_pct || 75;
    const healthyCount = Math.round((healthPct / 100) * accountsCount);
    const riskCount = Math.max(0, accountsCount - healthyCount);

    const rawDate = item.created_at || item.createdAt || report?.completedAt || new Date().toISOString();
    const formattedDate = String(rawDate).split('T')[0];

    const agencyName = item.agency_name || item.agencyName || item.name || 'Agency Tenant';
    const ownerEmail = item.email || item.ownerEmail || 'owner@agency.com';
    const agencyWebsite = item.agency_url || item.agencyWebsite || item.agency_url_normalized || '';

    return {
      id: String(item.id || ownerEmail || agencyWebsite || Math.random().toString(36).slice(2)),
      agencyName,
      ownerEmail,
      agencyWebsite,
      archetypeTitle,
      plan: item.plan || (item.journey ? item.journey.charAt(0).toUpperCase() + item.journey.slice(1) : 'Growth'),
      mrr,
      accountsCount,
      integrationsCount,
      healthPct,
      healthyCount,
      riskCount,
      createdAt: formattedDate,
      source: item.source || 'db'
    };
  }

  let stateAgencies = [];

  async function fetchAllAgencies() {
    const map = new Map();

    // 1. Load Baseline seed agencies
    BASELINE_AGENCIES.forEach(item => map.set((item.agencyWebsite || item.ownerEmail).toLowerCase(), item));

    // 2. Load DB Accounts
    try {
      const res = await fetch('/api/accounts?all=true');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.accounts)) {
          data.accounts.forEach(item => {
            const norm = normalizeAccount(item);
            if (norm && norm.ownerEmail) {
              const key = (norm.agencyWebsite || norm.ownerEmail).toLowerCase();
              map.set(key, norm);
            }
          });
        }
      }
    } catch (e) {
      console.warn('API Accounts check warning:', e);
    }

    // 3. Load LocalStorage signups
    const localAccounts = safeJson(localStorage.getItem('ccAccounts'), []);
    if (Array.isArray(localAccounts)) {
      localAccounts.forEach(item => {
        const norm = normalizeAccount(item);
        if (norm && norm.ownerEmail) {
          const key = (norm.agencyWebsite || norm.ownerEmail).toLowerCase();
          map.set(key, norm);
        }
      });
    }

    const localAccount = safeJson(localStorage.getItem('cc_account'), null) || safeJson(localStorage.getItem('ccUserAccount'), null);
    if (localAccount) {
      const norm = normalizeAccount(localAccount);
      if (norm && norm.ownerEmail) {
        const key = (norm.agencyWebsite || norm.ownerEmail).toLowerCase();
        map.set(key, norm);
      }
    }

    const localReport = safeJson(localStorage.getItem('ownerArchetypeReportData'), null);
    if (localReport && (localReport.agencyWebsite || localReport.email)) {
      const norm = normalizeAccount({
        agency_name: localReport.agencyName,
        email: localReport.email,
        agency_url: localReport.agencyWebsite,
        report_data: localReport,
        source: 'owner-archetype'
      });
      if (norm) {
        const key = (norm.agencyWebsite || norm.ownerEmail).toLowerCase();
        map.set(key, norm);
      }
    }

    stateAgencies = Array.from(map.values());
    return stateAgencies;
  }

  function renderAgenciesGrid(agencies) {
    const grid = document.querySelector('#agencyGrid');
    if (!grid) return;

    if (!agencies.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>No agencies found</h3>
          <p>Sign up an agency using the Owner Identity Report or click "+ New Agency" to create one.</p>
        </div>`;
      return;
    }

    grid.innerHTML = agencies.map(agency => `
      <article class="agency-card" data-agency-id="${agency.id}">
        <div class="agency-title">
          <div class="agency-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="5" y="8" width="14" height="12" rx="2"/>
              <path d="M9 8V4h6v4M9 12v5M13 10v7M17 13v4"/>
            </svg>
          </div>
          <div class="agency-name">
            <h2>${agency.agencyName} <span class="plan">${agency.plan}</span></h2>
            <p>${agency.ownerEmail}</p>
            ${agency.archetypeTitle ? `<div class="archetype-pill">⚡ ${agency.archetypeTitle}</div>` : ''}
          </div>
        </div>

        <div class="agency-stats">
          <div class="agency-stat">
            <label>♧ Accounts</label>
            <strong>${agency.accountsCount}</strong>
          </div>
          <div class="agency-stat">
            <label>$ MRR</label>
            <strong>${formatMRR(agency.mrr)}</strong>
          </div>
          <div class="agency-stat">
            <label>♮ Integrations</label>
            <strong>${agency.integrationsCount}</strong>
          </div>
        </div>

        <div class="health">
          <div class="health-head">
            <span>Account health</span>
            <span>${agency.healthyCount}/${agency.accountsCount} healthy</span>
          </div>
          <div class="health-track">
            <span style="width:${agency.healthPct}%"></span>
          </div>
          <div class="health-labels">
            <span><i>●</i> ${agency.healthyCount} healthy</span>
            <span class="risk"><i>●</i> ${agency.riskCount} at risk</span>
          </div>
        </div>

        <div class="card-foot">
          <span class="since">since ${agency.createdAt}</span>
          <button class="mini-btn" data-delete-id="${agency.id}">Delete</button>
          <a class="mini-btn" href="/platform/?admin=1&tenant=${encodeURIComponent(agency.id)}" data-admin-view>◉ Dashboard</a>
          <a class="mini-btn primary" href="/platform/?admin=1&tenant=${encodeURIComponent(agency.id)}" data-admin-view>Manage →</a>
        </div>
      </article>
    `).join('');

    // Attach delete handlers
    grid.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.deleteId;
        if (!confirm('Are you sure you want to remove this agency tenant?')) return;
        await deleteAgency(id);
      });
    });
  }

  function renderPerformanceMetrics(agencies) {
    const metricGrid = document.querySelector('#metricGrid');
    if (!metricGrid) return;

    const totalAgencies = agencies.length;
    const totalAccounts = agencies.reduce((acc, a) => acc + (a.accountsCount || 0), 0);
    const totalMRR = agencies.reduce((acc, a) => acc + (a.mrr || 0), 0);
    const avgHealth = totalAgencies > 0 ? Math.round(agencies.reduce((acc, a) => acc + (a.healthPct || 0), 0) / totalAgencies) : 0;
    const totalIntegrations = agencies.reduce((acc, a) => acc + (a.integrationsCount || 0), 0);

    metricGrid.innerHTML = `
      <article class="platform-metric">
        <label>▥ Agencies</label>
        <strong>${totalAgencies}</strong>
      </article>
      <article class="platform-metric">
        <label>♙ Accounts</label>
        <strong>${totalAccounts}</strong>
      </article>
      <article class="platform-metric">
        <label>$ Total MRR</label>
        <strong>${formatCurrency(totalMRR)}</strong>
      </article>
      <article class="platform-metric amber">
        <label>〽 Avg Health</label>
        <strong>${avgHealth}%</strong>
      </article>
      <article class="platform-metric">
        <label>♧ Integrations live</label>
        <strong>${totalIntegrations}</strong>
      </article>
    `;
  }

  function renderRollupTable(agencies, filterText = '', sortOption = 'mrr-desc') {
    const container = document.querySelector('#rollupTableContainer');
    if (!container) return;

    let filtered = agencies.filter(agency => {
      if (!filterText) return true;
      const q = filterText.toLowerCase();
      return (
        agency.agencyName.toLowerCase().includes(q) ||
        agency.ownerEmail.toLowerCase().includes(q) ||
        (agency.archetypeTitle && agency.archetypeTitle.toLowerCase().includes(q))
      );
    });

    // Apply Sorting
    filtered.sort((a, b) => {
      if (sortOption === 'mrr-desc') return (b.mrr || 0) - (a.mrr || 0);
      if (sortOption === 'health-desc') return (b.healthPct || 0) - (a.healthPct || 0);
      if (sortOption === 'name-asc') return a.agencyName.localeCompare(b.agencyName);
      if (sortOption === 'accounts-desc') return (b.accountsCount || 0) - (a.accountsCount || 0);
      if (sortOption === 'date-desc') return (b.createdAt || '').localeCompare(a.createdAt || '');
      return 0;
    });

    const totalMRR = agencies.reduce((acc, a) => acc + (a.mrr || 0), 0) || 1;

    if (!filtered.length) {
      container.innerHTML = `
        <div class="roll-row header">
          <span>Agency</span><span>Accounts</span><span>MRR share</span><span>Health</span><span>Action</span>
        </div>
        <div style="padding:40px;text-align:center;color:#8995a4;">
          No matching agency tenants found.
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="roll-row header">
        <span>Agency</span><span>Accounts</span><span>MRR share</span><span>Health</span><span>Action</span>
      </div>
      ${filtered.map(agency => {
        const sharePct = Math.min(100, Math.round(((agency.mrr || 0) / totalMRR) * 100));
        return `
          <div class="roll-row" data-name="${agency.agencyName.toLowerCase()}">
            <div class="roll-agency">
              <span class="agency-icon">
                <svg viewBox="0 0 24 24"><rect x="5" y="7" width="14" height="14" rx="1"/><path d="M9 7V3h6v4M9 11v6M15 11v6M6 14h12"/></svg>
              </span>
              <div>
                <h3>${agency.agencyName} <span class="plan">${agency.plan}</span></h3>
                <p>${agency.integrationsCount} integrations · ${agency.ownerEmail}</p>
                ${agency.archetypeTitle ? `<div class="archetype-pill">⚡ ${agency.archetypeTitle}</div>` : ''}
              </div>
            </div>
            <strong>${agency.accountsCount}</strong>
            <div>
              <div class="mrr-share">
                <span>share</span><strong>${formatCurrency(agency.mrr)}</strong>
              </div>
              <div class="mrr-share">
                <div class="bar"><span style="width:${sharePct}%"></span></div>
              </div>
            </div>
            <div class="health-inline">
              <div class="bar"><span style="width:${agency.healthPct}%"></span></div>
              <span>${agency.healthPct}%</span>
              <small>✓${agency.healthyCount}&nbsp;&nbsp;!${agency.riskCount}</small>
            </div>
            <div class="action-icons">
              <a class="circle-btn" data-admin-view href="/platform/?admin=1&tenant=${encodeURIComponent(agency.id)}" title="Peek Dashboard">◉</a>
              <a class="circle-btn primary" data-admin-view href="/platform/?admin=1&tenant=${encodeURIComponent(agency.id)}" title="Manage Agency">→</a>
            </div>
          </div>
        `;
      }).join('')}
    `;
  }

  async function deleteAgency(id) {
    // 1. Try DB deletion
    try {
      await fetch(`/api/accounts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('DB delete fallback warning:', e);
    }

    // 2. Remove from stateAgencies
    stateAgencies = stateAgencies.filter(a => a.id !== id);

    // 3. Remove from LocalStorage ccAccounts
    const localAccounts = safeJson(localStorage.getItem('ccAccounts'), []) || [];
    const updatedLocal = localAccounts.filter(a => a.id !== id && a.email !== id);
    localStorage.setItem('ccAccounts', JSON.stringify(updatedLocal));

    // Re-render views
    renderAgenciesGrid(stateAgencies);
    renderPerformanceMetrics(stateAgencies);
    renderRollupTable(stateAgencies);
  }

  async function init() {
    // Sidebar Mobile Toggle
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

    // New Agency Modal Triggers
    const modal = document.querySelector('#newAgencyModal');
    document.querySelectorAll('[data-new-agency]').forEach(btn => {
      btn.addEventListener('click', () => modal?.classList.add('open'));
    });
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => modal?.classList.remove('open'));
    });

    // New Agency Form Submission
    const newAgencyForm = document.querySelector('#newAgencyForm');
    newAgencyForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.querySelector('#newAgencyName')?.value.trim();
      const email = document.querySelector('#newAgencyEmail')?.value.trim();
      const website = document.querySelector('#newAgencyWebsite')?.value.trim();
      const plan = document.querySelector('#newAgencyPlan')?.value || 'Growth';
      const mrr = Number(document.querySelector('#newAgencyMRR')?.value) || 5000;

      if (!name || !email) return;

      const newAgencyPayload = {
        name,
        email,
        agencyUrl: website || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        agencyName: name,
        journey: plan.toLowerCase(),
        source: 'admin-console'
      };

      // Try Backend POST
      let createdAccount = null;
      try {
        const res = await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAgencyPayload)
        });
        if (res.ok) {
          const payload = await res.json();
          createdAccount = payload.account;
        }
      } catch (err) {
        console.warn('Backend creation failed, creating locally', err);
      }

      const newNorm = normalizeAccount(createdAccount || {
        ...newAgencyPayload,
        mrr,
        plan,
        accountsCount: 3,
        integrationsCount: 4,
        healthPct: 80,
        createdAt: new Date().toISOString().split('T')[0]
      });

      // Update Local Storage
      const localAccounts = safeJson(localStorage.getItem('ccAccounts'), []) || [];
      localAccounts.push(newNorm);
      localStorage.setItem('ccAccounts', JSON.stringify(localAccounts));

      // Append to stateAgencies
      stateAgencies.unshift(newNorm);

      // Re-render
      renderAgenciesGrid(stateAgencies);
      renderPerformanceMetrics(stateAgencies);
      renderRollupTable(stateAgencies);

      // Close Modal and Reset Form
      modal?.classList.remove('open');
      newAgencyForm.reset();
    });

    // Search and Sort Event Listeners for Performance View
    const searchInput = document.querySelector('#agencySearch');
    const sortSelect = document.querySelector('#agencySort');

    const updateRollup = () => {
      renderRollupTable(stateAgencies, searchInput?.value || '', sortSelect?.value || 'mrr-desc');
    };

    searchInput?.addEventListener('input', updateRollup);
    sortSelect?.addEventListener('change', updateRollup);

    // Initial Data Fetch & Initial Render
    await fetchAllAgencies();
    renderAgenciesGrid(stateAgencies);
    renderPerformanceMetrics(stateAgencies);
    renderRollupTable(stateAgencies);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
