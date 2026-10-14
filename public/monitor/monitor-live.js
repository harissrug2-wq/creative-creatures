(() => {
  if ((document.body?.dataset?.page || '') !== 'platform') return;

  const root = () => document.querySelector('.page-wrap');
  const clean = value => String(value ?? '').trim();
  const finite = value => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  const money = value => {
    const n = finite(value);
    return n === null ? '—' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
  };
  const percent = value => {
    const n = finite(value);
    return n === null ? '—' : `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
  };
  const number = value => {
    const n = finite(value);
    return n === null ? '—' : new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(n);
  };

  const state = {
    goals:null,
    evidence:new Map(),
    year:new Date().getFullYear(),
    timeframe:'Annual',
    period:'YTD',
    compare:'YoY'
  };

  function evidenceMap(payload) {
    const map = new Map();
    (Array.isArray(payload?.evidence) ? payload.evidence : []).forEach(row => {
      const current = map.get(row.evidence_type);
      const a = new Date(current?.updated_at || current?.created_at || 0).getTime();
      const b = new Date(row?.updated_at || row?.created_at || 0).getTime();
      if (!current || b >= a) map.set(row.evidence_type,row);
    });
    return map;
  }

  function metricMap() {
    return Object.fromEntries((Array.isArray(state.goals?.metrics) ? state.goals.metrics : []).map(row => [row.id,row]));
  }
  function targets() {
    return state.goals?.targets && typeof state.goals.targets === 'object' ? state.goals.targets : {};
  }
  function formatMetric(metric,value) {
    if (metric?.unit === '$') return money(value);
    if (metric?.unit === '%') return percent(value);
    return number(value);
  }
  function targetValue(target) {
    return finite(target?.resolvedValue ?? target?.resolved_target_value ?? target?.targetValue ?? target?.target_value);
  }

  function statusFor(metric,target) {
    const actual = finite(metric?.actualValue);
    const goal = targetValue(target);
    if (goal === null) return {label:'No Goal Set',cls:'unset'};
    if (actual === null) return {label:'No Data',cls:'unset'};
    const decrease = ['ownerDelivery','ownerSales','cogs'].includes(metric.id);
    if ((decrease && actual <= goal) || (!decrease && actual >= goal)) return {label:'On Pace',cls:'on'};
    const gap = Math.abs(actual-goal) / Math.max(Math.abs(goal),1) * 100;
    return gap <= 10 ? {label:'Watch',cls:'watch'} : {label:'Off Pace',cls:'off'};
  }

  function periodOptions() {
    if (state.timeframe === 'Annual') return ['YTD'];
    if (state.timeframe === 'Quarterly') return ['Q1','Q2','Q3','Q4'];
    if (state.timeframe === 'Monthly') return ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const weeks=[];
    const start=new Date(state.year,0,1);
    for(let i=0;i<52;i++){
      const d=new Date(start); d.setDate(start.getDate()+i*7);
      if(d.getFullYear()!==state.year) break;
      weeks.push(`Week of ${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`);
    }
    return weeks;
  }
  function normalizePeriod() {
    const options=periodOptions();
    if(options.includes(state.period)) return;
    if(state.timeframe==='Quarterly') state.period=`Q${Math.floor(new Date().getMonth()/3)+1}`;
    else if(state.timeframe==='Monthly') state.period=new Date().toLocaleString('en-US',{month:'long'});
    else state.period=options[0] || 'YTD';
  }

  function goalRows() {
    const metrics = metricMap();
    const ordered=['revenue','cogs','margin','sde','aofi','valuation','ownerDelivery','ownerSales','leadership']
      .map(id=>metrics[id]).filter(Boolean);
    if (!ordered.length) return '<tr><td colspan="4">No agency goals available yet.</td></tr>';
    return ordered.map(metric => {
      const target=targets()[metric.id];
      const status=statusFor(metric,target);
      return `<tr>
        <td data-label="Goal"><strong>${esc(metric.label)}</strong><span>${esc(metric.group||'')}</span></td>
        <td data-label="Actual">${esc(metric.actualDisplay || formatMetric(metric,metric.actualValue))}</td>
        <td data-label="Target">${targetValue(target)===null?'No Goal Set':esc(formatMetric(metric,targetValue(target)))}</td>
        <td data-label="Status"><span class="live-status ${status.cls}">${esc(status.label)}</span></td>
      </tr>`;
    }).join('');
  }

  function dashboardCards() {
    const metrics=metricMap();
    const definitions=[
      ['revenue','Gross Revenue'],
      ['cogs','COGS %'],
      ['margin','Net Margin'],
      ['sde','SDE'],
      ['aofi','AOFI™ Score'],
      ['valuation','Enterprise Value']
    ];
    return definitions.map(([id,label])=>{
      const metric=metrics[id];
      const target=targets()[id];
      const status=statusFor(metric||{id,actualValue:null},target);
      const value=metric ? (metric.actualDisplay || formatMetric(metric,metric.actualValue)) : '—';
      return `<article class="live-kpi-card ${!metric || finite(metric.actualValue)===null?'is-empty':''}">
        <div class="live-kpi-head"><span>${esc(label)}</span><span class="live-status ${status.cls}">${esc(status.label)}</span></div>
        <strong>${esc(value)}</strong>
        <div class="live-kpi-meta"><span>Goal <b>${targetValue(target)===null?'No Goal Set':esc(formatMetric(metric,targetValue(target)))}</b></span><span>${esc(metric?.source||'Generated Scorecard / Agency Goals')}</span></div>
      </article>`;
    }).join('');
  }

  function departmentRows() {
    const rows=Array.isArray(state.goals?.departments)?state.goals.departments:[];
    if(!rows.length) return '<div class="live-empty">Department goals have not been established yet.</div>';
    return rows.map(row=>{
      const raw=clean(row.status||'Needs Definition');
      const cls=/on track/i.test(raw)?'on':/watch/i.test(raw)?'watch':/off track/i.test(raw)?'off':'unset';
      return `<div class="live-department-row">
        <div><strong>${esc(row.name)}</strong><span>${esc(row.owner||'Owner not set')}</span></div>
        <div><span>${esc(row.goal||row.suggestion?.goal||'Goal not defined')}</span></div>
        <span class="live-status ${cls}">${esc(raw)}</span>
      </div>`;
    }).join('');
  }

  function evidenceCards() {
    const pnl=state.evidence.get('profit_loss')?.extracted_data || {};
    const balance=state.evidence.get('balance_sheet')?.extracted_data || {};
    const mix=state.evidence.get('service_revenue_mix')?.extracted_data || {};
    const rows=[
      ['Recurring Revenue',money(mix.recurringRevenue),'Service Revenue Mix'],
      ['Project Revenue',money(mix.projectRevenue),'Service Revenue Mix'],
      ['Net Income',money(pnl.netIncomeTTM),'Profit & Loss'],
      ['Cash on Hand',money(balance.cash),'Balance Sheet']
    ];
    return rows.map(([label,value,source])=>`<article class="live-account-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(source)}</small></article>`).join('');
  }

  function render() {
    const node=root(); if(!node) return;
    const agency=state.goals?.account?.agencyName || 'Agency';
    document.querySelector('.workspace-name')?.replaceChildren(document.createTextNode(agency));
    node.innerHTML=`
      <section class="live-dashboard">
        <header class="live-dashboard-head">
          <div><span class="live-eyebrow">Monitor</span><h1>Agency Dashboard</h1><p>Executive scan of agency goals, performance, accounts and department health for ${esc(agency)}.</p></div>
          <div class="live-period-summary"><span>Viewing</span><strong>${esc(`${state.year} · ${state.timeframe} · ${state.period}`)}</strong></div>
        </header>

        <section class="live-timebar" aria-label="Dashboard timeframe">
          <label>Year<select id="monitorYear">${[state.year-2,state.year-1,state.year,state.year+1].map(y=>`<option value="${y}" ${y===state.year?'selected':''}>${y}</option>`).join('')}</select></label>
          <label>Timeframe<select id="monitorTimeframe">${['Annual','Quarterly','Monthly','Weekly'].map(v=>`<option ${v===state.timeframe?'selected':''}>${v}</option>`).join('')}</select></label>
          <label>Period<select id="monitorPeriod">${periodOptions().map(v=>`<option ${v===state.period?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
          <div class="live-compare"><span>Compare</span><button class="${state.compare==='Period'?'active':''}" data-compare="Period">Period</button><button class="${state.compare==='YoY'?'active':''}" data-compare="YoY">YoY</button></div>
        </section>

        <section class="live-section">
          <div class="live-section-head"><div><span class="live-section-label">Agency Goals</span><h2>Top-level goals</h2></div><a href="/agency-goals/" class="live-link">Manage Agency Goals →</a></div>
          <div class="live-table-card"><table class="live-goals-table"><thead><tr><th>Goal</th><th>Actual</th><th>Target</th><th>Status</th></tr></thead><tbody>${goalRows()}</tbody></table></div>
        </section>

        <section class="live-section">
          <div class="live-section-head"><div><span class="live-section-label">Agency Performance</span><h2>KPIs</h2></div><span class="live-source-note">Missing connected data stays blank—no demo values.</span></div>
          <div class="live-kpi-grid">${dashboardCards()}</div>
        </section>

        <section class="live-section">
          <div class="live-section-head"><div><span class="live-section-label">Financial Evidence</span><h2>Connected data</h2></div><a href="/integrations/" class="live-link">Manage Integrations →</a></div>
          <div class="live-account-grid">${evidenceCards()}</div>
        </section>

        <section class="live-section">
          <div class="live-section-head"><div><span class="live-section-label">Department Performance</span><h2>Goals and status</h2></div><a href="/agency-goals/" class="live-link">Update departmental goals →</a></div>
          <div class="live-department-card"><div class="live-department-header"><span>Department</span><span>Metric / Goal</span><span>Status</span></div>${departmentRows()}</div>
        </section>
      </section>`;
    bind();
  }

  function bind(){
    document.querySelector('#monitorYear')?.addEventListener('change',e=>{state.year=Number(e.target.value);normalizePeriod();render();});
    document.querySelector('#monitorTimeframe')?.addEventListener('change',e=>{state.timeframe=e.target.value;normalizePeriod();render();});
    document.querySelector('#monitorPeriod')?.addEventListener('change',e=>{state.period=e.target.value;render();});
    document.querySelectorAll('[data-compare]').forEach(button=>button.addEventListener('click',()=>{state.compare=button.dataset.compare;render();}));
  }

  function loading(){
    const node=root(); if(!node) return;
    node.innerHTML='<section class="live-dashboard"><header class="live-dashboard-head"><div><span class="live-eyebrow">Monitor</span><h1>Agency Dashboard</h1><p>Loading agency data…</p></div></header><div class="live-loading-grid">'+Array.from({length:8},()=>'<span></span>').join('')+'</div></section>';
  }
  function failure(error){
    const node=root(); if(!node) return;
    node.innerHTML=`<section class="live-dashboard"><header class="live-dashboard-head"><div><span class="live-eyebrow">Monitor</span><h1>Agency Dashboard</h1><p>The Monitor dashboard could not load its account data.</p></div></header><div class="live-error"><strong>${esc(error?.message||'Monitor data unavailable.')}</strong><span>No demo values were inserted.</span><button id="monitorRetry">Retry</button></div></section>`;
    document.querySelector('#monitorRetry')?.addEventListener('click',load);
  }

  async function load(){
    loading();
    try{
      try{await window.CCAccount?.ready}catch{}
      if(!window.CCGoals?.load) throw new Error('Agency Goals client did not initialize.');
      state.goals=await window.CCGoals.load({fresh:true});
      try{
        const response=await fetch('/api/financial-evidence',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
        if(response.ok) state.evidence=evidenceMap(await response.json().catch(()=>({})));
      }catch(error){console.warn('Financial evidence unavailable for Monitor.',error);}
      normalizePeriod();
      render();
    }catch(error){
      console.error('Monitor load failed.',error);
      failure(error);
    }
  }

  load();
})();