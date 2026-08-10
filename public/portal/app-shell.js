(() => {
  const icon = (name) => {
    const icons = {
      monitor:'<path d="M3 12h4l2-7 4 14 2-7h6"/>',
      diagnostic:'<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4"/><circle cx="12" cy="12" r="3"/>',
      score:'<path d="M4 19V9M10 19V5M16 19v-7M22 19V2"/>',
      goals:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
      plug:'<path d="M12 22v-5M9 8V2M15 8V2M7 8h10v3a5 5 0 0 1-10 0z"/>',
      portal:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
      spark:'<path d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
      logout:'<path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ''}</svg>`;
  };
  const readAccount = () => {
    if (window.CCAccount?.getAccount) return window.CCAccount.getAccount();
    try { return JSON.parse(localStorage.getItem('cc_account') || localStorage.getItem('ccUserAccount') || 'null'); }
    catch { return null; }
  };
  const escape = (value) => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials = value => String(value || 'CC').trim().split(/\s+/).slice(0,2).map(part => part[0] || '').join('').toUpperCase() || 'CC';
  const signOut = () => {
    ['ccSignedIn','cc_account','ccUserAccount'].forEach(key => localStorage.removeItem(key));
    location.href = '/login/';
  };

  document.querySelectorAll('[data-app-header]').forEach(el => {
    const active = el.dataset.appHeader || '';
    const accelerator = active === 'accelerator';
    const diagnosticLabel = accelerator ? 'Accelerator' : 'Diagnostic';
    const diagnosticHref = accelerator ? '/accelerator/' : '/diagnostic/';
    const state = window.CCDiagnostic?.getState?.() || { reportReady:false, unlocked:false };
    const scorecardReady = Boolean(state.reportReady || state.unlocked);
    const scorecardHref = scorecardReady ? '/agency-scorecard/' : '/diagnostic/?locked=scorecard';
    const scorecardClass = `${active === 'scorecard' ? 'active ' : ''}${scorecardReady ? '' : 'scorecard-locked'}`.trim();
    const account = readAccount();
    const displayName = account?.name || account?.displayName || [account?.first_name || account?.firstName, account?.last_name || account?.lastName].filter(Boolean).join(' ') || '';
    const agencyName = account?.agency_name || account?.agencyName || localStorage.getItem('ccAgencyName') || '';
    const identity = displayName || agencyName;
    const profile = identity ? `<button class="top-account" type="button" aria-expanded="false"><span>${escape(initials(identity))}</span><b>${escape(agencyName || displayName)}</b></button>` : '';

    el.innerHTML = `
      <header class="app-topbar">
        <a class="top-logo" href="/login/"><img class="cc-platform-logo" src="/portal/creative-creatures-logo.png" alt="Creative Creatures"></a>
        <nav class="app-nav">
          <a href="/platform/" class="${active==='monitor'?'active':''}">${icon('monitor')}Monitor</a>
          <a href="${diagnosticHref}" class="${active==='diagnostic'||active==='accelerator'?'active':''}">${icon('diagnostic')}${diagnosticLabel}</a>
          <a href="${scorecardHref}" class="${scorecardClass}" aria-disabled="${scorecardReady?'false':'true'}">${icon('score')}Agency Scorecard${scorecardReady?'':' <span class="nav-lock">Locked</span>'}</a>
          <a href="/agency-goals/" class="${active==='goals'?'active':''}">${icon('goals')}Agency Goals</a>
          <a href="/integrations/" class="${active==='integrations'?'active':''}">${icon('plug')}Integrations</a>
          <a href="#" class="portal-muted" onclick="return false">${icon('portal')}Portal <span class="coming">coming soon</span></a>
        </nav>
        <button class="ask-creature">${icon('spark')}Ask Creature</button>
        ${profile}
        <button class="mobile-nav-toggle" aria-label="Open navigation">☰</button>
      </header>
      <nav class="mobile-nav-panel">
        <a href="/platform/" class="${active==='monitor'?'active':''}">Monitor</a>
        <a href="${diagnosticHref}" class="${active==='diagnostic'||active==='accelerator'?'active':''}">${diagnosticLabel}</a>
        <a href="${scorecardHref}" class="${scorecardReady?'':'scorecard-locked'}">Agency Scorecard${scorecardReady?'':' · Locked'}</a>
        <a href="/agency-goals/" class="${active==='goals'?'active':''}">Agency Goals</a>
        <a href="/integrations/" class="${active==='integrations'?'active':''}">Integrations</a>
        ${identity ? `<button class="mobile-signout" type="button">${icon('logout')}Sign out ${escape(displayName || agencyName)}</button>` : ''}
      </nav>
      ${identity ? `<div class="top-account-menu" hidden><strong>${escape(displayName || agencyName)}</strong><span>${escape(account?.email || '')}</span><button type="button">${icon('logout')}Sign out</button></div>` : ''}`;

    const toggle = el.querySelector('.mobile-nav-toggle');
    const panel = el.querySelector('.mobile-nav-panel');
    toggle?.addEventListener('click', () => panel.classList.toggle('open'));
    el.querySelector('.mobile-signout')?.addEventListener('click', signOut);
    const accountButton = el.querySelector('.top-account');
    const accountMenu = el.querySelector('.top-account-menu');
    accountButton?.addEventListener('click', event => {
      event.stopPropagation();
      const open = accountMenu.hidden;
      accountMenu.hidden = !open;
      accountButton.setAttribute('aria-expanded', String(open));
    });
    accountMenu?.querySelector('button')?.addEventListener('click', signOut);
    document.addEventListener('click', event => {
      if (accountMenu && !accountMenu.hidden && !accountMenu.contains(event.target) && !accountButton?.contains(event.target)) {
        accountMenu.hidden = true;
        accountButton?.setAttribute('aria-expanded', 'false');
      }
    });
  });
})();
