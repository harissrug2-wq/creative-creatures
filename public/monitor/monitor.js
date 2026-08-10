(() => {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  let storedAccount = null;
  try { storedAccount = JSON.parse(localStorage.getItem('cc_account') || 'null'); } catch {}
  const ownerName = storedAccount?.name || 'Directing Design Owner';
  const ownerEmail = storedAccount?.email || 'owner@directingdesign.com';
  const agencyName = storedAccount?.agency_name || storedAccount?.agencyName || 'Directing Design';
  const initials = ownerName.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'DD';
  const pageFromPath = path === '/' ? 'platform' : path.split('/').filter(Boolean).pop();
  const page = document.body.dataset.page || pageFromPath;
  const scorecardUnlocked = localStorage.getItem('ccDiagnosticReportReady') === 'true';
  const goalsUnlocked = scorecardUnlocked;
  const scorecardHref = scorecardUnlocked ? '/agency-scorecard/' : '/diagnostic/?locked=scorecard';

  const iconPaths = {
    dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    leadership:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    marketing:'<path d="M3 11l18-5v12L3 13z"/><path d="M7 14l1 6h4l-1-7"/>',
    sales:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    billing:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    onboarding:'<path d="M12 2l8 4.5v9L12 20l-8-4.5v-9z"/><path d="M4 6.5l8 4.5 8-4.5M12 11v9"/>',
    service:'<path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.5 2.5-3-3z"/>',
    client:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
    talent:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    finance:'<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M7 7V5h10v2M8 13h.01M16 13h.01"/>',
    communication:'<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
    systems:'<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/>',
    sops:'<path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h6M9 9h2"/>',
    monitor:'<path d="M3 12h4l2-7 4 14 2-7h6"/>',
    diagnostic:'<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/><circle cx="12" cy="12" r="3"/>',
    score:'<path d="M4 19V9M10 19V5M16 19v-7M22 19V2"/>',
    goals:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    plug:'<path d="M12 22v-5M9 8V2M15 8V2M7 8h10v3a5 5 0 0 1-10 0z"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
    spark:'<path d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    chevron:'<path d="M9 18l6-6-6-6"/>',
    person:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    close:'<path d="M6 6l12 12M18 6L6 18"/>'
  };
  const ico = (name, cls='') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.dashboard}</svg>`;

  const navItems = [
    ['platform','Dashboard','All','dashboard'],['leadership','Leadership','EOS','leadership'],['marketing','Marketing','CRM','marketing'],
    ['sales','Sales','CRM','sales'],['billing','Billing','Accounting','billing'],['onboarding','Onboarding','PM','onboarding'],
    ['service-delivery','Service Delivery','PM','service'],['client-success','Client Success','PM','client'],
    ['talent-acquisition','Talent Acquisition','Payroll','talent'],['finance','Finance','Accounting','finance'],
    ['communication','Communication','Comms','communication'],['systems','Systems / IT','IT','systems'],['sops','SOPs','Drive','sops']
  ];
  const pageHref = key => key === 'platform' ? '/platform/' : `/${key}/`;

  function shell(content, title = '') {
    document.title = `${title || 'Monitor'} · Creative Creatures`;
    const sidebar = navItems.map((n,i) => `${i===1?'<div class="side-label">Departments</div>':''}<a class="side-link ${page===n[0]?'active':''}" href="${pageHref(n[0])}">${ico(n[3],'nav-icon')}<span>${n[1]}</span><span class="side-tag">${n[2]}</span></a>`).join('');
    document.querySelector('#app').innerHTML = `
      <div class="monitor-app">
        <aside class="sidebar" id="sidebar">
          <div class="brand"><img src="/portal/creative-creatures-logo.png" alt="Creative Creatures"><div class="workspace-name">${agencyName}</div></div>
          <nav class="side-scroll">${sidebar}</nav>
          <div class="profile">
            <button class="profile-button" id="profileButton"><span class="avatar">${initials}</span><span class="profile-copy"><span class="profile-name">${ownerName}</span><span class="profile-email">${ownerEmail}</span></span>${ico('chevron','profile-chevron')}</button>
            <div class="profile-menu" id="profileMenu"><div class="profile-menu-head"><div class="profile-name">${ownerName}</div><div class="profile-email">${ownerEmail}</div></div><a href="#" data-toast="Invite teammate is ready for backend wiring.">${ico('person','nav-icon')}<span>Invite teammate</span></a><a href="/users/">${ico('users','nav-icon')}<span>Manage users</span></a><button class="signout" data-toast="Sign out requires authentication wiring."><span class="signout-icon" aria-hidden="true">↪</span><span>Sign out</span></button></div>
          </div>
        </aside>
        <div class="main-shell">
          <header class="topbar"><button class="mobile-toggle" id="mobileToggle">${ico('menu')}</button><nav class="topnav">
            <a href="/integrations/" class="top-link">${ico('plug')} Integrations</a>
            <a href="/diagnostic/" class="top-link">${ico('diagnostic')} Diagnostic</a>
            <a href="${scorecardHref}" class="top-link ${scorecardUnlocked?'':'locked-link'}" aria-disabled="${scorecardUnlocked?'false':'true'}">${ico('score')} Agency Scorecard</a>
            <a href="${goalsUnlocked?'/agency-goals/':'#'}" class="top-link ${goalsUnlocked?'':'locked-link'}" aria-disabled="${goalsUnlocked?'false':'true'}">${ico('goals')} Agency Goals</a>
            <a href="/platform/" class="top-link active">${ico('monitor')} Monitor</a>
            <button class="top-link locked-link" aria-disabled="true">${ico('dashboard')} Portal</button>
          </nav><button class="ask-button" id="askButton">${ico('spark')} Ask Creature</button></header>
          <main class="page-wrap">${content}</main>
        </div>
        <aside class="ask-drawer" id="askDrawer"><div class="drawer-head"><h3>Ask Creature</h3><button class="drawer-close" id="drawerClose">×</button></div><div class="drawer-context"><strong>${title || 'Dashboard'} context</strong><p>How can I help with ${title || 'Dashboard'}? I can summarize what is on screen, surface what needs attention, or draft a quick update based on this tab's data.</p></div><div class="suggestions"><button>Summarize this tab</button><button>What needs my attention?</button><button>Draft a quick update</button></div><div class="chat-input"><input placeholder="Ask about this page…"><button>Send</button></div></aside>
        <div class="toast" id="toast"></div>
        <div class="modal-backdrop" id="modalBackdrop"><div class="modal"><h3 id="modalTitle">New user</h3><div class="form-grid"><input placeholder="Full name"><input type="email" placeholder="Email address"><select><option>Member</option><option>Manager</option><option>Admin</option></select></div><div class="modal-actions"><button class="secondary-btn" id="modalCancel">Cancel</button><button class="primary-btn" id="modalSave">Save user</button></div></div></div>
      </div>`;
    bindShell();
  }

  function bindShell(){
    const profileButton=document.querySelector('#profileButton'),profileMenu=document.querySelector('#profileMenu');
    profileButton?.addEventListener('click',e=>{e.stopPropagation();profileMenu.classList.toggle('open')});
    document.addEventListener('click',()=>profileMenu?.classList.remove('open'));
    document.querySelector('#askButton')?.addEventListener('click',()=>document.querySelector('#askDrawer').classList.add('open'));
    document.querySelector('#drawerClose')?.addEventListener('click',()=>document.querySelector('#askDrawer').classList.remove('open'));
    document.querySelector('#mobileToggle')?.addEventListener('click',()=>document.querySelector('#sidebar').classList.toggle('open'));
    document.querySelectorAll('[data-toast]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();showToast(el.dataset.toast)}));
    document.querySelectorAll('.period button').forEach(btn=>btn.addEventListener('click',()=>{btn.parentElement.querySelectorAll('button').forEach(x=>x.classList.remove('active'));btn.classList.add('active')}));
    document.querySelectorAll('.leadership-tabs button').forEach(btn=>btn.addEventListener('click',()=>{btn.parentElement.querySelectorAll('button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');showToast(`${btn.textContent.trim()} selected.`)}));
    document.querySelectorAll('[data-open-modal]').forEach(btn=>btn.addEventListener('click',()=>openModal(btn.dataset.openModal)));
    document.querySelector('#modalCancel')?.addEventListener('click',closeModal);
    document.querySelector('#modalSave')?.addEventListener('click',()=>{closeModal();showToast('User saved in this prototype. Connect the backend to persist it.')});
  }
  function showToast(text){const t=document.querySelector('#toast');if(!t)return;t.textContent=text;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2400)}
  function openModal(mode='New user'){document.querySelector('#modalTitle').textContent=mode;document.querySelector('#modalBackdrop').classList.add('open')}
  function closeModal(){document.querySelector('#modalBackdrop').classList.remove('open')}

  const spark = points => `<svg class="spark" viewBox="0 0 72 17"><polyline points="${points || '0,12 18,10 30,11 44,8 57,7 72,5'}"/></svg>`;
  const status = s => `<span class="status ${s==='On track'?'track':s==='Watch'?'watch':s==='At risk'?'risk':s==='Off track'?'off':'done'}">${s}</span>`;
  const trend = (value, type='up') => `<span class="trend ${type}">${type==='up'?'▲':type==='down'?'▼':'—'} ${value}</span>`;
  const metricCard = m => `<article class="card metric-card"><div class="metric-label ${m.warn?'warn-dot':''}">${m.label}</div>${m.spark===false?'':spark(m.points)}<div class="metric-value">${m.value}</div><div class="metric-trend">${trend(m.trend||'—',m.type||'flat')}</div></article>`;
  const pageHeader = (title,subtitle,owner,source='No source',connected=false) => `<div class="page-head"><div><h1 class="page-title">${title}</h1><p class="page-subtitle">${subtitle}</p>${owner?`<div class="owner-pill">${ico('person')} Owner <strong>${owner}</strong></div>`:''}</div><div class="toolbar"><div class="period"><span class="date-control">${ico('calendar')} ‹ &nbsp; August 2026 &nbsp; ›</span><button class="active">Month</button><button>Quarter</button><button>Year</button></div><div class="source-pill ${connected?'connected':''}"><span class="source-dot"></span>${source}</div></div></div>`;
  const goalCard = (title,count,items,emptyText,link='/') => `<section class="card goal-card"><div class="card-titlebar"><span>${title} <small>from ${title.startsWith('Department')?'Goals':'Leadership'} · ${count}</small></span><a class="text-link" href="${link}">Open ${title.startsWith('Department')?'Goals':'Leadership'} ↗</a></div>${items?.length?`<ul class="goal-list">${items.map(it=>`<li class="goal-row"><strong>${it.title}</strong><div class="goal-meta">${it.meta}</div>${status(it.status)}${it.progress!=null?`<div class="progress"><span style="width:${it.progress}%"></span></div>`:''}</li>`).join('')}</ul>`:`<div class="empty-state">${emptyText}</div>`}</section>`;
  const goalsBlock = d => `<div class="goals-layout">${goalCard('Department Goals',d.goals?.length||0,d.goals,d.emptyGoal||`No goals assigned to ${d.title} yet. <a href="#" data-toast="Goal creation requires backend wiring.">Add one.</a>`,'#')}${goalCard('Quarterly Rocks',d.rocks?.length||0,d.rocks,d.emptyRock||`No rocks assigned to ${d.title} this quarter. <a href="/leadership/">Assign one.</a>`,'/leadership/')}</div>`;
  const metricsGrid = (metrics,cls='grid-4') => `<div class="${cls}">${metrics.map(metricCard).join('')}</div>`;
  const listCard = (title,items) => `<section class="card list-card"><div class="card-titlebar">${title}</div><ul class="metric-list">${items.map(i=>`<li><span class="${i.warn?'warn-dot':''}">${i[0]||i.label}</span><strong class="${i.red?'red':''}">${i[1]||i.value}</strong></li>`).join('')}</ul></section>`;

  const departmentData = {
    marketing:{title:'Marketing',subtitle:'Top of funnel, SQLs and acquisition cost.',owner:'Priya Shah',source:'GoHighLevel · synced 2m ago',connected:true,goals:[
      {title:'25 qualified discovery calls',meta:'Quarterly · Q2 2026 · Michael · 25 calls',status:'On track',progress:48},{title:'9 discovery calls',meta:'Monthly · Jun 2026 · Michael · 9 calls',status:'On track',progress:55},{title:'3 discovery calls booked',meta:'Weekly · Wk 23 · Jun 1–7 · Michael · 3 calls',status:'On track',progress:66},{title:'Cold outreach: 200 leads loaded into Snov.io',meta:'Weekly · Wk 23 · Jun 1–7 · Michael · 200 leads',status:'On track',progress:82}],rocks:[
      {title:'Build cold outreach campaign for Remodeling (Snov.io)',meta:'Owner · Michael',status:'On track'},{title:'Create cold outreach campaign for Solar (LinkedIn + GHL funnel)',meta:'Owner · Kinsey',status:'On track'},{title:'Implement LTN sequence for Builders/Construction',meta:'Owner · Tony, Michael',status:'Completed'},{title:'Premium full system build out — directingleads.com (Gamma deck, GHL automation)',meta:'Owner · Michael',status:'On track'},{title:'Define & launch V1 Podcast (Michael as host)',meta:'Owner · Tony, Michael',status:'At risk'}],metrics:[
      {label:'Organic Web Traffic',value:'18.4k',trend:'+12%',type:'up',warn:true},{label:'Lead Conversion Rate',value:'3.8%',trend:'+0.4pt',type:'up',warn:true},{label:'SQLs — Discovery',value:'42',trend:'+6',type:'up',warn:true},{label:'Cost per SQL',value:'$214',trend:'-8%',type:'down'}],list:[['Organic Web Traffic (non-branded)','18,420'],['Branded Search Volume','4,910'],['Lead Conversion Rate','3.8%'],['SQLs – Discovery Scheduled','42'],['Discovery Calls Shown','31'],['Cost per SQL','$214'],['Sales Cycle Length (days)','27'],['Client Acquisition Cost','$1,840'],['Client LTV','$14,200']]},
    sales:{title:'Sales',subtitle:'Pipeline, conversions and new MRR.',owner:'Marcus Lee',source:'GoHighLevel · synced 2m ago',connected:true,goals:[
      {title:'12 new logos @ $1,500 MRR',meta:'Yearly · 2026 · Kinsey · 12 logos',status:'At risk',progress:24},{title:'3 new logos at $1,500 MRR',meta:'Quarterly · Q2 2026 · Kinsey · 3 closes',status:'At risk',progress:34},{title:'10 proposals out the door',meta:'Quarterly · Q2 2026 · Kinsey · 10 proposals',status:'At risk',progress:30},{title:'1 new logo closed',meta:'Monthly · Jun 2026 · Kinsey · 1 close',status:'At risk',progress:20},{title:'3 proposals delivered',meta:'Monthly · Jun 2026 · Kinsey · 3 proposals',status:'At risk',progress:33},{title:'1 proposal sent',meta:'Weekly · Wk 23 · Jun 1–7 · Kinsey · 1 proposal',status:'Off track',progress:14}],rocks:[
      {title:'Get Carrots Not Sticks Campaign operational + generating discovery calls',meta:'Owner · Michael',status:'Completed'},{title:'Connect Kinsey’s LinkedIn to We-Connect for Solar outreach',meta:'Owner · Michael, Kinsey',status:'Completed'},{title:'Build Sales Playbook V1',meta:'Owner · Tony',status:'At risk'}],metrics:[
      {label:'New MRR',value:'$8.4k',trend:'+18%',type:'up'},{label:'Close Rate',value:'24%',trend:'+2pt',type:'up'},{label:'Pipeline Value',value:'$142k',trend:'+9%',type:'up'},{label:'Avg MRR / Deal',value:'$1.4k',trend:'flat',type:'flat'}],list:[['Calls Made','318'],['Calls Answered','201'],['Call Answer Rate','63%'],['Connected w/ Decision Maker','88'],['Discovery Calls Booked','47'],['Emails Sent','2,140'],['Email Open Rate','41%'],['Email Reply Rate','7.2%'],['Proposals Sent','19'],['Close Rate','24%'],['New Sales','6'],['New MRR','$8,400'],['Average MRR (per deal)','$1,400'],['Sales Cycle Length (days)','27']]},
    'service-delivery':{title:'Service Delivery',subtitle:'Team utilization and ticket throughput.',owner:'Jordan Pak',source:'No PM source',metrics:[
      {label:'Team Utilization',value:'74%',trend:'+2pt',type:'up',warn:true},{label:'Tickets Created (mo)',value:'128',trend:'+14',type:'up',warn:true},{label:'Open Tickets',value:'23',trend:'-5',type:'down',warn:true,points:'0,3 16,6 31,9 48,11 72,13'},{label:'Avg Ticket Completion',value:'2.4d',trend:'-0.3',type:'down',spark:false}],list:[['Late Tasks in PM','11'],['Team Utilization %','74%'],['Tickets Created This Month','128'],['Open Tickets','23'],['Avg Ticket Completion Time','2.4 days'],['Completed Projects','17']]},
    'talent-acquisition':{title:'Talent Acquisition',subtitle:'Open reqs, reviews and PDP coverage.',owner:'Morgan Diaz',source:'QuickBooks · synced 12m ago',connected:true,metrics:[
      {label:'Open Requisitions',value:'4',trend:'—',type:'flat',spark:false},{label:'Employee Sentiment',value:'Good',trend:'+1 step',type:'up',spark:false},{label:'Glassdoor Reviews',value:'12',trend:'+3',type:'up',spark:false},{label:'PDPs in Place',value:'82%',trend:'+6pt',type:'up',spark:false}],list:[['Talent Requisitions Made (by Role)','4'],['Employee Reviews Given (Glassdoor)','12'],['1:1 Meetings Recorded','38'],['Performance Reviews Recorded','9'],['Professional Development Plans in Place','82%'],['PDP attainment by quarter','71%']]},
    finance:{title:'Finance',subtitle:'Revenue, margins and cash position.',owner:'Dana Cole',source:'Stripe · synced 4m ago',connected:true,goals:[{title:'Hit $396,000 ARR ($33,000 MRR)',meta:'Yearly · 2026 · Michael · $33k MRR',status:'At risk',progress:28},{title:'Maintain ≥ 12% net income',meta:'Yearly · 2026 · Tony · 12%',status:'On track',progress:55}],metrics:[
      {label:'Revenue YTD',value:'$1.12M',trend:'+14%',type:'up'},{label:'Net Profit Margin',value:'21%',trend:'+1.4pt',type:'up',spark:false},{label:'Cash on Hand',value:'$212k',trend:'-4%',type:'down',points:'0,5 16,6 31,7 48,8 72,9'},{label:'Gross Profit Margin',value:'58%',trend:'+2pt',type:'up',spark:false}],list:[['Revenue YTD','$1,120,000'],['4-Week Trailing Revenue','$94,200'],['MoM Growth','+6.1%'],['Scheduled MRR','$88,400'],['90-Day Trailing Revenue','$281k'],['QoQ Growth','+9.4%'],['Gross Profit Margin','58%'],['Operating Expense Ratio','42%'],['Net Profit Margin','21%'],['Cash on Hand','$212,000'],['Cash Flow Forecast vs Actual','96% acc.'],['Revenue Forecasting Accuracy','93%'],['Revenue per FTE','$148k'],['Profit per FTE','$31k'],['Labor Cost as % of Revenue','38%'],['Client Acquisition Cost (CAC)','$1,840'],{label:'Receivables 30+ Days',value:'$14,100',red:true}]},
    communication:{title:'Communication',subtitle:'Email, Slack volume and sentiment.',owner:'Taylor Brooks',source:'No comms source',metrics:[
      {label:'Company Emails Tracked',value:'5.2k',trend:'+11%',type:'up',spark:false},{label:'Slack Messages',value:'14.8k',trend:'+4%',type:'up',spark:false},{label:'Overall Sentiment',value:'Positive',trend:'stable',type:'flat',spark:false},{label:'Core Values Called Out',value:'27',trend:'this week',type:'up',spark:false}],list:[['Company Emails Tracked','5,210'],['Slack Messages Tracked','14,830'],['Sentiment Positive','68%'],['Sentiment Neutral','24%'],{label:'Sentiment Negative',value:'8%',red:true},['Core Values Called Out (top 3)','Ownership · Craft · Speed']]},
    systems:{title:'Systems / IT',subtitle:'Systems under management and infra health.',owner:'Chris Hale',source:'Internal · synced 1h ago',connected:true,rocks:[{title:'Ship V1 of All Accounts + Churn/Upgrade tab with Trinity',meta:'Owner · Michael',status:'Completed'}],metrics:[
      {label:'Systems Under Mgmt',value:'34',trend:'+2',type:'up',spark:false},{label:'New Users (90d)',value:'11',trend:'—',type:'flat',spark:false},{label:'AI Token Spend',value:'$1.2k',trend:'+22%',type:'up',spark:false},{label:'Site Outages (90d)',value:'1',trend:'-2',type:'down',spark:false}],list:[['Systems Under Management (Keeper / Bitwarden)','34'],['New Users Added (30 / 90 days)','4 / 11'],['Local Machines Under Management','47'],['Number of VPNs','3'],['Number of APIs','18'],['New User Accounts Needed','2'],['AI Token Usage & Cost','$1,210'],['Websites We Are Hosting','22'],{label:'Website Outages (30 / 90 / 365 days)',value:'1 / 1 / 4',red:true}]},
    sops:{title:'SOPs',subtitle:'Documented processes and coverage.',owner:'Jamie Park',source:'No Drive source',metrics:[
      {label:'Documented SOPs',value:'64',trend:'+5',type:'up',spark:false},{label:'Last Updated',value:'2d ago',trend:'—',type:'flat',spark:false},{label:'Coverage',value:'78%',trend:'+4pt',type:'up',spark:false},{label:'Stale (>180d)',value:'9',trend:'—',type:'flat',spark:false}],list:[['Total SOPs Documented','64'],['Process Coverage','78%'],['SOPs Updated (30d)','5'],{label:'Stale SOPs (>180 days)',value:'9',red:true}]}
  };

  function renderDashboard(){
    const metrics=[{label:'Revenue (MRR)',value:'$94.2k',trend:'+6.1%',type:'up'},{label:'Net Profit Margin',value:'21%',trend:'+1.4pt',type:'up'},{label:'Active Accounts',value:'58',trend:'+3',type:'up'},{label:'New MRR',value:'$8.4k',trend:'+18%',type:'up'},{label:'Lead → Close Rate',value:'3.8%',trend:'+0.4pt',type:'up',warn:true},{label:'Cash on Hand',value:'$212k',trend:'-4%',type:'down',points:'0,4 15,5 31,6 48,7 72,8'},{label:'Team Utilization',value:'74%',trend:'+2pt',type:'up',warn:true},{label:'Client Sentiment',value:'Good',trend:'stable',type:'flat',spark:false}];
    const rows=[['Marketing','SQLs 42','On track','marketing'],['Sales','New MRR $8.4k','On track','sales'],['Billing','A/R 30+ $14k','Watch','billing'],['Onboarding','9 in pipeline','On track','onboarding'],['Service Delivery','Late tasks 11','Watch','service-delivery'],['Client Success','Sentiment Good','On track','client-success'],['Talent Acquisition','PDPs 82%','On track','talent-acquisition'],['Finance','Cash $212k','Watch','finance'],['Communication','Sentiment Positive','On track','communication'],['Systems / IT','Outages (90d) 1','On track','systems'],['SOPs','Stale 9','Watch','sops'],['Leadership','Rocks 5/10 on track','Off track','leadership']];
    shell(`<h1 class="page-title">Welcome to your agency workspace</h1><p class="page-subtitle" style="max-width:560px;margin-bottom:24px">A live view of how the agency is performing this month — KPIs, accounts, and department roll-up in one place.</p>
      <section class="card accounts-card"><div class="accounts-head"><div class="accounts-title"><span class="round-icon">${ico('users')}</span><div class="accounts-copy"><h3>All Accounts</h3><p>Full roster of agency clients — health, ownership, MRR, and services in one view.</p></div></div><a href="#" class="accounts-link" data-toast="Account roster requires backend data.">Open accounts →</a></div><div class="account-stats">${[['Total accounts','8',''],['MRR','$10,040',''],['Healthy','5','green'],['Watch / at risk','3','amber'],['Churned','0','muted']].map(s=>`<div class="account-stat"><label>${s[0]}</label><strong class="${s[2]}">${s[1]}</strong></div>`).join('')}</div></section>
      <div class="section-head"><h2>This month's KPIs</h2><span>Rolling 7-period trend</span></div>${metricsGrid(metrics)}
      <div class="section-head"><h2>Departmental roll-up</h2><span>One headline metric per department</span></div><section class="card table-card"><table class="data-table dashboard-table"><thead><tr><th>Department</th><th>Headline metric</th><th>Status</th></tr></thead><tbody>${rows.map(r=>`<tr><td><a href="/${r[3]}/" style="text-decoration:none">${r[0]}</a></td><td class="mono">${r[1]}</td><td>${status(r[2])}</td></tr>`).join('')}</tbody></table></section>`, 'Dashboard');
  }

  function renderLeadership(){
    shell(`${pageHeader('Leadership','Vision, Traction, Rocks & Issues.','Alex Rivera','EOS · manual',true)}<div class="leadership-tabs"><button class="active">Weekly L10 Meetings</button><button>Rocks & Issues</button><button>Marketing Strategy</button><button>Vision / Traction</button></div><section class="notice"><span class="round-icon">${ico('spark')}</span><div><h3>Agendas are created automatically</h3><p>Your meeting note-taker streams into the system. We auto-build the L10 agenda (segue, KPIs, rocks, to-dos, IDS) from the transcript — anyone on the team can view or edit it, and the original transcript stays one click away.</p></div><button data-toast="Meeting creation requires backend wiring.">＋ New L10 Meeting</button></section><div class="meeting-list">${[
      ['Weekly Leadership L10 — 6/3/26','2026-06-03 · completed','9/9 rocks','2 todos','1 IDS','8.8'],['Weekly Leadership L10 — 5/27/26','2026-05-27 · completed','6/6 rocks','0 todos','2 IDS','9.0'],['Weekly Leadership L10 — 5/20/26','2026-05-20 · completed','3/3 rocks','0 todos','0 IDS','9.0']].map(m=>`<article class="card meeting"><span class="meeting-icon">${ico('calendar')}</span><div class="meeting-main"><strong>${m[0]}</strong><small>${m[1]}</small></div><div class="meeting-stats"><span>✓ ${m[2]}</span><span>○ ${m[3]}</span><span>△ ${m[4]}</span><span>☆ ${m[5]}</span></div></article>`).join('')}</div>`, 'Leadership');
  }

  function renderGenericDepartment(key){
    const d=departmentData[key];
    shell(`${pageHeader(d.title,d.subtitle,d.owner,d.source,d.connected)}${goalsBlock(d)}${metricsGrid(d.metrics)}<div style="height:18px"></div>${key==='communication'?communicationPanel():''}${listCard(key==='service-delivery'?'Total & By Client':'All Metrics',d.list)}`,d.title);
  }

  function renderBilling(){
    const d={title:'Billing',subtitle:'Active accounts, average bill and A/R aging.',owner:'Dana Cole'};
    const metrics=[{label:'Active Accounts',value:'58',trend:'+3',type:'up',spark:false},{label:'Avg Monthly Billing',value:'$1.62k',trend:'+5%',type:'up',spark:false},{label:'New Accounts (30d)',value:'4',trend:'—',type:'flat',spark:false},{label:'A/R 90+ Days',value:'$3.2k',trend:'-12%',type:'down',spark:false}];
    shell(`${pageHeader(d.title,d.subtitle,d.owner,'Stripe · synced 4m ago',true)}${goalsBlock(d)}${metricsGrid(metrics)}<div style="height:18px"></div><div class="grid-2">${listCard('Account Overview',[['Total Active Accounts','58'],['Avg Monthly Billing per Account','$1,620'],['Top Account','$8,400 / mo'],['Lowest Account','$320 / mo'],['New Client Accounts (30 / 60 / 90 / Annual)','4 / 9 / 14 / 41']])}<section class="card aging"><h3>A/R Aging</h3>${[['1–30 days','$22,400',100,''],['30+ days','$14,100',63,''],['60–90 days','$6,800',30,''],['90+ days','$3,200',14,'red']].map(a=>`<div class="aging-row"><div class="aging-meta"><span>${a[0]}</span><strong>${a[1]}</strong></div><div class="aging-bar"><span class="${a[3]}" style="width:${a[2]}%"></span></div></div>`).join('')}</section></div><div style="height:18px"></div><section class="card table-card"><div class="card-titlebar">Accounts by Revenue Quartile</div><table class="data-table"><thead><tr><th>Quartile</th><th>Accounts</th><th>% Revenue</th><th>Avg / mo</th></tr></thead><tbody>${[['Q1 (top)','14','52%','$3,490'],['Q2','15','27%','$1,690'],['Q3','15','15%','$940'],['Q4 (bottom)','14','6%','$400']].map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`,d.title);
  }

  function renderOnboarding(){
    const d={title:'Onboarding',subtitle:'5-phase onboarding pipeline.',owner:'Sam Okafor',rocks:[{title:'Consolidate onboarding + PM into ClickUp, refine SOPs',meta:'Owner · Michael',status:'On track'}]};
    const phases=[['Phase 1','Get MarTech Access','3'],['Phase 2','Interview, Research & Analysis','2'],['Phase 3','Strategic Plan Delivery','2'],['Phase 4','Early Wins','1'],['Phase 5','Programmatic Tasks + First MMR','1']];
    shell(`${pageHeader(d.title,d.subtitle,d.owner,'No PM source')}${goalsBlock(d)}<div class="grid-5">${phases.map(p=>`<article class="card phase-card"><small>${p[0]}</small><p>${p[1]}</p><strong>${p[2]}</strong></article>`).join('')}</div><div style="height:18px"></div><section class="card table-card"><div class="card-titlebar">Onboarding Pipeline</div><table class="data-table"><thead><tr><th>Client</th><th>Phase</th><th>Days in stage</th><th>Status</th></tr></thead><tbody>${[['Brightline Co.','Phase 2','6','On track'],['Northwind Labs','Phase 4','11','Watch'],['Helix Ventures','Phase 1','2','On track'],['Verge Apparel','Phase 5','19','Off track']].map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${status(r[3])}</td></tr>`).join('')}</tbody></table></section>`,d.title);
  }

  function renderClientSuccess(){
    const d={title:'Client Success',subtitle:'Client sentiment and client-facing activity.',owner:'Riley Nguyen',goals:[{title:'$4,000 MRR from existing upgrades',meta:'Yearly · 2026 · Tony · $4k MRR',status:'On track',progress:30},{title:'Churn < 5% (<$1k/m)',meta:'Yearly · 2026 · Tony · <5%',status:'On track',progress:70},{title:'$1k MRR from upgrades',meta:'Quarterly · Q2 2026 · Tony · $1k MRR',status:'On track',progress:40}]};
    shell(`${pageHeader(d.title,d.subtitle,d.owner,'No PM source')}${goalsBlock(d)}<div class="split-panels"><section class="card sentiment-card"><h3>Client Sentiment</h3><div class="donut-wrap"><div class="donut"><div class="donut-center"><strong>Good</strong>Overall</div></div><div class="legend">${[['#17a456','Great','62%'],['#2d31dd','Good','22%'],['#e9a10d','Neutral','11%'],['#d94545','Poor','5%']].map(x=>`<div><i style="background:${x[0]}"></i>${x[1]}<span>${x[2]}</span></div>`).join('')}</div></div></section><section class="card activity-card"><h3>Client-Facing Activity</h3>${[['Client Meetings Recorded','41'],['Client Emails Recorded','312'],['Slack Messages Recorded','1,840']].map(r=>`<div class="activity-row"><span>${r[0]}</span><strong>${r[1]}</strong></div>`).join('')}</section></div>`,d.title);
  }

  function communicationPanel(){
    const items=[['#general Slack channel','Daily standups, kudos, lightweight coordination.','1,840','Positive'],['#delivery-ops','Active project coordination.','1,320','Neutral'],['Outbound sequences','Cadence sends and replies.','980','Neutral'],['Leadership L10 thread','Pre/post L10 issue tracking and rock check-ins.','421','Neutral'],['Campaign launches','Creative reviews and launch coordination.','412','Positive']];
    return `<section class="card" style="overflow:hidden;margin-bottom:18px"><div class="card-titlebar">Top 5 Communications <small>Overall · by volume</small></div>${items.map((it,i)=>`<div class="communication-item"><span class="rank">#${i+1}</span><span class="comm-icon">${ico('communication')}</span><div><div class="comm-title">${it[0]}</div><div class="comm-sub">${it[1]}</div></div><div class="comm-right">${it[2]}<small>${it[3]}</small></div></div>`).join('')}</section>`;
  }

  function renderUsers(){
    const users=[
      ['Alex Rivera','Admin','alex@creativecreatures.org',['Agency Scorecard','Leadership','Agency Goals']],['Priya Shah','Manager','priya@creativecreatures.org',['Marketing']],['Marcus Lee','Manager','marcus@creativecreatures.org',['Sales']],['Dana Cole','Manager','dana@creativecreatures.org',['Billing','Finance']],['Sam Okafor','Manager','sam@creativecreatures.org',['Onboarding']],['Jordan Pak','Manager','jordan@creativecreatures.org',['Service Delivery']],['Riley Nguyen','Manager','riley@creativecreatures.org',['Client Success']],['Morgan Diaz','Manager','morgan@creativecreatures.org',['Talent Acquisition']],['Taylor Brooks','Manager','taylor@creativecreatures.org',['Communication']],['Chris Hale','Manager','chris@creativecreatures.org',['Systems / IT']],['Jamie Park','Member','jamie@creativecreatures.org',['SOPs']]
    ];
    let account=null;try{account=JSON.parse(localStorage.getItem('cc_account')||localStorage.getItem('ccUserAccount')||'null')}catch{}
    if(account){const name=account.name||account.displayName||[account.first_name||account.firstName,account.last_name||account.lastName].filter(Boolean).join(' ');const email=account.email||localStorage.getItem('ccOwnerEmail')||'';if(name&&!users.some(user=>String(user[2]).toLowerCase()===String(email).toLowerCase()))users.unshift([name,'Owner',email,['Owner Archetype','Agency Diagnostic']]);}
    shell(`<div class="users-head"><div><h1 class="page-title">Manage Users</h1><p class="page-subtitle">Add team members and assign them as owners of one or more departments.</p></div><button class="primary-btn" data-open-modal="New user">＋ New User</button></div><section class="card users-card"><div class="card-titlebar">${users.length} users</div>${users.map(u=>`<div class="user-row"><span class="user-avatar">${ico('person')}</span><div class="user-info"><div class="user-line"><strong>${u[0]}</strong><span class="role">◉ ${u[1]}</span></div><div class="user-email">${u[2]}</div><div class="ownership">${u[3].map(x=>`<span>Owns · ${x}</span>`).join('')}</div></div><div class="user-actions"><button class="icon-btn" data-open-modal="Edit ${u[0]}">✎ Edit</button><button class="icon-btn" data-toast="Delete is disabled in this prototype.">♙</button></div></div>`).join('')}</section>`,'Manage Users');
  }

  switch(page){
    case 'platform': renderDashboard(); break;
    case 'leadership': renderLeadership(); break;
    case 'billing': renderBilling(); break;
    case 'onboarding': renderOnboarding(); break;
    case 'client-success': renderClientSuccess(); break;
    case 'users': renderUsers(); break;
    case 'marketing': case 'sales': case 'service-delivery': case 'talent-acquisition': case 'finance': case 'communication': case 'systems': case 'sops': renderGenericDepartment(page); break;
    default: renderDashboard();
  }
})();
