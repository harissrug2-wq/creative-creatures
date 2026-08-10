(() => {
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

  const logo = () => `<a class="archetype-brand" href="/"><img src="/monitor/creative-creatures-logo.png" alt="Creative Creatures"></a>`;

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
    app.innerHTML = `
      <header class="archetype-header">${logo()}<a class="back-link" href="/">Back to sign in</a></header>
      <section class="hero">
        <div class="hero-inner">
          <span class="pill">Owner Identity · Free</span>
          <h1>Learn how owner identity impacts the agency you are trying to build and its value.</h1>
          <p>The agency you are building is shaped by your patterns as an owner: how you decide, how you lead, and what your team still needs from you.</p>
          <button class="cta" id="startArchetype">Get My Owner Identity Report →</button>
          <div class="meta">About 3 minutes · 12 questions</div>
        </div>
      </section>`;
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
              <button class="nav-btn primary" id="nextQuestion" type="button" ${String(value).trim() ? '' : 'disabled'}>${isLast ? 'Reveal my archetype →' : 'Continue →'}</button>
            </div>
          </section>
        </main>`;

      document.querySelectorAll('[data-answer]').forEach(button => {
        button.addEventListener('click', () => {
          answers[q.id] = button.dataset.answer;
          STORE.set('cc_archetype_answers', answers);
          draw();
        });
      });

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
          <h1>Where should we save your Owner Archetype Report?</h1>
          <p class="account-capture-copy">Use the email you will use when you return. Your agency URL and this email can both find the same account later.</p>
          <label class="account-email-label" for="ownerEmail">Email address</label>
          <input class="text-answer account-email-input" id="ownerEmail" type="email" value="${escapeHtml(existingEmail)}" placeholder="you@youragency.com" autocomplete="email">
          <div class="inline-error" id="questionError" hidden></div>
          <div class="assessment-actions">
            <button class="nav-btn" id="backToLastQuestion" type="button">← Back</button>
            <button class="nav-btn primary" id="saveOwnerReport" type="button" ${existingEmail ? '' : 'disabled'}>Reveal my archetype →</button>
          </div>
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
    const destination = ['platform', 'diagnostic', 'accelerator'].includes(requestedDestination) ? requestedDestination : 'diagnostic';
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
    STORE.del('cc_archetype_index');
    STORE.del('cc_archetype_answers');

    app.innerHTML = `
      <main class="processing-screen">
        ${logo()}
        <section class="processing-card">
          <div class="spinner"></div>
          <h1>Creating your account and report…</h1>
          <p>We are saving your Owner Archetype result and preparing your Agency Diagnostic workspace.</p>
        </section>
      </main>`;
    const syncPayload = {
      name: account.displayName,
      firstName: report.firstName,
      lastName: report.lastName,
      email: ownerEmail,
      agencyUrl: report.agencyWebsite,
      agencyName: report.agencyName,
      journey: destination,
      source: 'owner-archetype',
      archetypeAnswers: report.answers,
      archetypeResult: {
        key: report.archetypeKey,
        title: report.archetypeTitle,
        primaryConstraint: report.primaryConstraint,
        desiredPath: report.desiredPath
      },
      reportData: report,
      diagnosticState: { indexes: {}, count: 0, allComplete: false, reportReady: false }
    };
    const destinationPath = window.CCAccount?.destinationPath
      ? window.CCAccount.destinationPath(destination)
      : (destination === 'platform' ? '/platform/' : destination === 'accelerator' ? '/accelerator/' : '/diagnostic/');
    const sync = window.CCAccount?.createAccount
      ? window.CCAccount.createAccount(syncPayload).catch(() => null)
      : Promise.resolve(null);
    Promise.race([sync, new Promise(resolve => setTimeout(resolve, 2500))])
      .finally(() => setTimeout(() => { location.href = destinationPath; }, 350));
  }

  function report(token) {
    let data = readReport();
    if (!data && localStorage.getItem('ownerIdentityComplete') === 'true') {
      const fallback = ARCHETYPES.B;
      data = {
        token: token || localStorage.getItem('ownerArchetypeReportToken') || makeId('local-report'),
        reportId: 'CC-ARCH-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        firstName: localStorage.getItem('ccOwnerFirstName') || 'Owner',
        archetypeKey: 'B', archetypeTitle: fallback.title,
        primaryConstraint: fallback.constraint, primaryConstraintCopy: fallback.constraintCopy,
        desiredPath: fallback.desired, desiredPathCopy: fallback.desiredCopy
      };
      STORE.set('ownerArchetypeReportData', data);
    }
    if (!data) {
      app.innerHTML = `
        <main class="report-page">
          ${logo()}
          <section class="missing-report">
            <h1>Your report is not available in this browser.</h1>
            <p>Retake the questionnaire to create a new Owner Archetype Report.</p>
            <a class="nav-btn primary" href="/owner-archetype/assessment?retake=1">Retake quiz</a>
          </section>
        </main>`;
      return;
    }

    app.innerHTML = `
      <main class="report-page">
        ${logo()}
        <section class="report-progress" aria-label="Owner archetype report steps">
          <div class="report-step complete"><span>✓</span><b>Basics</b></div>
          <i></i>
          <div class="report-step complete"><span>✓</span><b>Quiz</b></div>
          <i></i>
          <div class="report-step current"><span>3</span><b>Report</b></div>
        </section>

        <section class="report-intro">
          <h1>Your free Owner Archetype Report</h1>
          <p>A snapshot of the owner-style ceiling that shows up in the agency. The full diagnostic uses this as its starting hypothesis.</p>
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
          <footer><code>Report ID · ${escapeHtml(data.reportId)}</code><button type="button" class="download-report" id="downloadReport">⇩ &nbsp;Download PDF</button></footer>
        </article>

        <section class="report-next">
          <div><span>Next step</span><h2>Turn this into a full Agency Diagnostic</h2><p>Layer your systems, financials, and independence review on top of this archetype. Get a valuation, a 90-day roadmap, and a fractional executive to turn the plan.</p></div>
          <a href="/payment/" class="next-payment">Continue to payment →</a>
        </section>
        <a class="report-home" href="/diagnostic/">I'm done for now — take me home</a>
      </main>`;

    document.querySelector('#downloadReport')?.addEventListener('click', () => window.print());
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
