(() => {
  const icon = name => {
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
  const esc = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials = value => String(value || 'CC').trim().split(/\s+/).slice(0,2).map(part => part[0] || '').join('').toUpperCase() || 'CC';
  const signOut = () => { ['ccSignedIn','cc_account','ccUserAccount'].forEach(key => localStorage.removeItem(key)); location.href='/login/'; };
  const bool = key => localStorage.getItem(key) === 'true';

  function diagnosticStatus(state) {
    const done = [
      Boolean(state.ownerComplete),
      bool('ccPaymentComplete') || bool('agencyPaymentComplete'),
      bool('agencyIntegrationsComplete'),
      Boolean(state.strength),
      Boolean(state.independence),
      Boolean(state.performance),
      Boolean(state.reportReady)
    ];
    const labels = ['Identity Assessment','Payment','Integration Information','Operations','Owner Dependency','Financial Performance','Diagnostic Ready'];
    const current = done.findIndex(value => !value);
    return `<section class="diagnostic-status" aria-label="Agency Diagnostic progress">${labels.map((label,index) => {
      const cls = done[index] ? 'complete' : index === current ? 'current' : 'future';
      return `<div class="diagnostic-status-step ${cls}"><span>${done[index] ? '✓' : index + 1}</span><b>${label}</b></div>${index < labels.length - 1 ? '<i></i>' : ''}`;
    }).join('')}</section>`;
  }

  document.querySelectorAll('[data-app-header]').forEach(el => {
    const active = el.dataset.appHeader || '';
    const accelerator = active === 'accelerator';
    const state = window.CCDiagnostic?.getState?.() || {reportReady:false, ownerComplete:false, strength:false, independence:false, performance:false};
    const account = readAccount();
    const displayName = account?.name || account?.displayName || [account?.first_name || account?.firstName, account?.last_name || account?.lastName].filter(Boolean).join(' ') || '';
    const agencyName = account?.agency_name || account?.agencyName || localStorage.getItem('ccAgencyName') || '';
    const identity = displayName || agencyName;
    const profile = identity ? `<button class="top-account" type="button" aria-expanded="false"><span>${esc(initials(identity))}</span><b>${esc(agencyName || displayName)}</b></button>` : '';

    const goalsReady = Boolean(state.reportReady);
    const monitorReady = bool('agencyGoalsComplete');
    const item = (href,label,name,key,enabled=true) => {
      const activeClass = active === key ? 'active' : '';
      const disabled = !enabled;
      return `<a href="${disabled ? '#' : href}" class="${activeClass}${disabled ? ' nav-disabled' : ''}" ${disabled ? 'aria-disabled="true" onclick="return false"' : ''}>${icon(name)}${label}</a>`;
    };

    let status = '';
    const navigation = [
      ['/integration-information/','Integration Information','plug','integration-information',true],
      ['/integrations/','Integrations','plug','integrations',true],
      ['/accelerator/','Accelerator','diagnostic','accelerator',true],
      ['/diagnostic/','Diagnostic','diagnostic','diagnostic',true],
      ['/agency-scorecard/','Agency Scorecard','score','scorecard',state.reportReady],
      ['/agency-goals/','Agency Goals','goals','goals',goalsReady],
      ['/platform/','Monitor','monitor','monitor',monitorReady],
      ['/portal/','Portal','portal','portal',true]
    ];
    const desktopNav = navigation.map(([href,label,name,key,enabled]) => item(href,label,name,key,enabled)).join('');
    const mobileNav = navigation.map(([href,label,name,key,enabled]) => [label,href,enabled,key]);
    const paid = bool('ccPaymentComplete') || bool('agencyPaymentComplete');
    if (paid && (active === 'diagnostic' || active === 'integration-information')) status = diagnosticStatus(state);

    el.innerHTML = `
      <header class="app-topbar">
        <a class="top-logo" href="/login/"><img class="cc-platform-logo" src="/portal/creative-creatures-logo.png" alt="Creative Creatures"></a>
        <nav class="app-nav">${desktopNav}</nav>
        <button class="ask-creature">${icon('spark')}Ask Creature</button>${profile}
        <button class="mobile-nav-toggle" type="button" aria-label="Open navigation" aria-expanded="false">☰</button>
      </header>
      <nav class="mobile-nav-panel">${mobileNav.map(([label,href,enabled,key]) => `<a href="${enabled ? href : '#'}" class="${active===key?'active ':''}${enabled?'':'nav-disabled'}" ${enabled?'':'onclick="return false" aria-disabled="true"'}>${label}</a>`).join('')}${identity ? `<button class="mobile-signout" type="button">${icon('logout')}Sign out ${esc(displayName || agencyName)}</button>` : ''}<button class="mobile-ask-creature" type="button">${icon("spark")}Ask Creature</button></nav>
      ${status}
      ${identity ? `<div class="top-account-menu" hidden><strong>${esc(displayName || agencyName)}</strong><span>${esc(account?.email || '')}</span><button type="button">${icon('logout')}Sign out</button></div>` : ''}`;

    const toggle=el.querySelector('.mobile-nav-toggle'),panel=el.querySelector('.mobile-nav-panel');
    const closeMobileNav=()=>{panel?.classList.remove('open');toggle?.setAttribute('aria-expanded','false');};
    toggle?.addEventListener('click',()=>{const open=!panel?.classList.contains('open');panel?.classList.toggle('open',open);toggle.setAttribute('aria-expanded',String(open));});
    panel?.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMobileNav));
    el.querySelector('.mobile-ask-creature')?.addEventListener('click',()=>{el.querySelector('.ask-creature')?.click();closeMobileNav();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMobileNav();});
    el.querySelector('.mobile-signout')?.addEventListener('click',signOut);
    const accountButton=el.querySelector('.top-account'),accountMenu=el.querySelector('.top-account-menu');
    accountButton?.addEventListener('click',event=>{event.stopPropagation();const open=accountMenu.hidden;accountMenu.hidden=!open;accountButton.setAttribute('aria-expanded',String(open));});
    accountMenu?.querySelector('button')?.addEventListener('click',signOut);
    document.addEventListener('click',event=>{if(accountMenu&&!accountMenu.hidden&&!accountMenu.contains(event.target)&&!accountButton?.contains(event.target)){accountMenu.hidden=true;accountButton?.setAttribute('aria-expanded','false');}});
  });
})();
