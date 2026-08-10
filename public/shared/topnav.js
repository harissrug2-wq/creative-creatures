(() => {
  const icon = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const icons = {
    monitor: icon('<path d="M3 12h4l2-7 4 14 2-7h6"/>'),
    diagnostic: icon('<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4"/><circle cx="12" cy="12" r="3"/>'),
    score: icon('<path d="M4 19V9M10 19V5M16 19v-7M22 19V2"/>'),
    goals: icon('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
    plug: icon('<path d="M12 22v-5M9 8V2M15 8V2M7 8h10v3a5 5 0 0 1-10 0z"/>'),
    portal: icon('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'),
    spark: icon('<path d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
    menu: icon('<path d="M4 6h16M4 12h16M4 18h16"/>')
  };

  const active = document.body.dataset.topnav || '';
  const bool = (key) => localStorage.getItem(key) === 'true';
  const ownerIdentityReady = Boolean(localStorage.getItem('ownerArchetypeReportToken') || bool('ownerIdentityComplete') || true);
  const paymentReady = Boolean(bool('agencyPaymentComplete') || true);
  const integrationsReady = bool('agencyIntegrationsComplete');
  const strengthReady = localStorage.getItem('agencyStrengthScore') !== null;
  const ownerReady = localStorage.getItem('ownerIndependenceScore') !== null;
  let performanceReady = false;
  try {
    const details = JSON.parse(localStorage.getItem('agencyPerformanceDetails') || 'null');
    performanceReady = Boolean(localStorage.getItem('agencyPerformanceScore') && details?.completed === true);
  } catch {}
  const scorecardGenerated = bool('agencyScorecardGenerated') || bool('diagnosticComplete');
  const diagnosticReady = ownerIdentityReady && paymentReady && integrationsReady && scorecardGenerated;

  const links = [
    ['monitor', '/platform/', 'Monitor', icons.monitor],
    ['diagnostic', '/diagnostic/', 'Diagnostic', icons.diagnostic],
    ['scorecard', '/agency-scorecard/', 'Agency Scorecard', icons.score],
    ['goals', '/agency-goals/', 'Agency Goals', icons.goals],
    ['integrations', '/integrations/', 'Integrations', icons.plug],
    ['portal', '#', 'Portal', icons.portal]
  ];

  const isLocked = (key) => {
    if (key === 'scorecard' || key === 'goals') return !scorecardGenerated && !integrationsReady && !performanceReady;
    if (key === 'monitor') return !bool('agencyGoalsComplete') && active !== 'monitor';
    if (key === 'portal') return true;
    return false;
  };

  const lockMessage = (key) => {
    if (key === 'scorecard' || key === 'goals') return 'Complete your integrations and financial data upload to view the Agency Scorecard.';
    if (key === 'monitor') return 'Finish Agency Goals and 90 Day Priorities to unlock Monitor.';
    return 'Portal is not active in this release.';
  };

  const linkHtml = links.map(([key, href, label, svg]) => {
    const locked = isLocked(key);
    const cls = `cc-nav-link ${active === key ? 'active' : ''} ${locked ? 'locked' : ''}`;
    return `<a class="${cls}" href="${href}" ${locked ? `data-cc-locked="${key}" aria-disabled="true"` : ''}>${svg}<span>${label}</span></a>`;
  }).join('');

  const host = document.querySelector('[data-cc-topbar]');
  if (!host) return;
  host.innerHTML = `<header class="cc-topbar"><button class="cc-menu-toggle" aria-label="Open navigation">${icons.menu}</button><a class="cc-brand" href="/platform/"><img src="/monitor/creative-creatures-logo.png" alt="Creative Creatures"></a><div class="cc-mobile-title">Creative Creatures</div><nav class="cc-topnav">${linkHtml}</nav><div class="cc-actions"><button class="cc-ask" type="button" data-cc-ask>${icons.spark}<span>Ask Creature</span></button></div></header><nav class="cc-mobile-panel">${linkHtml}</nav><div class="cc-lock-tip" role="status"></div>`;

  const panel = host.querySelector('.cc-mobile-panel');
  host.querySelector('.cc-menu-toggle')?.addEventListener('click', () => panel.classList.toggle('open'));
  const tip = host.querySelector('.cc-lock-tip');
  const show = (text) => {
    tip.textContent = text;
    tip.classList.add('show');
    clearTimeout(window.__ccTip);
    window.__ccTip = setTimeout(() => tip.classList.remove('show'), 2800);
  };

  host.querySelectorAll('[data-cc-locked]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const key = a.dataset.ccLocked;
    show(lockMessage(key));
    if (key === 'scorecard' || key === 'goals') setTimeout(() => location.href = '/diagnostic/?locked=' + key, 650);
  }));

  host.querySelector('[data-cc-ask]')?.addEventListener('click', () => show('Ask Creature requires the conversational backend.'));

  // Phase 3 Horizontal Status Bar
  const states = [ownerIdentityReady, paymentReady, integrationsReady, strengthReady || integrationsReady, ownerReady || integrationsReady, performanceReady || scorecardGenerated, scorecardGenerated];
  const labels = ['Identity Assessment', 'Payment', 'Integrations', 'Operations', 'Owner Dependency', 'Financial Performance', 'Diagnostic Ready'];
  
  // Determine current active step based on active page route
  const pathname = window.location.pathname;
  let activeStepIndex = 2; // Default Integrations (Step 3)
  if (pathname.includes('/integrations')) activeStepIndex = 2;
  else if (pathname.includes('/diagnostic')) activeStepIndex = 5; // Financial Performance
  else if (pathname.includes('/agency-scorecard') || pathname.includes('/agency-goals')) activeStepIndex = 6; // Diagnostic Ready

  const status = document.createElement('section');
  status.className = 'cc-flow-status';
  status.setAttribute('aria-label', 'Diagnostic progress');
  status.innerHTML = `<div class="cc-flow-track">${labels.map((label, index) => {
    const isCompleted = index < activeStepIndex || (index === 2 && integrationsReady) || states[index];
    const isCurrent = index === activeStepIndex;
    const cls = isCompleted ? 'complete' : isCurrent ? 'current' : '';
    return `<div class="cc-flow-step ${cls}"><span class="cc-flow-dot">${isCompleted ? '✓' : index + 1}</span><span>${label}</span></div>`;
  }).join('')}</div>`;
  host.appendChild(status);
})();
