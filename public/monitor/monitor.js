(() => {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  let storedAccount = null;
  try { storedAccount = JSON.parse(localStorage.getItem('cc_account') || 'null'); } catch {}
  const ownerName = storedAccount?.name || 'Agency Owner';
  const ownerEmail = storedAccount?.email || '';
  const agencyName = storedAccount?.agency_name || storedAccount?.agencyName || 'Agency Workspace';
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
    ['platform','Dashboard','All','dashboard'],['leadership','Leadership','Native','leadership'],['marketing','Marketing','CRM','marketing'],
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


  function renderUsers(){
    const users=[];
    let account=null;try{account=JSON.parse(localStorage.getItem('cc_account')||localStorage.getItem('ccUserAccount')||'null')}catch{}
    if(account){const name=account.name||account.displayName||[account.first_name||account.firstName,account.last_name||account.lastName].filter(Boolean).join(' ')||'Agency Owner';const email=account.email||localStorage.getItem('ccOwnerEmail')||'';users.push([name,'Owner',email])}
    shell(`<div class="users-head"><div><h1 class="page-title">Manage Users</h1><p class="page-subtitle">Team membership management is not connected yet. No prototype users are displayed.</p></div><button class="primary-btn" data-toast="Team member management requires a persisted membership model.">＋ New User</button></div><section class="card users-card"><div class="card-titlebar">${users.length} signed-in account user${users.length===1?'':'s'}</div>${users.length?users.map(u=>`<div class="user-row"><span class="user-avatar">${ico('person')}</span><div class="user-info"><div class="user-line"><strong>${u[0]}</strong><span class="role">◉ ${u[1]}</span></div><div class="user-email">${u[2]}</div></div></div>`).join(''):'<div class="empty-state">No signed-in account user is available.</div>'}</section>`,'Manage Users');
  }

  function renderLivePageLoading(title){
    shell(`<section class="live-shell-loading"><h1 class="page-title">${title}</h1><p class="page-subtitle">Loading account-scoped data…</p></section>`,title);
  }

  switch(page){
    case 'platform': renderLivePageLoading('Agency Dashboard'); break;
    case 'leadership': renderLivePageLoading('Leadership'); break;
    case 'users': renderUsers(); break;
    case 'marketing': renderLivePageLoading('Marketing'); break;
    case 'sales': renderLivePageLoading('Sales'); break;
    case 'billing': renderLivePageLoading('Billing'); break;
    case 'onboarding': renderLivePageLoading('Onboarding'); break;
    case 'service-delivery': renderLivePageLoading('Service Delivery'); break;
    case 'client-success': renderLivePageLoading('Client Success'); break;
    case 'talent-acquisition': renderLivePageLoading('Talent Acquisition'); break;
    case 'finance': renderLivePageLoading('Finance'); break;
    case 'communication': renderLivePageLoading('Communication'); break;
    case 'systems': renderLivePageLoading('Systems / IT'); break;
    case 'sops': renderLivePageLoading('SOPs'); break;
    default: renderLivePageLoading('Monitor');
  }
})();
