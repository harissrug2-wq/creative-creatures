(() => {
  if ((document.body?.dataset?.page || '') !== 'platform') return;

  const pageWrap = () => document.querySelector('.page-wrap');
  const qs = new URLSearchParams(location.search);

  const safeJson = (value, fallback = null) => {
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const clean = value => String(value ?? '').trim();
  const finite = value => {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  const money = value => {
    const number = finite(value);
    if (number === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(number);
  };

  const percentage = value => {
    const number = finite(value);
    if (number === null) return '—';
    return `${Number.isInteger(number) ? number : number.toFixed(1)}%`;
  };

  const displayNumber = value => {
    const number = finite(value);
    if (number === null) return '—';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(number);
  };

  const currentAccount = () => safeJson(localStorage.getItem('cc_account'), null)
    || safeJson(localStorage.getItem('ccUserAccount'), null)
    || {};

  function identity() {
    const account = currentAccount();
    const tenant = clean(qs.get('tenant'));
    return {
      accountId: tenant || (account.id && !String(account.id).startsWith('local-') ? account.id : ''),
      email: tenant ? '' : clean(account.email || localStorage.getItem('ccOwnerEmail')),
      agencyUrl: tenant ? '' : clean(account.agency_url || account.agencyUrl || localStorage.getItem('ccAgencyWebsite'))
    };
  }

  function queryString() {
    const id = identity();
    const params = new URLSearchParams();
    if (id.accountId) params.set('accountId', id.accountId);
    if (id.email) params.set('email', id.email);
    if (id.agencyUrl) params.set('agencyUrl', id.agencyUrl);
    return params.toString();
  }

  async function jsonRequest(url) {
    const response = await fetch(url, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Monitor data could not be loaded.');
      error.code = payload.code || null;
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function evidenceMap(payload) {
    const rows = Array.isArray(payload?.evidence) ? payload.evidence : [];
    const map = new Map();
    rows.forEach(row => {
      const current = map.get(row.evidence_type);
      const currentAt = new Date(current?.updated_at || current?.created_at || 0).getTime();
      const rowAt = new Date(row?.updated_at || row?.created_at || 0).getTime();
      if (!current || rowAt >= currentAt) map.set(row.evidence_type, row);
    });
    return map;
  }

  function metricMap(goals) {
    return Object.fromEntries((Array.isArray(goals?.metrics) ? goals.metrics : []).map(metric => [metric.id, metric]));
  }

  function targetMap(goals) {
    return goals?.targets && typeof goals.targets === 'object' ? goals.targets : {};
  }

  function progressHistory(goals, metricId) {
    return Array.isArray(goals?.progressHistory?.[metricId]) ? goals.progressHistory[metricId] : [];
  }

  const dashboardMetrics = [
    { id:'revenue', label:'Gross Revenue', source:'goal', format:'money', direction:'increase' },
    { id:'recurringRevenue', label:'Recurring Revenue', source:'service', field:'recurringRevenue', format:'money', direction:'increase' },
    { id:'projectRevenue', label:'Project Revenue', source:'service', field:'projectRevenue', format:'money', direction:'increase' },
    { id:'cogs', label:'COGS %', source:'goal', format:'percent', direction:'decrease' },
    { id:'salesCloseRate', label:'Sales Close Rate', source:'none', format:'percent', direction:'increase' },
    { id:'churnRate', label:'MRR Churn Rate', source:'none', format:'percent', direction:'decrease' },
    { id:'nps', label:'NPS', source:'none', format:'number', direction:'increase' },
    { id:'teamUtilization', label:'Team Utilization', source:'none', format:'percent', direction:'increase' },
    { id:'netProfit', label:'Net Profit', source:'pnl', field:'netIncomeTTM', format:'money', direction:'increase' },
    { id:'cash', label:'Cash on Hand', source:'balance', field:'cash', format:'money', direction:'increase' }
  ];

  const state = {
    goals: null,
    evidence: new Map(),
    year: new Date().getFullYear(),
    timeframe: 'Annual',
    period: 'YTD',
    compare: 'YoY'
  };

  function formatValue(value, format) {
    if (format === 'money') return money(value);
    if (format === 'percent') return percentage(value);
    return displayNumber(value);
  }

  function targetFor(metricId) {
    return targetMap(state.goals)?.[metricId] || null;
  }

  function targetValue(target) {
    return finite(target?.resolvedValue ?? target?.resolved_target_value ?? target?.targetValue ?? target?.target_value);
  }

  function targetDisplay(target, format) {
    const value = targetValue(target);
    return value === null ? 'No Goal Set' : formatValue(value, format);
  }

  function goalActual(metricId) {
    return finite(metricMap(state.goals)?.[metricId]?.actualValue);
  }

  function latestHistoryActual(metricId) {
    const history = progressHistory(state.goals, metricId);
    if (!history.length) return null;

    const matches = history.filter(row => {
      if (!row?.capturedAt) return false;
      const date = new Date(row.capturedAt);
      if (Number.isNaN(date.getTime())) return false;
      if (date.getFullYear() !== Number(state.year)) return false;

      if (state.timeframe === 'Annual') return true;
      if (state.timeframe === 'Quarterly') {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `Q${quarter}` === state.period;
      }
      if (state.timeframe === 'Monthly') {
        return date.toLocaleString('en-US', { month: 'long' }) === state.period;
      }
      if (state.timeframe === 'Weekly') {
        const start = weekStart(date);
        return weekLabel(start) === state.period;
      }
      return true;
    });

    const row = matches.sort((a,b) => new Date(b.capturedAt) - new Date(a.capturedAt))[0];
    return row ? finite(row.actualValue) : null;
  }

  function valueFor(definition) {
    const evidence = state.evidence;
    if (definition.source === 'goal') {
      if (state.timeframe === 'Annual' && Number(state.year) === new Date().getFullYear()) {
        return goalActual(definition.id);
      }
      return latestHistoryActual(definition.id);
    }

    if (definition.source === 'service') {
      return finite(evidence.get('service_revenue_mix')?.extracted_data?.[definition.field]);
    }
    if (definition.source === 'pnl') {
      return finite(evidence.get('profit_loss')?.extracted_data?.[definition.field]);
    }
    if (definition.source === 'balance') {
      return finite(evidence.get('balance_sheet')?.extracted_data?.[definition.field]);
    }
    return null;
  }

  function sourceFor(definition) {
    if (definition.source === 'goal') return 'Agency Goals / diagnostic evidence';
    if (definition.source === 'service') return 'Service Revenue Mix evidence';
    if (definition.source === 'pnl') return 'Profit & Loss evidence';
    if (definition.source === 'balance') return 'Balance Sheet evidence';
    return 'No connected source yet';
  }

  function pace(definition, actual) {
    const target = targetFor(definition.id);
    const goal = targetValue(target);
    if (goal === null) return { label:'No Goal Set', cls:'unset' };
    if (actual === null) return { label:'No Data', cls:'unset' };

    const denominator = Math.max(Math.abs(goal), 0.0001);
    let shortfall;
    if (definition.direction === 'decrease') {
      if (actual <= goal) return { label:'On Pace', cls:'on' };
      shortfall = ((actual - goal) / denominator) * 100;
    } else {
      if (actual >= goal) return { label:'On Pace', cls:'on' };
      shortfall = ((goal - actual) / denominator) * 100;
    }

    if (shortfall <= 10) return { label:'Watch', cls:'watch' };
    return { label:'Off Pace', cls:'off' };
  }

  function metricCard(definition) {
    const actual = valueFor(definition);
    const status = pace(definition, actual);
    const target = targetFor(definition.id);
    return `<article class="live-kpi-card ${actual === null ? 'is-empty' : ''}">
      <div class="live-kpi-head">
        <span>${esc(definition.label)}</span>
        <span class="live-status ${status.cls}">${esc(status.label)}</span>
      </div>
      <strong>${formatValue(actual, definition.format)}</strong>
      <div class="live-kpi-meta">
        <span>Goal <b>${targetDisplay(target, definition.format)}</b></span>
        <span>${esc(sourceFor(definition))}</span>
      </div>
    </article>`;
  }

  function goalRows() {
    const preferred = ['revenue','cogs','margin','aofi','valuation','ownerDelivery','ownerSales','leadership'];
    const metrics = metricMap(state.goals);
    return preferred.map(id => metrics[id]).filter(Boolean).map(metric => {
      const target = targetFor(metric.id);
      const definition = dashboardMetrics.find(item => item.id === metric.id)
        || {
          id: metric.id,
          label: metric.label,
          format: metric.unit === '$' ? 'money' : metric.unit === '%' ? 'percent' : 'number',
          direction: ['ownerDelivery','ownerSales','cogs'].includes(metric.id) ? 'decrease' : 'increase'
        };
      const actual = finite(metric.actualValue);
      const status = pace(definition, actual);
      return `<tr>
        <td data-label="Goal"><strong>${esc(metric.label)}</strong><span>${esc(metric.group || '')}</span></td>
        <td data-label="Actual">${formatValue(actual, definition.format)}</td>
        <td data-label="Target">${targetDisplay(target, definition.format)}</td>
        <td data-label="Status"><span class="live-status ${status.cls}">${esc(status.label)}</span></td>
      </tr>`;
    }).join('');
  }

  function activeAccounts() {
    const clients = state.evidence.get('client_revenue')?.extracted_data?.clients;
    return Array.isArray(clients) ? clients.length : null;
  }

  function accountMetricCards() {
    const service = state.evidence.get('service_revenue_mix')?.extracted_data || {};
    const items = [
      {label:'Total Active Accounts', value:activeAccounts(), format:'number', source:'Client Revenue evidence'},
      {label:'New Accounts', value:null, format:'number', source:'No connected source yet'},
      {label:'Account Churn', value:null, format:'percent', source:'No connected source yet'},
      {label:'Total Recurring Revenue', value:finite(service.recurringRevenue), format:'money', source:'Service Revenue Mix evidence'},
      {label:'Total Project Revenue', value:finite(service.projectRevenue), format:'money', source:'Service Revenue Mix evidence'}
    ];
    return items.map(item => `<article class="live-account-card ${item.value === null ? 'is-empty':''}">
      <span>${esc(item.label)}</span>
      <strong>${formatValue(item.value,item.format)}</strong>
      <small>${esc(item.source)}</small>
    </article>`).join('');
  }

  function departmentRows() {
    const departments = Array.isArray(state.goals?.departments) ? state.goals.departments : [];
    if (!departments.length) return '<div class="live-empty">Department goals have not been established yet.</div>';
    return departments.map(department => {
      const rawStatus = clean(department.status || 'Needs Definition');
      const cls = /on track/i.test(rawStatus) ? 'on' : /watch/i.test(rawStatus) ? 'watch' : /off track/i.test(rawStatus) ? 'off' : 'unset';
      return `<div class="live-department-row">
        <div><strong>${esc(department.name)}</strong><span>${esc(department.owner || 'Owner not set')}</span></div>
        <div><span>${esc(department.goal || department.suggestion?.goal || 'Goal not defined')}</span></div>
        <span class="live-status ${cls}">${esc(rawStatus)}</span>
      </div>`;
    }).join('');
  }

  function balancedScorecard() {
    return `<div class="live-balanced-grid">
      ${['Focus 1','Focus 2','Focus 3','Focus 4'].map(label => `<article>
        <span>${label}</span><strong>Not configured</strong><small>Title + Priority / Metric</small>
      </article>`).join('')}
    </div>`;
  }

  function periodOptions() {
    if (state.timeframe === 'Annual') return ['YTD'];
    if (state.timeframe === 'Quarterly') return ['Q1','Q2','Q3','Q4'];
    if (state.timeframe === 'Monthly') {
      return ['January','February','March','April','May','June','July','August','September','October','November','December'];
    }
    const weeks = [];
    const date = new Date(Number(state.year), 0, 1);
    let current = weekStart(date);
    for (let i=0; i<54 && current.getFullYear() <= Number(state.year); i++) {
      if (current.getFullYear() === Number(state.year)) weeks.push(weekLabel(current));
      current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7);
    }
    return weeks;
  }

  function weekStart(date) {
    const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    return copy;
  }

  function weekLabel(date) {
    return `Week of ${date.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`;
  }

  function periodContext() {
    return `${state.year} · ${state.timeframe} · ${state.period}`;
  }

  function render() {
    const root = pageWrap();
    if (!root) return;
    const agency = state.goals?.account?.agencyName || currentAccount()?.agency_name || currentAccount()?.agencyName || 'Agency';
    document.querySelector('.workspace-name')?.replaceChildren(document.createTextNode(agency));

    root.innerHTML = `
      <section class="live-dashboard">
        <header class="live-dashboard-head">
          <div>
            <span class="live-eyebrow">Monitor</span>
            <h1>Agency Dashboard</h1>
            <p>Executive scan of agency goals, performance, accounts and department health for ${esc(agency)}.</p>
          </div>
          <div class="live-period-summary"><span>Viewing</span><strong>${esc(periodContext())}</strong></div>
        </header>

        <section class="live-timebar" aria-label="Dashboard timeframe">
          <label>Year<select id="monitorYear">${yearOptions()}</select></label>
          <label>Timeframe<select id="monitorTimeframe">
            ${['Annual','Quarterly','Monthly','Weekly'].map(value => `<option ${value===state.timeframe?'selected':''}>${value}</option>`).join('')}
          </select></label>
          <label>Period<select id="monitorPeriod">
            ${periodOptions().map(value => `<option ${value===state.period?'selected':''}>${esc(value)}</option>`).join('')}
          </select></label>
          <div class="live-compare"><span>Compare</span>
            <button class="${state.compare==='Period'?'active':''}" data-compare="Period">Period</button>
            <button class="${state.compare==='YoY'?'active':''}" data-compare="YoY">YoY</button>
          </div>
        </section>

        <section class="live-section">
          <div class="live-section-head">
            <div><span class="live-section-label">Agency Goals</span><h2>Top-level goals</h2></div>
            <a href="/agency-goals/" class="live-link">Manage Agency Goals →</a>
          </div>
          <div class="live-table-card">
            <table class="live-goals-table"><thead><tr><th>Goal</th><th>Actual</th><th>Target</th><th>Status</th></tr></thead>
              <tbody>${goalRows() || '<tr><td colspan="4">No agency goals available.</td></tr>'}</tbody>
            </table>
          </div>
        </section>

        <section class="live-section">
          <div class="live-section-head"><div><span class="live-section-label">Balanced Scorecard</span><h2>Four areas of executive focus</h2></div><span class="live-nice">Nice to have · configuration coming next</span></div>
          ${balancedScorecard()}
        </section>

        <section class="live-section">
          <div class="live-section-head">
            <div><span class="live-section-label">Agency Performance</span><h2>KPIs</h2></div>
            <span class="live-source-note">Missing connected data stays blank—no demo values.</span>
          </div>
          <div class="live-kpi-grid">${dashboardMetrics.map(metricCard).join('')}</div>
        </section>

        <section class="live-section">
          <div class="live-section-head"><div><span class="live-section-label">All Accounts</span><h2>Client account performance</h2></div><span class="live-source-note">${esc(periodContext())}</span></div>
          <div class="live-account-grid">${accountMetricCards()}</div>
        </section>

        <section class="live-section">
          <div class="live-section-head">
            <div><span class="live-section-label">Department Performance</span><h2>Major KPI / goal status</h2></div>
            <a href="/agency-goals/" class="live-link">Update departmental goals →</a>
          </div>
          <div class="live-department-card">
            <div class="live-department-header"><span>Department</span><span>Metric / Goal</span><span>Status</span></div>
            ${departmentRows()}
          </div>
        </section>
      </section>`;

    bindControls();
  }

  function yearOptions() {
    const current = new Date().getFullYear();
    const years = [];
    for (let year = current - 3; year <= current + 1; year++) years.push(year);
    return years.map(year => `<option value="${year}" ${Number(state.year)===year?'selected':''}>${year}</option>`).join('');
  }

  function bindControls() {
    document.querySelector('#monitorYear')?.addEventListener('change', event => {
      state.year = Number(event.target.value);
      normalizePeriod();
      render();
    });
    document.querySelector('#monitorTimeframe')?.addEventListener('change', event => {
      state.timeframe = event.target.value;
      normalizePeriod();
      render();
    });
    document.querySelector('#monitorPeriod')?.addEventListener('change', event => {
      state.period = event.target.value;
      render();
    });
    document.querySelectorAll('[data-compare]').forEach(button => {
      button.addEventListener('click', () => {
        state.compare = button.dataset.compare;
        render();
      });
    });
  }

  function normalizePeriod() {
    const options = periodOptions();
    if (!options.includes(state.period)) {
      if (state.timeframe === 'Quarterly') {
        const quarter = Math.floor(new Date().getMonth() / 3) + 1;
        state.period = `Q${quarter}`;
      } else if (state.timeframe === 'Monthly') {
        state.period = new Date().toLocaleString('en-US',{month:'long'});
      } else if (state.timeframe === 'Weekly') {
        state.period = weekLabel(weekStart(new Date()));
      } else {
        state.period = options[0] || 'YTD';
      }
    }
  }

  function renderLoading() {
    const root = pageWrap();
    if (!root) return;
    root.innerHTML = `<section class="live-dashboard">
      <header class="live-dashboard-head"><div><span class="live-eyebrow">Monitor</span><h1>Agency Dashboard</h1><p>Loading live agency data…</p></div></header>
      <div class="live-loading-grid">${Array.from({length:8},()=>'<span></span>').join('')}</div>
    </section>`;
  }

  function renderError(error) {
    const root = pageWrap();
    if (!root) return;
    root.innerHTML = `<section class="live-dashboard">
      <header class="live-dashboard-head"><div><span class="live-eyebrow">Monitor</span><h1>Agency Dashboard</h1><p>The Monitor dashboard could not load its account data.</p></div></header>
      <div class="live-error"><strong>${esc(error?.message || 'Monitor data unavailable.')}</strong><span>No fallback or demo values were inserted.</span><button id="monitorRetry">Retry</button></div>
    </section>`;
    document.querySelector('#monitorRetry')?.addEventListener('click', load);
  }

  async function load() {
    renderLoading();
    try {
      const query = queryString();
      if (!query) throw new Error('Sign in to load Monitor.');
      const [goalsPayload, evidencePayload] = await Promise.all([
        jsonRequest(`/api/goals?${query}`),
        jsonRequest(`/api/financial-evidence?${query}`).catch(error => ({ evidence: [], _error: error }))
      ]);
      state.goals = goalsPayload.goals || null;
      state.evidence = evidenceMap(evidencePayload);
      normalizePeriod();
      render();
    } catch (error) {
      console.error('Monitor live dashboard failed.', error);
      renderError(error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(load, 0), { once:true });
  } else {
    setTimeout(load, 0);
  }
})();
