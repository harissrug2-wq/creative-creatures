(async () => {
  try{await window.CCAccount?.ready}catch(error){console.warn('Account hydration before Owner Archetype failed.',error)}
  const app = document.querySelector('#archetypeApp');
  if (!app) return;

  const STORE = {
    get(key, fallback = null) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
    del(key) {
      localStorage.removeItem(key);
    }
  };

  // Explicit free signup must override an older paid plan stored in this browser.
  if (new URLSearchParams(location.search).get('destination')?.replace(/-/g, '_') === 'aofi_free') {
    localStorage.setItem('ccProgramPath', 'aofi_free');
  }

  const PAID_PLANS = ['aofi_free', 'diagnostic', 'accelerator', 'platform', 'fractional_coo'];
  const PLAN_OFFERS = {
    aofi_free: {
      kicker: 'FREE AOFI™ SCORE',
      title: 'Get My Free Agency Owner Freedom Index™ Score',
      subtitle: 'Complete the Agency Diagnostic across Performance, Strength, and Owner Independence. No card required.',
      cta: 'Get My Free AOFI™ Score →'
    },
    diagnostic: {
      kicker: '1:1 DIAGNOSTIC',
      title: 'Start My 1:1 Analysis & Planning Diagnostic',
      subtitle: 'A private, done-with-you analysis of the whole agency.',
      cta: 'Continue to Diagnostic Checkout →'
    },
    accelerator: {
      kicker: 'BREAKTHROUGH ACCELERATOR',
      title: 'Start My Facilitated Breakthrough Accelerator',
      subtitle: 'A facilitated six-session program delivered across 90 days.',
      cta: 'Continue to Accelerator Checkout →'
    },
    platform: {
      kicker: 'PARTNER PORTAL',
      title: 'Start My Platform / Partner Portal',
      subtitle: 'The Agency Intelligence Platform with self-guided setup.',
      cta: 'Continue to Platform Checkout →'
    },
    fractional_coo: {
      kicker: 'FRACTIONAL COO + PLATFORM',
      title: 'Start My Fractional COO + Platform Bundle',
      subtitle: 'Senior operational support plus the platform that runs the plan.',
      cta: 'Continue to Fractional COO Checkout →'
    }
  };

  function normalizePaidPlan(value) {
    const plan = String(value || '').trim().toLowerCase().replace(/-/g, '_');
    return PAID_PLANS.includes(plan) ? plan : 'diagnostic';
  }

  function activeBackendAccount() {
    const account=window.CCAccount?.getAccount?.();
    const id=String(account?.id||'').trim();
    if(!account||!id||id.startsWith('local-')||id.startsWith('lead-'))return null;
    return account;
  }

  function activeEntitledPlan() {
    const account=activeBackendAccount();
    if(!account)return '';
    const plan=normalizePaidPlan(account.accessPlan||account.access_plan||account.journey);
    if(!['diagnostic','accelerator','platform','fractional_coo'].includes(plan))return '';
    return plan;
  }

  const QUESTIONS = [
    { id: 'first_name', type: 'text', text: 'What is your first name?', placeholder: 'First name' },
    { id: 'last_name', type: 'text', text: 'What is your last name?', placeholder: 'Last name' },
    { id: 'agency_website', type: 'text', text: 'What is your agency website URL?', placeholder: 'youragency.com' },
    {
      id: 'archetype_q1', type: 'options', text: 'When your agency is under pressure, what is your default instinct?', options: [
        ['A', 'Jump in and solve the problem myself'],
        ['B', 'Come up with a new angle, idea, or repositioning strategy'],
        ['C', 'Protect the relationship and make sure everyone feels taken care of'],
        ['D', 'Tighten control and make sure things are done right'],
        ['E', 'Look for the bigger opportunity or strategic move forward']
      ]
    },
    {
      id: 'archetype_q2', type: 'options', text: 'What part of running the agency gives you the most energy?', options: [
        ['A', 'Fixing problems and getting things back on track'],
        ['B', 'Creating ideas, offers, branding, or vision'],
        ['C', 'Building trust with clients and team'],
        ['D', 'Improving quality, standards, and execution'],
        ['E', 'Growth strategy, expansion, and future opportunities']
      ]
    },
    {
      id: 'archetype_q3', type: 'options', text: 'What most often slows your agency down because of you?', options: [
        ['A', 'Too much still depends on me'],
        ['B', 'I change direction or start too many things'],
        ['C', 'I avoid hard conversations or tolerate too much'],
        ['D', 'I do not trust others to do it right'],
        ['E', 'I push too many priorities at once']
      ]
    },
    {
      id: 'archetype_q4', type: 'options', text: 'If your agency no longer needed you day to day, what would feel hardest to let go of?', options: [
        ['A', 'Being the one people rely on in hard moments'],
        ['B', 'Being the creator of the ideas and direction'],
        ['C', 'Being personally connected to everyone'],
        ['D', 'Being the one who ensures quality and control'],
        ['E', 'Being the one who sees what is next and drives the business forward']
      ]
    },
    {
      id: 'stage_q5', type: 'options', text: 'Which statement best describes your agency right now?', options: [
        ['A', 'We are still trying to create consistent revenue and stability'],
        ['B', 'We have momentum, but a lot still depends on the founder'],
        ['C', 'We are growing, but things feel messy and inconsistent'],
        ['D', 'We have enough clients and team, but complexity is creating strain'],
        ['E', 'We are stable, but growth has slowed or become harder'],
        ['F', 'We are intentionally building leadership, systems, and scale capacity'],
        ['G', 'The business can perform with strong leadership and limited founder dependence']
      ]
    },
    {
      id: 'stage_q6', type: 'options', text: "What best describes the founder's current role in the business?", options: [
        ['A', 'I do almost everything'],
        ['B', 'I still sell, solve, and deliver a lot personally'],
        ['C', 'I lead a team, but many key decisions still come through me'],
        ['D', 'I am often the bottleneck for approvals, people, or clients'],
        ['E', 'I am trying to step back, but the business is not fully ready'],
        ['F', 'I am focused mostly on leadership, strategy, and building systems'],
        ['G', 'I could step away for a period and the business would still operate well']
      ]
    },
    {
      id: 'stage_q7', type: 'options', text: 'Which statement best describes your systems and team?', options: [
        ['A', 'Very little is documented or repeatable yet'],
        ['B', 'Some processes exist, but execution depends on key people'],
        ['C', 'We have people and process, but inconsistency is still common'],
        ['D', 'The team is capable, but accountability and coordination are weak'],
        ['E', 'We have structure, but it is getting harder to scale efficiently'],
        ['F', 'We are building a true management layer and clearer operating rhythm'],
        ['G', 'Most major functions run through accountable leaders with clear metrics']
      ]
    },
    {
      id: 'stage_q8', type: 'options', text: 'Which of these feels most true about the business as an asset?', options: [
        ['A', 'Right now, it is mostly a job I own'],
        ['B', 'It has value, but it still depends heavily on me'],
        ['C', 'It is growing, but not predictably enough yet'],
        ['D', 'It is a real business, but not yet easy to scale'],
        ['E', 'It is stable, but not yet highly transferable or optimized'],
        ['F', 'It is becoming more transferable and valuable'],
        ['G', 'It is increasingly operating like an asset, not just an owner-led company']
      ]
    },
    { id: 'business_start_year', type: 'text', text: 'What year did you start your agency?', placeholder: 'e.g. 2018' },
    {
      id: 'annual_revenue', type: 'options', text: 'Which best describes the annual revenue your agency is generating right now?', options: [
        ['under_1m', 'Under $1M'],
        ['between_1m_2m', 'Between $1M and $2M'],
        ['between_2m_3m', 'Between $2M and $3M'],
        ['over_3m', 'Over $3M']
      ]
    }
  ];

  const ARCHETYPES = {
    A: {
      title: 'The Firefighter Founder',
      constraint: 'Owner-dependent problem solving',
      constraintCopy: 'The agency still looks to you when pressure rises. Important problems wait for your intervention.',
      desired: 'Build leaders who can stabilize the business',
      desiredCopy: 'Owner freedom, resilient leadership, and an agency that can solve problems without rescue.'
    },
    B: {
      title: 'The Creative Wizard',
      constraint: 'Owner-dependent delivery',
      constraintCopy: 'Senior work still flows through you. Clients ask for you by name.',
      desired: 'Build an agency that runs without you',
      desiredCopy: 'Owner freedom, sale-readiness, and repeatable senior craft.'
    },
    C: {
      title: 'The People-First Builder',
      constraint: 'Relationship-dependent decisions',
      constraintCopy: 'Care and loyalty are strengths, but hard decisions can arrive late or stay with you.',
      desired: 'Build accountability without losing trust',
      desiredCopy: 'A healthy culture with clear standards, direct feedback, and distributed ownership.'
    },
    D: {
      title: 'The Control Builder',
      constraint: 'Approval and quality bottlenecks',
      constraintCopy: 'Standards remain concentrated in your judgment, so progress slows when you are unavailable.',
      desired: 'Build systems you can trust',
      desiredCopy: 'Consistent quality through leaders, operating standards, and evidence-based accountability.'
    },
    E: {
      title: 'The Vision Chaser',
      constraint: 'Too many founder-led priorities',
      constraintCopy: 'The agency can move quickly, but teams struggle when priorities change before work compounds.',
      desired: 'Turn vision into focused execution',
      desiredCopy: 'A clear sequence of priorities with operators who can convert direction into durable results.'
    }
  };

  const route = () => location.pathname.replace(/\/+$/, '');
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);

  const makeId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const logo = () => `<a class="archetype-brand aofi-journey-brand" href="/" aria-label="Agency Owner Freedom Index"><span class="aofi-brand-mark">AOFI™</span><span class="aofi-brand-copy">Agency Owner<br>Freedom Index™</span></a>`;

  function navigate(path, replace = false) {
    const target = `/owner-archetype${path}`;
    if (replace) history.replaceState({}, '', target);
    else history.pushState({}, '', target);
    render();
  }

  function readReport() {
    return STORE.get('ownerArchetypeReportData');
  }

  function resetAssessment() {
    ['cc_archetype_answers', 'cc_archetype_index', 'ownerArchetypeReportData', 'ownerArchetypeReportToken', 'ownerIdentityComplete'].forEach(key => STORE.del(key));
  }

  function landing() {
    document.onkeydown = null;
    app.innerHTML = `
      <header class="archetype-header">${logo()}<a class="back-link" href="/login/">Back to sign in</a></header>
      <section class="hero identity-hero">
        <div class="hero-inner">
          <h1>Get Your AOFI™ Score<br>and Understand Your Agency Value</h1>
          <p>We start with Owner Identity because the way you lead shapes how your agency scales, performs, and operates without you.</p>
          <p class="identity-ceiling">The Agency Owner Freedom Index™ is a 0–100 score that shows how scalable, financially healthy, owner-independent and valuable your agency is becoming.</p>
          <div class="identity-lookup-wrap">
            <div data-owner-identity-lookup></div>
            <button class="cta identity-start-assessment" id="startArchetype">Start My AOFI™ Journey →</button>
          </div>
        </div>
      </section>`;
    window.CCOwnerIdentityLookup?.mountAll?.();
    document.querySelector('#startArchetype')?.addEventListener('click', () => {
      resetAssessment();
      STORE.set('cc_archetype_index', 0);
      navigate('/assessment');
    });
  }

  function assessment() {
    const params = new URLSearchParams(location.search);
    if (params.get('retake') === '1') {
      resetAssessment();
      history.replaceState({}, '', '/owner-archetype/assessment');
    }

    let index = Number(STORE.get('cc_archetype_index', 0));
    if (!Number.isFinite(index) || index < 0 || index >= QUESTIONS.length) index = 0;
    let answers = STORE.get('cc_archetype_answers', {});

    const draw = () => {
      const q = QUESTIONS[index];
      const value = answers[q.id] ?? '';
      const progress = ((index + 1) / QUESTIONS.length) * 100;
      const isLast = index === QUESTIONS.length - 1;
      const input = q.type === 'text'
        ? `<input class="text-answer" id="textAnswer" type="text" value="${escapeHtml(value)}" placeholder="${escapeHtml(q.placeholder || '')}" autocomplete="${q.id.includes('name') ? 'name' : 'off'}">`
        : `<div class="answers">${q.options.map(([id, text], optionIndex) => `
            <button class="answer ${value === id ? 'selected' : ''}" type="button" data-answer="${escapeHtml(id)}">
              <span class="letter">${String.fromCharCode(65 + optionIndex)}</span><span>${escapeHtml(text)}</span>
            </button>`).join('')}</div>`;

      app.innerHTML = `
        <main class="assessment-page">
          <div class="assessment-progress" aria-label="Assessment progress"><span style="width:${progress}%"></span></div>
          <section class="assessment-main">
            <div class="question-count">Question ${String(index + 1).padStart(2, '0')} / ${QUESTIONS.length}</div>
            <h1>${escapeHtml(q.text)}</h1>
            ${input}
            <div class="inline-error" id="questionError" hidden></div>
            <div class="assessment-actions">
              <button class="nav-btn" id="backQuestion" type="button" ${index === 0 ? 'disabled' : ''}>← Back</button>
              <button class="nav-btn primary" id="nextQuestion" type="button" ${String(value).trim() ? '' : 'disabled'}>${isLast ? 'Next →' : 'Next →'}</button>
            </div>
            <div class="enter-hint">Press Enter ↵ to Continue</div>
          </section>
        </main>`;

      document.querySelectorAll('[data-answer]').forEach(button => {
        button.addEventListener('click', () => {
          answers[q.id] = button.dataset.answer;
          STORE.set('cc_archetype_answers', answers);
          draw();
        });
      });

      const enterHandler = event => {
        if (event.key === 'Enter' && !event.shiftKey) {
          const next = document.querySelector('#nextQuestion');
          if (next && !next.disabled) { event.preventDefault(); next.click(); }
        }
      };
      document.onkeydown = enterHandler;

      const textAnswer = document.querySelector('#textAnswer');
      if (textAnswer) {
        textAnswer.focus();
        textAnswer.setSelectionRange(textAnswer.value.length, textAnswer.value.length);
        textAnswer.addEventListener('input', event => {
          answers[q.id] = event.target.value;
          STORE.set('cc_archetype_answers', answers);
          document.querySelector('#nextQuestion').disabled = !event.target.value.trim();
        });
        textAnswer.addEventListener('keydown', event => {
          if (event.key === 'Enter' && event.target.value.trim()) document.querySelector('#nextQuestion').click();
        });
      }

      document.querySelector('#backQuestion')?.addEventListener('click', () => {
        if (index === 0) return;
        index -= 1;
        STORE.set('cc_archetype_index', index);
        draw();
      });

      document.querySelector('#nextQuestion')?.addEventListener('click', () => {
        const current = String(answers[q.id] ?? '').trim();
        if (q.id === 'business_start_year') {
          const year = Number(current), now = new Date().getFullYear();
          if (!/^\d{4}$/.test(current) || year < 1900 || year > now) {
            const error = document.querySelector('#questionError');
            error.textContent = `Enter a valid four-digit year between 1900 and ${now}.`;
            error.hidden = false;
            return;
          }
        }
        if (!current) {
          const error = document.querySelector('#questionError');
          error.textContent = 'Please answer this question before continuing.';
          error.hidden = false;
          return;
        }
        if (isLast) {
          captureEmail(answers);
          return;
        }
        index += 1;
        STORE.set('cc_archetype_index', index);
        draw();
      });
    };

    draw();
  }


  function captureEmail(answers) {
    const existingEmail = String(localStorage.getItem('ccOwnerEmail') || window.CCAccount?.getAccount?.()?.email || '').trim();
    app.innerHTML = `
      <main class="assessment-page account-capture-page">
        <div class="assessment-progress" aria-label="Assessment progress"><span style="width:100%"></span></div>
        <section class="assessment-main account-capture-main">
          <div class="question-count">Your account</div>
          <h1>Where should we email your Owner Identity Report?</h1>
          <p class="account-capture-copy">We’ll email the detailed report and then continue you toward your AOFI™ Score. Use the email you’ll use when you return.</p>
          <label class="account-email-label" for="ownerEmail">Email address</label>
          <input class="text-answer account-email-input" id="ownerEmail" type="email" value="${escapeHtml(existingEmail)}" placeholder="you@youragency.com" autocomplete="email">
          <div class="inline-error" id="questionError" hidden></div>
          <div class="assessment-actions">
            <button class="nav-btn" id="backToLastQuestion" type="button">← Back</button>
            <button class="nav-btn primary" id="saveOwnerReport" type="button" ${existingEmail ? '' : 'disabled'}>Email My Report &amp; Continue →</button>
          </div>
          <div class="enter-hint">Press Enter ↵ to Continue</div>
          <div class="account-privacy">Your report and questionnaire answers are saved to your Creative Creatures account.</div>
        </section>
      </main>`;

    const input = document.querySelector('#ownerEmail');
    const submit = document.querySelector('#saveOwnerReport');
    const error = document.querySelector('#questionError');
    const validEmail = value => /^\S+@\S+\.\S+$/.test(String(value || '').trim());
    input?.focus();
    input?.addEventListener('input', () => {
      submit.disabled = !validEmail(input.value);
      error.hidden = true;
    });
    input?.addEventListener('keydown', event => {
      if (event.key === 'Enter' && validEmail(input.value)) submit.click();
    });
    document.querySelector('#backToLastQuestion')?.addEventListener('click', () => assessment());
    submit?.addEventListener('click', () => {
      const email = String(input.value || '').trim().toLowerCase();
      if (!validEmail(email)) {
        error.textContent = 'Enter a valid email address.';
        error.hidden = false;
        return;
      }
      localStorage.setItem('ccOwnerEmail', email);
      completeAssessment(answers, email);
    });
  }

  function agencyNameFromWebsite(value) {
    const clean = String(value || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    if (!clean) return 'My Agency';
    const name = clean.split('.')[0].replace(/[-_]+/g, ' ');
    return name.replace(/\b\w/g, char => char.toUpperCase());
  }

  function determineArchetype(answers) {
    const counts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    ['archetype_q1', 'archetype_q2', 'archetype_q3', 'archetype_q4'].forEach(key => {
      if (counts[answers[key]] !== undefined) counts[answers[key]] += 1;
    });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))[0] || 'B';
  }

  function ownerLeadPayloadFromReport(report, destination = 'diagnostic') {
    return {
      name: `${report?.firstName || ''} ${report?.lastName || ''}`.trim() || 'Agency Owner',
      firstName: report?.firstName || '',
      lastName: report?.lastName || '',
      email: String(report?.email || '').trim().toLowerCase(),
      agencyUrl: report?.agencyWebsite || '',
      agencyName: report?.agencyName || agencyNameFromWebsite(report?.agencyWebsite || ''),
      journey: destination,
      source: 'owner-archetype',
      archetypeAnswers: report?.answers || {},
      archetypeResult: {
        key: report?.archetypeKey || '',
        title: report?.archetypeTitle || '',
        primaryConstraint: report?.primaryConstraint || '',
        desiredPath: report?.desiredPath || ''
      },
      reportData: report || {},
      diagnosticState: { indexes: {}, count: 0, allComplete: false, reportReady: false }
    };
  }

  async function persistOwnerLead(payload, attempts = 3) {
    let lastError = null;
    const currentAccount = window.CCAccount?.getAccount?.();
    const currentId = String(currentAccount?.id || '').trim();
    const currentEmail = String(currentAccount?.email || '').trim().toLowerCase();
    const payloadEmail = String(payload?.email || '').trim().toLowerCase();

    // Paid/admin-provisioned users already own a workspace. Saving their
    // Owner Identity must enrich that existing account instead of creating a
    // separate lead that would require another signup/payment lookup.
    if (currentId && !currentId.startsWith('local-') && !currentId.startsWith('lead-') &&
        currentEmail && currentEmail === payloadEmail && window.CCAccount?.updateOwnerIdentity) {
      try {
        const account = await window.CCAccount.updateOwnerIdentity(payload);
        localStorage.setItem('ownerArchetypeLeadSaved', 'true');
        localStorage.removeItem('ownerArchetypeLeadError');
        return account;
      } catch (error) {
        lastError = error;
      }
    }
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        if (window.CCAccount?.createOwnerArchetypeLead) {
          const result = await window.CCAccount.createOwnerArchetypeLead(payload);
          localStorage.setItem('ownerArchetypeLeadSaved', 'true');
          localStorage.removeItem('ownerArchetypeLeadError');
          return result;
        }
        const response = await fetch('/api/owner-archetype-leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Owner Archetype history could not be saved.');
        localStorage.setItem('ownerArchetypeLeadSaved', 'true');
        localStorage.removeItem('ownerArchetypeLeadError');
        return data;
      } catch (error) {
        lastError = error;
        if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 450 * attempt));
      }
    }
    localStorage.setItem('ownerArchetypeLeadSaved', 'false');
    localStorage.setItem('ownerArchetypeLeadError', String(lastError?.message || 'Owner Archetype history could not be saved.'));
    throw lastError || new Error('Owner Archetype history could not be saved.');
  }

  function completeAssessment(answers, ownerEmail) {
    const key = determineArchetype(answers);
    const archetype = ARCHETYPES[key];
    const reportToken = makeId('local-report');
    const reportId = `CC-ARCH-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const agencyName = agencyNameFromWebsite(answers.agency_website);
    const report = {
      token: reportToken,
      reportId,
      firstName: String(answers.first_name || '').trim(),
      lastName: String(answers.last_name || '').trim(),
      agencyWebsite: String(answers.agency_website || '').trim(),
      agencyName,
      email: ownerEmail,
      annualRevenue: answers.annual_revenue || '',
      businessStartYear: answers.business_start_year || '',
      archetypeKey: key,
      archetypeTitle: archetype.title,
      primaryConstraint: archetype.constraint,
      primaryConstraintCopy: archetype.constraintCopy,
      desiredPath: archetype.desired,
      desiredPathCopy: archetype.desiredCopy,
      completedAt: new Date().toISOString(),
      answers
    };
    const requestedDestination = new URLSearchParams(location.search).get('destination') || localStorage.getItem('ccProgramPath') || 'diagnostic';
    const destination = activeEntitledPlan() || normalizePaidPlan(requestedDestination);
    ownerEmail = String(ownerEmail || localStorage.getItem('ccOwnerEmail') || '').trim().toLowerCase();
    localStorage.setItem('ccOwnerEmail', ownerEmail);
    const account = {
      id: makeId('cc-user'),
      firstName: report.firstName,
      lastName: report.lastName,
      displayName: `${report.firstName} ${report.lastName}`.trim(),
      agencyName,
      agencyWebsite: report.agencyWebsite,
      email: ownerEmail,
      program: destination,
      status: 'active',
      createdAt: new Date().toISOString(),
      profileSource: 'owner-archetype'
    };

    STORE.set('ownerArchetypeReportData', report);
    localStorage.setItem('ownerArchetypeReportToken', reportToken);
    localStorage.setItem('ownerIdentityComplete', 'true');
    STORE.set('ccUserAccount', account);
    const accountList = STORE.get('ccAccounts', []);
    const withoutDuplicate = accountList.filter(item => item.agencyWebsite !== account.agencyWebsite || item.displayName !== account.displayName);
    withoutDuplicate.push(account);
    STORE.set('ccAccounts', withoutDuplicate);
    localStorage.setItem('ccAccountCreated', 'true');
    localStorage.setItem('ccSignedIn', 'true');
    localStorage.setItem('ccProgramPath', destination);
    localStorage.setItem('ccOwnerFirstName', report.firstName);
    localStorage.setItem('ccOwnerLastName', report.lastName);
    localStorage.setItem('ccAgencyWebsite', report.agencyWebsite);
    localStorage.setItem('ccAgencyName', report.agencyName);
    window.CCArchetypePDF?.ensureReportToken?.().catch(() => null);
    STORE.del('cc_archetype_index');
    STORE.del('cc_archetype_answers');

    app.innerHTML = `
      <main class="processing-screen">
        ${logo()}
        <section class="processing-card">
          <div class="spinner"></div>
          <h1>Creating your account and Owner Identity Report…</h1>
          <p>We are saving your Owner Identity result and preparing your selected Creative Creatures plan.</p>
        </section>
      </main>`;
    const syncPayload = ownerLeadPayloadFromReport(report, destination);
    const destinationPath = `/owner-archetype/report/${encodeURIComponent(reportToken)}/`;
    (async () => {
      try {
        await persistOwnerLead(syncPayload);
      } catch (error) {
        console.error('Owner Archetype lead save failed.', error);
        app.innerHTML = `
          <main class="processing-screen">
            ${logo()}
            <section class="processing-card">
              <h1>We could not save your Owner Archetype history.</h1>
              <p>${escapeHtml(error?.message || 'Please retry the save before continuing.')}</p>
              <button class="nav-btn primary" id="retryOwnerLeadSave" type="button">Retry Save →</button>
            </section>
          </main>`;
        document.querySelector('#retryOwnerLeadSave')?.addEventListener('click', () => completeAssessment(answers, ownerEmail));
        return;
      }

      localStorage.setItem('ownerArchetypeEmailStatus', 'sending');
      if (window.CCArchetypePDF?.emailReport) {
        try {
          await window.CCArchetypePDF.emailReport(ownerEmail, { firstName: report.firstName });
          localStorage.setItem('ownerArchetypeEmailStatus', 'sent');
          localStorage.removeItem('ownerArchetypeEmailError');
        } catch (error) {
          console.error('Owner Identity report email failed.', error);
          localStorage.setItem('ownerArchetypeEmailStatus', 'failed');
          localStorage.setItem('ownerArchetypeEmailError', String(error?.message || 'Email delivery failed.'));
        }
      } else {
        localStorage.setItem('ownerArchetypeEmailStatus', 'failed');
        localStorage.setItem('ownerArchetypeEmailError', 'Email delivery service is unavailable.');
      }
      setTimeout(() => { location.href = destinationPath; }, 350);
    })();
  }

  function report(token) {
    let data = readReport();
    if (!data && localStorage.getItem('ownerIdentityComplete') === 'true') {
      const fallback = ARCHETYPES.B;
      data = {
        token: token || localStorage.getItem('ownerArchetypeReportToken') || makeId('local-report'),
        reportId: 'CC-ARCH-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        firstName: localStorage.getItem('ccOwnerFirstName') || 'Owner',
        agencyWebsite: localStorage.getItem('ccAgencyWebsite') || '',
        email: localStorage.getItem('ccOwnerEmail') || '',
        archetypeKey: 'B', archetypeTitle: fallback.title,
        primaryConstraint: fallback.constraint, primaryConstraintCopy: fallback.constraintCopy,
        desiredPath: fallback.desired, desiredPathCopy: fallback.desiredCopy
      };
      STORE.set('ownerArchetypeReportData', data);
    }
    if (!data) {
      app.innerHTML = `<main class="report-page">${logo()}<section class="missing-report"><h1>Your report is not available in this browser.</h1><p>Retake the questionnaire to create a new Owner Identity Report.</p><a class="nav-btn primary" href="/owner-archetype/assessment?retake=1">Retake</a></section></main>`;
      return;
    }

    // Repair older/browser-only completions automatically. This is intentionally
    // fire-and-forget on the report screen: it restores admin history without
    // blocking the user from viewing their existing report.
    if (data.email && data.agencyWebsite && data.answers && localStorage.getItem('ownerArchetypeLeadSaved') !== 'true') {
      persistOwnerLead(ownerLeadPayloadFromReport(data, localStorage.getItem('ccProgramPath') || 'diagnostic'), 2)
        .catch(error => console.warn('Owner Archetype history recovery failed.', error));
    }

    const summaryView = new URLSearchParams(location.search).get('view') === 'summary';
    if (summaryView) {
      app.innerHTML = `
        <main class="report-page">
          ${logo()}
          <section class="report-progress" aria-label="Owner identity report steps">
            <div class="report-step complete"><span>✓</span><b>Basics</b></div><i></i>
            <div class="report-step complete"><span>✓</span><b>Quiz</b></div><i></i>
            <div class="report-step current"><span>3</span><b>Report</b></div>
          </section>
          <section class="report-intro">
            <h1>Your Owner Identity Report</h1>
            <p>This report was created from your Owner Identity (Archetype) questionnaire and is the owner-context layer used in your Agency Diagnostic.</p>
          </section>
          <article class="archetype-report-card">
            <header>
              <span class="report-kicker">✣ &nbsp;Your archetype</span>
              <h2>${escapeHtml(data.archetypeTitle)}</h2>
              <p>${escapeHtml(reportSummary(data.archetypeKey))}</p>
            </header>
            <div class="report-insights">
              <section><span>◎ &nbsp;Primary constraint</span><h3>${escapeHtml(data.primaryConstraint)}</h3><p>${escapeHtml(data.primaryConstraintCopy)}</p></section>
              <section><span>◉ &nbsp;Desired path</span><h3>${escapeHtml(data.desiredPath)}</h3><p>${escapeHtml(data.desiredPathCopy)}</p></section>
            </div>
            <footer><code>Report ID · ${escapeHtml(data.reportId || '')}</code></footer>
          </article>
          <a class="report-home" href="/diagnostic/">← Back to Agency Diagnostic</a>
        </main>`;
      return;
    }

    const firstName = data.firstName || localStorage.getItem('ccOwnerFirstName') || 'there';
    const email = data.email || localStorage.getItem('ccOwnerEmail') || 'your email address';
    const emailStatus = localStorage.getItem('ownerArchetypeEmailStatus') || 'unknown';
    const entitledPlan = activeEntitledPlan();
    const selectedPlan = entitledPlan || normalizePaidPlan(localStorage.getItem('ccProgramPath'));
    const hasActivePaidWorkspace = Boolean(entitledPlan);
    const freeAofi = selectedPlan === 'aofi_free';
    const emailCopy = emailStatus === 'sent'
      ? `Your detailed Owner Identity Report has been emailed to <strong>${escapeHtml(email)}</strong>.`
      : `Your Owner Identity Report is ready. We could not confirm email delivery to <strong>${escapeHtml(email)}</strong>; you can retry below.`;

    app.innerHTML = `
      <main class="report-page identity-report-page compact-identity-complete">
        ${logo()}
        <section class="identity-complete-card">
          <span class="identity-section-label">OWNER IDENTITY COMPLETE</span>
          <div class="identity-complete-check">✓</div>
          <h1>Nice work, ${escapeHtml(firstName)}.</h1>
          <p>Your Owner Identity is the first layer of your AOFI™ Score. ${emailCopy}</p>
          ${emailStatus !== 'sent' ? '<button class="nav-btn" id="retryIdentityEmail" type="button">Email Report Again</button><p id="identityEmailRetryStatus" class="identity-email-status"></p>' : ''}
          <div class="identity-next-compact">
            <strong>Next: establish your Agency Owner Freedom Index™ Score</strong>
            <span>Continue into the three agency assessments that measure Strength, Owner Independence, and Financial Performance.</span>
          </div>
          <button class="nav-btn primary identity-continue" id="continueIdentity">
            ${hasActivePaidWorkspace ? 'Continue to Agency Diagnostic →' : freeAofi ? 'Get My Free AOFI™ Score →' : 'Continue to Payment →'}
          </button>
        </section>
      </main>`;

    document.getElementById('retryIdentityEmail')?.addEventListener('click', async event => {
      const button = event.currentTarget, status = document.getElementById('identityEmailRetryStatus');
      button.disabled = true; button.textContent = 'Sending…'; if(status)status.textContent='';
      try {
        await window.CCArchetypePDF?.emailReport?.(email);
        localStorage.setItem('ownerArchetypeEmailStatus','sent');
        if(status)status.textContent=`Report sent to ${email}.`;
        button.textContent='Sent ✓';
      } catch(error) {
        if(status)status.textContent=error?.message||'The email could not be sent.';
        button.disabled=false; button.textContent='Email Report Again';
      }
    });

    document.querySelector('#continueIdentity')?.addEventListener('click', async event => {
      if(hasActivePaidWorkspace){
        localStorage.setItem('ccProgramPath',selectedPlan);
        location.href='/diagnostic/';
        return;
      }
      if(!freeAofi){
        localStorage.setItem('ccProgramPath',selectedPlan);
        location.href='/payment/?plan='+encodeURIComponent(selectedPlan)+'&source=owner-identity&email='+encodeURIComponent(data.email||'');
        return;
      }
      const button=event.currentTarget;
      button.disabled=true;button.textContent='Creating your free account…';
      try{
        const response=await fetch('/api/accounts',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          name:[data.firstName,data.lastName].filter(Boolean).join(' ')||'Agency Owner',
          email:data.email,agencyUrl:data.agencyWebsite,agencyName:data.agencyName||agencyNameFromWebsite(data.agencyWebsite),
          accessPlan:'aofi_free',journey:'aofi_free',source:'aofi-free',
          archetypeAnswers:data.answers||{},
          archetypeResult:{key:data.archetypeKey||'',title:data.archetypeTitle||'',primaryConstraint:data.primaryConstraint||'',desiredPath:data.desiredPath||''},
          reportData:data,diagnosticState:{indexes:{},count:0,allComplete:false,reportReady:false}
        })});
        const result=await response.json().catch(()=>({}));
        if(!response.ok||!result.account){
          if(result.code==='ACCOUNT_EXISTS'&&result.loginUrl){location.href=result.loginUrl;return}
          throw new Error(result.error||'Your free AOFI™ account could not be created.');
        }
        window.CCAccount?.saveAccount?.({...result.account,backend_saved:true},{forceReset:true,replaceDiagnostic:true});
        localStorage.setItem('ccProgramPath','aofi_free');localStorage.setItem('ccSignedIn','true');
        location.href='/diagnostic/';
      }catch(error){
        button.disabled=false;button.textContent='Get My Free AOFI™ Score →';
        alert(error.message||'Your free AOFI™ account could not be created.');
      }
    });
  }

  function reportSummary(key) {
    const summaries = {
      A: 'You lead by restoring stability. The gift that built the agency is also the ceiling when every difficult moment still routes back through you.',
      B: 'You lead with craft. Clients hire you because the work carries your fingerprints. The gift that built the agency is also the ceiling — the business struggles to grow beyond what you can personally touch.',
      C: 'You lead through trust and relationships. The gift that holds the team together can become a ceiling when accountability depends on your emotional labor.',
      D: 'You lead through standards and control. The quality you protect can become a ceiling when the agency cannot move without your approval.',
      E: 'You lead through vision and possibility. The energy that creates growth can become a ceiling when priorities change faster than the team can compound progress.'
    };
    return summaries[key] || summaries.B;
  }

  function render() {
    const current = route();
    if (current.endsWith('/assessment')) assessment();
    else if (current.includes('/report/')) report(current.split('/').pop());
    else landing();
  }

  window.addEventListener('popstate', render);
  render();
})();
