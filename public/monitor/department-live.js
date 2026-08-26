(() => {
  const page = document.body?.dataset?.page || '';
  const configs = {
    marketing:{title:'Marketing',subtitle:'Contacts, lifecycle movement, and top-of-funnel activity.',source:'CRM'},
    sales:{title:'Sales',subtitle:'Deal pipeline, closed revenue, and conversion activity.',source:'CRM'},
    billing:{title:'Billing',subtitle:'Active accounts, client revenue, and accounts receivable.',source:'Accounting'},
    onboarding:{title:'Onboarding',subtitle:'Connected project-management workload for new-client delivery.',source:'Project management'},
    'service-delivery':{title:'Service Delivery',subtitle:'Projects, task throughput, overdue work, and tracked time.',source:'Project management'},
    'client-success':{title:'Client Success',subtitle:'Client portfolio, concentration, tenure, and account coverage.',source:'Client revenue'},
    'talent-acquisition':{title:'Talent Acquisition',subtitle:'Hiring, reviews, development plans, and team health.',source:'Payroll / HR'},
    finance:{title:'Finance',subtitle:'Revenue, margins, cash, and revenue mix.',source:'Accounting'},
    communication:{title:'Communication',subtitle:'Connected workspace coverage without reading message content.',source:'Communications'},
    systems:{title:'Systems / IT',subtitle:'Connected systems, sync status, and integration coverage.',source:'Internal'},
    sops:{title:'SOPs',subtitle:'Selected process documents and folders from the agency Drive.',source:'Drive'}
  };
  const config = configs[page];
  if (!config) return;

  const root = () => document.querySelector('.page-wrap');
  const clean = value => String(value ?? '').trim();
  const finite = value => {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[character]));
  const array = value => Array.isArray(value) ? value : [];
  const object = value => value && typeof value === 'object' ? value : {};

  const state = {
    payload:null,
    year:new Date().getFullYear(),
    timeframe:'Annual',
    period:'YTD',
    compare:'YoY'
  };

  function parseDate(value) {
    if (!value) return null;
    const raw = String(value);
    const date = /^\d{11,}$/.test(raw) ? new Date(Number(raw)) : new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function weekStart(date) {
    const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = copy.getDay();
    copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
    return copy;
  }

  function weekLabel(date) {
    return `Week of ${date.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`;
  }

  function periodOptions() {
    if (state.timeframe === 'Annual') return ['YTD'];
    if (state.timeframe === 'Quarterly') return ['Q1','Q2','Q3','Q4'];
    if (state.timeframe === 'Monthly') return ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const weeks=[];
    let current=weekStart(new Date(Number(state.year),0,1));
    for(let index=0;index<54&&current.getFullYear()<=Number(state.year);index++){
      if(current.getFullYear()===Number(state.year))weeks.push(weekLabel(current));
      current=new Date(current.getFullYear(),current.getMonth(),current.getDate()+7);
    }
    return weeks;
  }

  function normalizePeriod() {
    const options=periodOptions();
    if(options.includes(state.period))return;
    if(state.timeframe==='Quarterly')state.period=`Q${Math.floor(new Date().getMonth()/3)+1}`;
    else if(state.timeframe==='Monthly')state.period=new Date().toLocaleString('en-US',{month:'long'});
    else if(state.timeframe==='Weekly')state.period=weekLabel(weekStart(new Date()));
    else state.period=options[0]||'YTD';
  }

  function inPeriod(value) {
    const date=parseDate(value);
    if(!date||date.getFullYear()!==Number(state.year))return false;
    if(state.timeframe==='Annual')return true;
    if(state.timeframe==='Quarterly')return `Q${Math.floor(date.getMonth()/3)+1}`===state.period;
    if(state.timeframe==='Monthly')return date.toLocaleString('en-US',{month:'long'})===state.period;
    if(state.timeframe==='Weekly')return weekLabel(weekStart(date))===state.period;
    return true;
  }

  function money(value) {
    const number=finite(value);
    return number===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(number);
  }

  function number(value) {
    const numeric=finite(value);
    return numeric===null?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(numeric);
  }

  function percent(value) {
    const numeric=finite(value);
    return numeric===null?'—':`${Number.isInteger(numeric)?numeric:numeric.toFixed(1)}%`;
  }

  function format(value,type='number') {
    if(type==='money')return money(value);
    if(type==='percent')return percent(value);
    if(type==='hours')return finite(value)===null?'—':`${number(value)}h`;
    return number(value);
  }

  function latestEvidence(type) {
    return array(state.payload?.evidence).find(row=>row.type===type)?.data||{};
  }

  function sourceData() {
    return object(state.payload?.source?.data);
  }

  function metric(label,value,type,source) {
    return{label,value:finite(value),type,source:source||state.payload?.source?.name||'No connected source'};
  }

  function metricCards(metrics) {
    return metrics.map(item=>`<article class="department-metric ${item.value===null?'is-empty':''}">
      <span>${esc(item.label)}</span><strong>${format(item.value,item.type)}</strong>
      <small>${esc(item.value===null?'No Data / '+item.source:item.source)}</small>
    </article>`).join('');
  }

  function stageMaps() {
    const map=new Map();
    array(sourceData().pipelines).forEach(pipeline=>array(pipeline.stages).forEach(stage=>map.set(stage.id,{...stage,pipelineLabel:pipeline.label||pipeline.id})));
    return map;
  }

  function marketingModel() {
    const contacts=array(sourceData().contacts);
    const companies=array(sourceData().companies);
    const connected=state.payload?.source?.connected===true;
    const crm=state.payload?.source?.name||'CRM';
    const newContacts=contacts.filter(item=>inPeriod(item.properties?.createdate||item.createdAt));
    const lifecycle=value=>clean(value).toLowerCase();
    const hasLifecycle=contacts.some(item=>clean(item.properties?.lifecyclestage));
    const mql=hasLifecycle?contacts.filter(item=>lifecycle(item.properties?.lifecyclestage)==='marketingqualifiedlead').length:null;
    const sql=hasLifecycle?contacts.filter(item=>lifecycle(item.properties?.lifecyclestage)==='salesqualifiedlead').length:null;
    const stages=new Map();
    contacts.filter(item=>clean(item.properties?.lifecyclestage)).forEach(item=>{const label=clean(item.properties?.lifecyclestage);stages.set(label,(stages.get(label)||0)+1)});
    return{
      metrics:[metric('Contacts loaded',connected?contacts.length:null,'number',crm),metric('New contacts in period',connected?newContacts.length:null,'number',`${crm} contact create date`),metric('Marketing qualified leads',connected?mql:null,'number',hasLifecycle?`${crm} lifecycle stage`:`${crm} does not expose a contact lifecycle stage`),metric('Sales qualified leads',connected?sql:null,'number',hasLifecycle?`${crm} lifecycle stage`:`${crm} does not expose a contact lifecycle stage`)],
      title:'Lifecycle distribution',
      rows:[...stages.entries()].map(([label,value])=>({title:label,meta:`${crm} lifecycle stage`,value:number(value)})),
      note:`${companies.length} accounts are loaded from this agency’s connected ${crm} organization. Lifecycle metrics remain No Data when the CRM does not expose that field.`
    };
  }

  function salesModel() {
    const deals=array(sourceData().deals);
    const connected=state.payload?.source?.connected===true;
    const crm=state.payload?.source?.name||'CRM';
    const stages=stageMaps();
    const periodDeals=deals.filter(item=>inPeriod(item.properties?.createdate||item.createdAt));
    const amount=item=>finite(item.properties?.amount)||0;
    const stage=item=>stages.get(item.properties?.dealstage)||{};
    const closed=deals.filter(item=>stage(item).metadata?.isClosed==='true'||stage(item).metadata?.isClosed===true||/closed/i.test(stage(item).label||''));
    const won=closed.filter(item=>Number(stage(item).metadata?.probability)===1||/won/i.test(stage(item).label||''));
    const pipelineValue=deals.reduce((sum,item)=>sum+amount(item),0);
    const wonValue=won.reduce((sum,item)=>sum+amount(item),0);
    return{
      metrics:[metric('Pipeline value',connected?pipelineValue:null,'money',`${crm} loaded deals`),metric('New deals in period',connected?periodDeals.length:null,'number',`${crm} deal create date`),metric('Closed-won value',connected?wonValue:null,'money',`${crm} deal stage`),metric('Loaded-deal close rate',connected&&closed.length?(won.length/closed.length)*100:null,'percent','Closed-won ÷ closed deals')],
      title:'Recent deals',
      rows:deals.slice().sort((a,b)=>(parseDate(b.updatedAt)?.getTime()||0)-(parseDate(a.updatedAt)?.getTime()||0)).slice(0,12).map(item=>({title:item.properties?.dealname||'Unnamed deal',meta:stage(item).label||'Stage not set',value:money(amount(item))})),
      note:`Close rate uses only the deals returned by ${crm} in the active CRM connection.`
    };
  }

  function billingModel() {
    const clients=latestEvidence('client_revenue');
    const ar=latestEvidence('ar_aging');
    const clientCount=finite(clients.clientCount)??(Array.isArray(clients.clients)?clients.clients.length:null);
    const over30=[ar.days31to60,ar.days61to90,ar.days90Plus].map(finite).filter(value=>value!==null).reduce((sum,value)=>sum+value,0);
    const hasOver30=[ar.days31to60,ar.days61to90,ar.days90Plus].some(value=>finite(value)!==null);
    return{
      metrics:[metric('Active accounts',clientCount,'number','Client Revenue evidence'),metric('Average client revenue',clients.averageClientRevenue,'money','Client Revenue evidence'),metric('A/R total',ar.totalAR,'money','A/R Aging evidence'),metric('A/R 30+ days',hasOver30?over30:null,'money','A/R Aging evidence')],
      title:'A/R aging',
      rows:[['Current',ar.currentAR],['1–30 days',ar.days1to30],['31–60 days',ar.days31to60],['61–90 days',ar.days61to90],['90+ days',ar.days90Plus]].map(([title,value])=>({title,meta:'Accounts receivable',value:money(value)})),
      note:'Financial cards use the latest available evidence snapshot; they do not infer missing historical periods.'
    };
  }

  function normalizePm() {
    const data=sourceData();
    const source=state.payload?.source?.name||'Project management';
    if(source==='ClickUp')return{source,projects:array(data.spaces),tasks:array(data.tasks).map(item=>({...item,completed:item.statusType==='closed'||/complete|closed/i.test(item.status),date:item.dateCreated||item.dateUpdated,due:item.dueDate,trackedMs:finite(item.timeSpent)||0}))};
    if(source==='Teamwork')return{source,projects:array(data.projects),tasks:array(data.tasks).map(item=>({...item,completed:Boolean(item.completed)||/complete|closed/i.test(item.status),date:item.updatedAt||item.startDate||item.dueDate,due:item.dueDate,trackedMinutes:0})),timeEntries:array(data.timeEntries)};
    if(source==='monday.com')return{source,projects:array(data.boards),tasks:array(data.items).map(item=>{const status=array(item.columns).find(column=>/status/i.test(column.title))?.text||'';const due=array(item.columns).find(column=>/due|date/i.test(column.title))?.text||null;return{...item,status,completed:/complete|done|closed/i.test(status),date:item.createdAt||item.updatedAt,due}})};
    return{source,projects:[],tasks:[],timeEntries:[]};
  }

  function pmModel(mode) {
    const pm=normalizePm();
    const connected=state.payload?.source?.connected===true;
    const tasks=pm.tasks;
    const open=tasks.filter(item=>!item.completed);
    const overdue=open.filter(item=>{const due=parseDate(item.due);return due&&due.getTime()<Date.now()});
    const completed=tasks.filter(item=>item.completed);
    const period=tasks.filter(item=>inPeriod(item.date||item.due));
    const trackedHours=pm.source==='Teamwork'?array(pm.timeEntries).reduce((sum,item)=>sum+(finite(item.minutes)||0),0)/60:tasks.reduce((sum,item)=>sum+(finite(item.trackedMs)||0),0)/3600000;
    const metrics=mode==='onboarding'
      ?[metric('Projects / boards loaded',connected?pm.projects.length:null,'number',pm.source),metric('Work items in period',connected?period.length:null,'number',pm.source),metric('Open work items',connected?open.length:null,'number',pm.source),metric('Overdue work items',connected?overdue.length:null,'number',pm.source)]
      :[metric('Projects / spaces loaded',connected?pm.projects.length:null,'number',pm.source),metric('Open tasks',connected?open.length:null,'number',pm.source),metric('Completion rate',connected&&tasks.length?(completed.length/tasks.length)*100:null,'percent',pm.source),metric('Tracked hours loaded',connected?trackedHours:null,'hours',pm.source)];
    return{
      metrics,title:'Connected work items',
      rows:tasks.slice(0,16).map(item=>({title:item.name||'Work item',meta:[item.status||'No status',item.projectName||item.boardName||item.listName||''].filter(Boolean).join(' · '),value:item.due?`Due ${parseDate(item.due)?.toLocaleDateString()||item.due}`:''})),
      note:mode==='onboarding'?'These are connected PM records. Configure an onboarding-specific board, project, or list before treating them as the onboarding pipeline.':'Service Delivery summarizes the connected PM workload and does not invent utilization without time-capacity data.'
    };
  }

  function clientSuccessModel() {
    const clients=latestEvidence('client_revenue');
    const rows=array(clients.clients);
    const clientCount=finite(clients.clientCount)??(rows.length||null);
    if(clientCount!==null)return{
      metrics:[metric('Active accounts',clientCount,'number','Client Revenue evidence'),metric('Average client revenue',clients.averageClientRevenue,'money','Client Revenue evidence'),metric('Average tenure',clients.averageClientTenureMonths,'number','Client Revenue evidence · months'),metric('Top client share',clients.topClientPercent,'percent','Client Revenue evidence')],
      title:'Client revenue roster',rows:rows.slice(0,16).map(item=>({title:item.name||item.clientName||'Client',meta:item.service||item.status||'',value:money(item.revenue||item.amount)})),
      note:'NPS, churn, and sentiment remain No Data until a connected client-success source provides them.'
    };
    const companies=array(sourceData().companies),contacts=array(sourceData().contacts);
    const connected=state.payload?.source?.connected===true;
    const crm=state.payload?.source?.name||'CRM',hasLifecycle=contacts.some(item=>clean(item.properties?.lifecyclestage));
    return{metrics:[metric('Accounts loaded',connected?companies.length:null,'number',crm),metric('Customer contacts',connected&&hasLifecycle?contacts.filter(item=>clean(item.properties?.lifecyclestage).toLowerCase()==='customer').length:null,'number',hasLifecycle?`${crm} lifecycle stage`:`${crm} does not expose a contact lifecycle stage`),metric('Account churn',null,'percent','No connected churn source'),metric('NPS',null,'number','No connected NPS source')],title:'Accounts',rows:companies.slice(0,16).map(item=>({title:item.properties?.name||'Unnamed account',meta:item.properties?.domain||'',value:item.properties?.industry||''})),note:`${crm} account data is a roster fallback; it is not treated as client-health or sentiment data.`};
  }

  function financeModel() {
    const pnl=latestEvidence('profit_loss'),balance=latestEvidence('balance_sheet'),ar=latestEvidence('ar_aging'),service=latestEvidence('service_revenue_mix');
    const net=finite(pnl.netIncomeTTM)??finite(pnl.netIncomeYTD);
    const revenue=finite(pnl.revenueTTM)??finite(pnl.revenueYTD);
    const margin=finite(pnl.netProfitMarginPercent)??(net!==null&&revenue?net/revenue*100:null);
    const accountsReceivable=finite(ar.totalAR)??finite(balance.accountsReceivable);
    return{
      metrics:[metric('Revenue',revenue,'money','Profit & Loss evidence'),metric('Net profit',net,'money','Profit & Loss evidence'),metric('Net profit margin',margin,'percent','Profit & Loss evidence'),metric('Cash on hand',balance.cash,'money','Balance Sheet evidence')],
      title:'Financial detail',
      rows:[['Gross profit',pnl.grossProfitTTM],['Operating expenses',pnl.operatingExpensesTTM],['Accounts receivable',accountsReceivable],['Current liabilities',balance.currentLiabilities],['Recurring revenue',service.recurringRevenue],['Project revenue',service.projectRevenue]].map(([title,value])=>({title,meta:'Latest available evidence',value:money(value)})),
      note:'Financial cards use the latest synced or uploaded evidence. Missing fields remain blank.'
    };
  }

  function communicationModel() {
    const users=array(sourceData().users),channels=array(sourceData().channels),active=users.filter(item=>!item.deleted&&!item.isBot);
    const connected=state.payload?.source?.connected===true;
    return{
      metrics:[metric('Active people loaded',connected?active.length:null,'number','Slack users scope'),metric('Channels visible',connected?channels.length:null,'number','Slack conversations scope'),metric('Public channels',connected?channels.filter(item=>!item.isPrivate).length:null,'number','Slack conversations scope'),metric('Private channels accessible',connected?channels.filter(item=>item.isPrivate).length:null,'number','Slack conversations scope')],
      title:'Visible channels',rows:channels.slice(0,16).map(item=>({title:`# ${item.name||'channel'}`,meta:item.purpose||item.topic||'',value:item.numMembers?`${item.numMembers} members`:item.isPrivate?'Private':'Public'})),
      note:'Creative Creatures does not request or read Slack message history, so message volume and sentiment remain No Data.'
    };
  }

  function systemsModel() {
    const connections=array(sourceData().connections),connected=connections.filter(item=>item.connected),errors=connections.filter(item=>item.error||item.lastSyncError||item.lastError);
    return{
      metrics:[metric('Systems checked',connections.length,'number','Account-scoped connection registry'),metric('Connected systems',connected.length,'number','Account-scoped connection registry'),metric('Disconnected systems',connections.length-connected.length,'number','Account-scoped connection registry'),metric('Connections needing attention',errors.length,'number','Connection status')],
      title:'Integration inventory',rows:connections.map(item=>({title:item.name,meta:item.connected?'Connected':'Not connected',value:item.lastSyncedAt?`Synced ${new Date(item.lastSyncedAt).toLocaleString()}`:(item.lastRefreshedAt?'Refreshed '+new Date(item.lastRefreshedAt).toLocaleString():'')})),
      note:'This inventory includes only integrations with production connection storage in Creative Creatures.'
    };
  }

  function sopsModel() {
    const items=array(sourceData().items),folders=items.filter(item=>item.isFolder),documents=items.filter(item=>!item.isFolder);
    const connected=state.payload?.source?.connected===true;
    const modified=items.map(item=>parseDate(item.modifiedTime)).filter(Boolean).sort((a,b)=>b-a)[0]||null;
    return{
      metrics:[metric('Selected SOP sources',connected?items.length:null,'number','Google Drive selection'),metric('Selected folders',connected?folders.length:null,'number','Google Drive selection'),metric('Selected documents',connected?documents.length:null,'number','Google Drive selection'),metric('Recently modified (days)',connected&&modified?Math.max(0,Math.floor((Date.now()-modified.getTime())/86400000)):null,'number','Google Drive modified time')],
      title:'Selected Drive items',rows:items.slice(0,20).map(item=>({title:item.name||'Untitled',meta:item.isFolder?'Folder':item.mimeType||'Document',value:item.modifiedTime?new Date(item.modifiedTime).toLocaleDateString():''})),
      note:'Only files and folders explicitly selected by this agency are shown.'
    };
  }

  function talentModel() {
    return{metrics:[metric('Open requisitions',null,'number','No connected payroll / HR source'),metric('Employee sentiment',null,'number','No connected survey source'),metric('Reviews recorded',null,'number','No connected review source'),metric('Development plans',null,'percent','No connected HR source')],title:'Talent data',rows:[],note:'Connect a payroll or HR source before Talent Acquisition metrics can be reported.'};
  }

  function pageModel() {
    if(page==='marketing')return marketingModel();
    if(page==='sales')return salesModel();
    if(page==='billing')return billingModel();
    if(page==='onboarding')return pmModel('onboarding');
    if(page==='service-delivery')return pmModel('delivery');
    if(page==='client-success')return clientSuccessModel();
    if(page==='talent-acquisition')return talentModel();
    if(page==='finance')return financeModel();
    if(page==='communication')return communicationModel();
    if(page==='systems')return systemsModel();
    return sopsModel();
  }

  function statusClass(status) {
    const value=clean(status).toLowerCase();
    if(value==='on track'||value==='complete'||value==='completed')return'on';
    if(value==='watch')return'watch';
    if(value==='off track')return'off';
    return'unset';
  }

  function goalSection() {
    const goal=state.payload?.goal;
    if(!goal)return`<article class="department-panel department-empty"><span>Department Goal</span><strong>Not Set</strong><p>Create this department’s measurable goal in Agency Goals.</p><a href="/agency-goals/">Open Agency Goals →</a></article>`;
    return`<article class="department-panel"><div class="panel-title"><span>Department Goal</span><span class="department-status ${statusClass(goal.status)}">${esc(goal.status)}</span></div><h3>${esc(goal.goal||'Goal not defined')}</h3><div class="goal-detail"><span>Owner <b>${esc(goal.owner||'Not set')}</b></span><span>Completion <b>${esc(goal.completionDate||goal.completion||'Not set')}</b></span></div>${goal.done?`<p>${esc(goal.done)}</p>`:''}<a href="/agency-goals/">Manage goal →</a></article>`;
  }

  function rocksSection() {
    const rocks=array(state.payload?.rocks).slice(0,8);
    return`<article class="department-panel"><div class="panel-title"><span>Agency Rocks</span><a href="/leadership/">Open Leadership →</a></div>${rocks.length?`<div class="department-rocks">${rocks.map(item=>`<div><strong>${esc(item.title)}</strong><span>${esc([item.owner?`Owner ${item.owner}`:'',item.dueDate?`Due ${item.dueDate}`:item.due,item.status].filter(Boolean).join(' · '))}</span></div>`).join('')}</div>`:'<div class="department-list-empty">No persisted Rocks yet.</div>'}<small class="scope-note">Rocks are shown as agency-wide because the current data model does not assign a Rock to a department.</small></article>`;
  }

  function listSection(model) {
    return`<section class="department-section"><div class="department-section-head"><div><span>Live Detail</span><h2>${esc(model.title)}</h2></div><span>${esc(`${state.year} · ${state.timeframe} · ${state.period}`)}</span></div><div class="department-list">${model.rows.length?model.rows.map(row=>`<article><div><strong>${esc(row.title)}</strong><span>${esc(row.meta||'')}</span></div><b>${esc(row.value||'')}</b></article>`).join(''):'<div class="department-list-empty">No records returned by the connected source.</div>'}</div></section>`;
  }

  function render() {
    const target=root();if(!target)return;
    const model=pageModel();
    const source=state.payload?.source||{};
    document.querySelector('.workspace-name')?.replaceChildren(document.createTextNode(state.payload?.account?.agencyName||'Agency Workspace'));
    target.innerHTML=`<section class="department-live">
      <header class="department-head"><div><span class="department-eyebrow">Monitor · Department</span><h1>${esc(config.title)}</h1><p>${esc(config.subtitle)}</p></div><div class="department-source ${source.connected?'connected':''}"><span></span><div><small>Source</small><strong>${esc(source.connected?source.name:'No connected source')}</strong></div></div></header>
      <section class="department-timebar" aria-label="Department timeframe"><label>Year<select id="departmentYear">${Array.from({length:5},(_,index)=>new Date().getFullYear()-3+index).map(year=>`<option ${year===Number(state.year)?'selected':''}>${year}</option>`).join('')}</select></label><label>Timeframe<select id="departmentTimeframe">${['Annual','Quarterly','Monthly','Weekly'].map(value=>`<option ${value===state.timeframe?'selected':''}>${value}</option>`).join('')}</select></label><label>Period<select id="departmentPeriod">${periodOptions().map(value=>`<option ${value===state.period?'selected':''}>${esc(value)}</option>`).join('')}</select></label><div class="department-compare"><span>Compare</span><button class="${state.compare==='Period'?'active':''}" data-compare="Period">Period</button><button class="${state.compare==='YoY'?'active':''}" data-compare="YoY">YoY</button></div></section>
      ${!source.connected?`<section class="department-source-callout"><div><strong>${esc(config.source)} source not connected</strong><span>Goals and Rocks remain available. Source-dependent metrics stay blank.</span></div><a href="/integrations/">Open Integrations →</a></section>`:''}
      <div class="department-goal-grid">${goalSection()}${rocksSection()}</div>
      <section class="department-section"><div class="department-section-head"><div><span>Department Performance</span><h2>KPIs</h2></div><small>Missing data is never replaced with demo values.</small></div><div class="department-metric-grid">${metricCards(model.metrics)}</div></section>
      ${listSection(model)}
      <section class="department-note"><strong>Source boundary</strong><span>${esc(model.note)}</span>${state.payload?.warnings?.length?`<small>${esc(state.payload.warnings.join(' · '))}</small>`:''}</section>
    </section>`;
    bind();
  }

  function bind() {
    document.querySelector('#departmentYear')?.addEventListener('change',event=>{state.year=Number(event.target.value);normalizePeriod();render()});
    document.querySelector('#departmentTimeframe')?.addEventListener('change',event=>{state.timeframe=event.target.value;normalizePeriod();render()});
    document.querySelector('#departmentPeriod')?.addEventListener('change',event=>{state.period=event.target.value;render()});
    document.querySelectorAll('[data-compare]').forEach(button=>button.addEventListener('click',()=>{state.compare=button.dataset.compare;render()}));
  }

  function loading() {
    const target=root();if(!target)return;
    target.innerHTML=`<section class="department-live"><header class="department-head"><div><span class="department-eyebrow">Monitor · Department</span><h1>${esc(config.title)}</h1><p>Loading account-scoped department data…</p></div></header><div class="department-loading">${Array.from({length:8},()=>'<span></span>').join('')}</div></section>`;
  }

  function failure(error) {
    const target=root();if(!target)return;
    target.innerHTML=`<section class="department-live"><header class="department-head"><div><span class="department-eyebrow">Monitor · Department</span><h1>${esc(config.title)}</h1></div></header><div class="department-error"><strong>${esc(error.message||'Department data could not be loaded.')}</strong><span>No prototype values were inserted.</span><button id="departmentRetry">Retry</button></div></section>`;
    document.querySelector('#departmentRetry')?.addEventListener('click',load);
  }

  async function load() {
    loading();
    try{
      const response=await fetch('/api/account-auth',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'monitor_department',department:page})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Department data could not be loaded.');
      state.payload=payload;render();
    }catch(error){failure(error)}
  }

  load();
})();
