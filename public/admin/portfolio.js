(() => {
  const API = '/api/accounts?all=true&portfolio=1';
  const REFRESH_MS = 60000;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const number = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const formatNumber = value => {
    const n = number(value);
    return n === null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(n);
  };

  const formatPercent = value => {
    const n = number(value);
    return n === null ? '—' : `${Math.round(n)}%`;
  };

  const formatMoney = value => {
    const n = number(value);
    if (n === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(n);
  };

  const formatDate = value => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const diagnosticState = item => item?.diagnostic_state && typeof item.diagnostic_state === 'object'
    ? item.diagnostic_state
    : {};

  const diagnosticProgress = item => {
    const state = diagnosticState(item);
    const indexes = state.indexes && typeof state.indexes === 'object' ? state.indexes : {};
    const names = ['strength', 'independence', 'performance'];
    const values = names.map(name => {
      const value = Number(indexes?.[name]?.progress || 0);
      return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    });
    const complete = names.filter(name => indexes?.[name]?.complete === true).length;
    return {
      complete,
      average: Math.round(values.reduce((sum, value) => sum + value, 0) / names.length),
      reportReady: state.reportReady === true
    };
  };

  const momentumClass = state => state === 'up'
    ? 'success'
    : state === 'down'
      ? 'danger'
      : 'neutral';

  const bandClass = score => {
    const value = Number(score);
    if (!Number.isFinite(value)) return 'neutral';
    if (value >= 80) return 'success';
    if (value >= 60) return 'warning';
    return 'danger';
  };

  let accounts = [];
  let platform = {};

  async function fetchPortfolio() {
    const response = await fetch(API, { cache: 'no-store' });
    if (response.status === 401) {
      location.href = '/admin/login/';
      throw new Error('Admin session expired.');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Unable to load platform portfolio.');
    accounts = Array.isArray(body.accounts) ? body.accounts : [];
    platform = body.platform && typeof body.platform === 'object' ? body.platform : {};
    return { accounts, platform };
  }

  function wireShell() {
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
    document.querySelectorAll('.admin-profile').forEach(profile => {
      profile.addEventListener('click', () => {
        if (confirm('Sign out of the Creative Creatures admin?')) {
          window.CCAdminAuth?.logout?.();
        }
      });
    });
  }

  function updateTimestamp() {
    document.querySelectorAll('[data-admin-updated]').forEach(node => {
      node.textContent = `Updated ${new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date())}`;
    });
  }

  function showError(error) {
    document.querySelectorAll('[data-admin-error]').forEach(node => {
      node.hidden = false;
      node.textContent = error?.message || 'Live admin data could not be loaded.';
    });
  }

  function clearError() {
    document.querySelectorAll('[data-admin-error]').forEach(node => {
      node.hidden = true;
      node.textContent = '';
    });
  }

  function metricCard(label, value, detail = '', tone = '') {
    return `<article class="portfolio-metric ${tone}">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
      <small>${esc(detail)}</small>
    </article>`;
  }

  function renderScorecardMetrics() {
    const root = document.querySelector('#scorecardMetrics');
    if (!root) return;
    root.innerHTML = [
      metricCard('Agencies', formatNumber(platform.activeAgencies), 'active portfolio'),
      metricCard('Scorecards ready', formatNumber(platform.scorecardsReady), `${formatNumber(platform.scorecardCoverage)}% coverage`, 'blue'),
      metricCard('Average AOFI', formatNumber(platform.averageAofi), 'Agency Owner Freedom Index', 'green'),
      metricCard('Average confidence', formatPercent(platform.averageConfidence), 'across generated scorecards'),
      metricCard('Portfolio valuation', formatMoney(platform.totalValuation), `${formatNumber(platform.valuationCoverage)} agencies valued`, 'purple')
    ].join('');
  }

  function scorecardRows(filterText = '', sortValue = 'score-desc') {
    const query = String(filterText || '').trim().toLowerCase();
    const rows = accounts
      .filter(account => {
        const p = account.portfolio || {};
        const haystack = [
          account.agency_name,
          account.name,
          account.email,
          p.archetype
        ].join(' ').toLowerCase();
        return !query || haystack.includes(query);
      })
      .sort((a, b) => {
        const ap = a.portfolio?.scorecard || {};
        const bp = b.portfolio?.scorecard || {};
        if (sortValue === 'score-desc') return (number(bp.aofi) ?? -1) - (number(ap.aofi) ?? -1);
        if (sortValue === 'confidence-desc') return (number(bp.confidence) ?? -1) - (number(ap.confidence) ?? -1);
        if (sortValue === 'valuation-desc') return (number(bp.enterpriseValue) ?? -1) - (number(ap.enterpriseValue) ?? -1);
        if (sortValue === 'momentum-desc') return (number(bp.momentum?.delta) ?? -999) - (number(ap.momentum?.delta) ?? -999);
        if (sortValue === 'name-asc') return String(a.agency_name || '').localeCompare(String(b.agency_name || ''));
        return 0;
      });
    return rows;
  }

  function renderScorecardPortfolio() {
    const root = document.querySelector('#scorecardPortfolio');
    if (!root) return;
    const search = document.querySelector('#scorecardSearch');
    const sort = document.querySelector('#scorecardSort');
    const rows = scorecardRows(search?.value, sort?.value);

    if (!rows.length) {
      root.innerHTML = '<div class="portfolio-empty"><strong>No matching agencies</strong><span>Generated Agency Scorecards will appear here.</span></div>';
      return;
    }

    root.innerHTML = `<div class="portfolio-table-scroll">
      <table class="portfolio-table scorecard-table">
        <thead>
          <tr>
            <th>Agency</th><th>AOFI</th><th>Confidence</th><th>Momentum</th>
            <th>Performance</th><th>Strength</th><th>Independence</th>
            <th>Valuation</th><th>Diagnostic</th><th></th>
          </tr>
        </thead>
        <tbody>${rows.map(account => {
          const score = account.portfolio?.scorecard || {};
          const progress = diagnosticProgress(account);
          const hasScore = number(score.aofi) !== null;
          return `<tr>
            <td data-label="Agency">
              <strong>${esc(account.agency_name || 'Agency')}</strong>
              <span>${esc(account.email || '')}</span>
              ${account.portfolio?.archetype ? `<em>${esc(account.portfolio.archetype)}</em>` : ''}
            </td>
            <td data-label="AOFI"><span class="score-chip ${bandClass(score.aofi)}">${hasScore ? formatNumber(score.aofi) : '—'}</span></td>
            <td data-label="Confidence">${formatPercent(score.confidence)}</td>
            <td data-label="Momentum"><span class="status-pill ${momentumClass(score.momentum?.state)}">${esc(score.momentum?.label || 'Baseline')}</span></td>
            <td data-label="Performance">${formatNumber(score.performance)}</td>
            <td data-label="Strength">${formatNumber(score.strength)}</td>
            <td data-label="Independence">${formatNumber(score.independence)}</td>
            <td data-label="Valuation">${formatMoney(score.enterpriseValue)}</td>
            <td data-label="Diagnostic"><span>${progress.reportReady ? 'Ready' : `${progress.complete}/3 · ${progress.average}%`}</span></td>
            <td data-label="Action"><button class="mini-btn primary" type="button" data-scorecard-detail="${esc(account.id)}">View</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;

    root.querySelectorAll('[data-scorecard-detail]').forEach(button => {
      button.addEventListener('click', () => openScorecardDetail(button.dataset.scorecardDetail));
    });
  }

  function openScorecardDetail(accountId) {
    const account = accounts.find(item => String(item.id) === String(accountId));
    const modal = document.querySelector('#scorecardDetailModal');
    const content = document.querySelector('#scorecardDetailContent');
    if (!account || !modal || !content) return;

    const score = account.portfolio?.scorecard || {};
    const progress = diagnosticProgress(account);
    const history = Array.isArray(score.history) ? score.history : [];

    content.innerHTML = `
      <header class="portfolio-dialog-head">
        <div>
          <span class="section-label">Agency Scorecard</span>
          <h2>${esc(account.agency_name || 'Agency')}</h2>
          <p>${esc(account.email || '')}</p>
        </div>
        <button type="button" class="modal-x" data-close-scorecard aria-label="Close">×</button>
      </header>

      <div class="portfolio-detail-grid">
        <article><span>AOFI</span><strong>${formatNumber(score.aofi)}</strong></article>
        <article><span>Confidence</span><strong>${formatPercent(score.confidence)}</strong></article>
        <article><span>Momentum</span><strong>${esc(score.momentum?.label || 'Baseline')}</strong></article>
        <article><span>Valuation</span><strong>${formatMoney(score.enterpriseValue)}</strong></article>
      </div>

      <div class="portfolio-index-grid">
        <div><span>Agency Performance</span><strong>${formatNumber(score.performance)}</strong></div>
        <div><span>Agency Strength</span><strong>${formatNumber(score.strength)}</strong></div>
        <div><span>Owner Independence</span><strong>${formatNumber(score.independence)}</strong></div>
      </div>

      <section class="portfolio-detail-section">
        <h3>Account & diagnostic</h3>
        <div class="detail-list">
          <div><span>Owner archetype</span><strong>${esc(account.portfolio?.archetype || '—')}</strong></div>
          <div><span>Diagnostic progress</span><strong>${progress.reportReady ? 'Scorecard Ready' : `${progress.complete}/3 assessments · ${progress.average}%`}</strong></div>
          <div><span>Generated</span><strong>${formatDate(score.generatedAt)}</strong></div>
          <div><span>Validation</span><strong>${esc(score.validation || '—')}</strong></div>
        </div>
      </section>

      <section class="portfolio-detail-section">
        <h3>Score history</h3>
        ${history.length ? `<div class="mini-history">${history.slice().reverse().map(row => `
          <div><span>${formatDate(row.generatedAt)}</span><strong>${formatNumber(row.aofi)}</strong><em>${formatPercent(row.confidence)}</em></div>
        `).join('')}</div>` : '<p class="muted-copy">No historical scorecard snapshots yet.</p>'}
      </section>

      <footer class="portfolio-dialog-actions">
        <a class="mini-btn" href="/platform/?admin=1&tenant=${encodeURIComponent(account.id)}">Open agency</a>
        <button class="mini-btn primary" type="button" data-close-scorecard>Close</button>
      </footer>`;

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('cc-modal-open');
    content.querySelectorAll('[data-close-scorecard]').forEach(button => {
      button.addEventListener('click', closeScorecardDetail);
    });
  }

  function closeScorecardDetail() {
    const modal = document.querySelector('#scorecardDetailModal');
    modal?.classList.remove('open');
    modal?.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('cc-modal-open');
  }

  function renderPlatformMetrics() {
    const root = document.querySelector('#platformMetrics');
    if (!root) return;
    root.innerHTML = [
      metricCard('Active agencies', formatNumber(platform.activeAgencies), 'all active accounts'),
      metricCard('Average AOFI', formatNumber(platform.averageAofi), `${formatNumber(platform.scorecardCoverage)}% scorecard coverage`, 'green'),
      metricCard('Average Strength', formatNumber(platform.averageStrength), 'portfolio structural health'),
      metricCard('Average Performance', formatNumber(platform.averagePerformance), 'portfolio economic performance'),
      metricCard('Average Independence', formatNumber(platform.averageIndependence), 'owner independence'),
      metricCard('MRR', formatMoney(platform.totalMrr), `${formatNumber(platform.mrrCoverage)} agencies with supported MRR`, 'blue'),
      metricCard('Net profit TTM', formatMoney(platform.totalNetProfitTtm), `${formatNumber(platform.netProfitCoverage)} agencies with P&L data`),
      metricCard('Cash', formatMoney(platform.totalCash), `${formatNumber(platform.cashCoverage)} agencies with balance-sheet cash`),
      metricCard('Portfolio valuation', formatMoney(platform.totalValuation), `${formatNumber(platform.valuationCoverage)} agencies valued`, 'purple')
    ].join('');
  }

  function renderPendingTelemetry() {
    const root = document.querySelector('#platformTelemetry');
    if (!root) return;
    const telemetry = Array.isArray(platform.pendingTelemetry) ? platform.pendingTelemetry : [];
    root.innerHTML = telemetry.map(item => `
      <article class="telemetry-card">
        <span>${esc(item.label)}</span>
        <strong>Awaiting source</strong>
        <p>${esc(item.note)}</p>
      </article>`).join('');
  }

  function platformRows(filterText = '', sortValue = 'aofi-desc') {
    const query = String(filterText || '').trim().toLowerCase();
    return accounts
      .filter(account => !query || [account.agency_name, account.name, account.email]
        .join(' ').toLowerCase().includes(query))
      .sort((a, b) => {
        const ap = a.portfolio || {};
        const bp = b.portfolio || {};
        if (sortValue === 'aofi-desc') return (number(bp.scorecard?.aofi) ?? -1) - (number(ap.scorecard?.aofi) ?? -1);
        if (sortValue === 'mrr-desc') return (number(bp.financials?.mrr) ?? -1) - (number(ap.financials?.mrr) ?? -1);
        if (sortValue === 'profit-desc') return (number(bp.financials?.netProfitTtm) ?? -1) - (number(ap.financials?.netProfitTtm) ?? -1);
        if (sortValue === 'cash-desc') return (number(bp.financials?.cash) ?? -1) - (number(ap.financials?.cash) ?? -1);
        if (sortValue === 'name-asc') return String(a.agency_name || '').localeCompare(String(b.agency_name || ''));
        return 0;
      });
  }

  function renderPlatformRollup() {
    const root = document.querySelector('#platformAgencyRollup');
    if (!root) return;
    const search = document.querySelector('#platformSearch');
    const sort = document.querySelector('#platformSort');
    const rows = platformRows(search?.value, sort?.value);

    if (!rows.length) {
      root.innerHTML = '<div class="portfolio-empty"><strong>No matching agencies</strong><span>Portfolio data will appear here.</span></div>';
      return;
    }

    root.innerHTML = `<div class="portfolio-table-scroll">
      <table class="portfolio-table performance-table">
        <thead><tr><th>Agency</th><th>AOFI</th><th>MRR</th><th>Net profit TTM</th><th>Cash</th><th>Valuation</th><th>Coverage</th><th></th></tr></thead>
        <tbody>${rows.map(account => {
          const p = account.portfolio || {};
          const score = p.scorecard || {};
          const financials = p.financials || {};
          const coverage = Array.isArray(financials.coverage) ? financials.coverage.length : 0;
          return `<tr>
            <td data-label="Agency"><strong>${esc(account.agency_name || 'Agency')}</strong><span>${esc(account.email || '')}</span></td>
            <td data-label="AOFI"><span class="score-chip ${bandClass(score.aofi)}">${formatNumber(score.aofi)}</span></td>
            <td data-label="MRR">${formatMoney(financials.mrr)}</td>
            <td data-label="Net profit TTM">${formatMoney(financials.netProfitTtm)}</td>
            <td data-label="Cash">${formatMoney(financials.cash)}</td>
            <td data-label="Valuation">${formatMoney(score.enterpriseValue)}</td>
            <td data-label="Coverage"><span class="coverage-chip">${coverage}/3 financial</span></td>
            <td data-label="Action"><a class="mini-btn" href="/platform/?admin=1&tenant=${encodeURIComponent(account.id)}">Open</a></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;
  }

  function wireFilters() {
    ['scorecardSearch', 'scorecardSort'].forEach(id => {
      const element = document.getElementById(id);
      element?.addEventListener(id.endsWith('Search') ? 'input' : 'change', renderScorecardPortfolio);
    });
    ['platformSearch', 'platformSort'].forEach(id => {
      const element = document.getElementById(id);
      element?.addEventListener(id.endsWith('Search') ? 'input' : 'change', renderPlatformRollup);
    });
  }

  function wireModals() {
    document.querySelector('#scorecardDetailModal')?.addEventListener('click', event => {
      if (event.target?.id === 'scorecardDetailModal') closeScorecardDetail();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeScorecardDetail();
    });
  }

  function render() {
    renderScorecardMetrics();
    renderScorecardPortfolio();
    renderPlatformMetrics();
    renderPendingTelemetry();
    renderPlatformRollup();
    updateTimestamp();
  }

  async function refresh() {
    try {
      await fetchPortfolio();
      clearError();
      render();
    } catch (error) {
      console.error('Admin portfolio refresh failed.', error);
      showError(error);
    }
  }

  async function init() {
    wireShell();
    wireFilters();
    wireModals();
    await refresh();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });

    setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, REFRESH_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
