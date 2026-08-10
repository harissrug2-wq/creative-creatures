(() => {
  const CATEGORIES = [
    {
      id: 'profitability',
      title: 'Profitability',
      weight: 25,
      capability: 'Can management consistently produce healthy, predictable earnings?',
      questions: [
        ['grossMargin', 'Gross Margin', 'How efficiently the agency delivers services before overhead.', 20, ['Less than 30%', '30–39.9%', '40–49.9%', '50–59.9%', '60%+']],
        ['netMargin', 'Net Margin', 'How effectively management converts revenue into profit.', 25, ['Less than 5%', '5–9.9%', '10–14.9%', '15–19.9%', '20%+']],
        ['sdeMargin', 'EBITDA / SDE Margin', 'The earnings available to an owner or investor.', 20, ['Less than 10%', '10–14.9%', '15–19.9%', '20–24.9%', '25%+']],
        ['marginStability', 'Margin Stability', 'Evaluate the last 24 months.', 15, ['Declining and highly volatile', 'Flat or volatile', 'Stable with occasional fluctuations', 'Consistently stable', 'Stable and improving over 24 months']],
        ['grossProfitGrowth', 'TTM Gross Profit Growth', 'Whether the agency is creating more gross profit.', 10, ['Negative', '0–4.9%', '5–9.9%', '10–19.9%', '20%+']],
        ['profitConversion', 'Incremental Profit Conversion', 'New Net Income ÷ New Revenue.', 10, ['Less than 5%', '5–9.9%', '10–19.9%', '20–29.9%', '30%+']]
      ]
    },
    {
      id: 'growth',
      title: 'Growth Performance & Trends',
      weight: 20,
      capability: 'Can management grow the agency in a healthy, sustainable way?',
      questions: [
        ['revenueGrowth', 'TTM Revenue Growth', 'Trailing twelve-month revenue growth.', 30, ['Negative', '0–4.9%', '5–9.9%', '10–19.9%', '20%+']],
        ['netIncomeGrowth', 'TTM Net Income Growth', 'Trailing twelve-month net-income growth.', 30, ['Negative', '0–4.9%', '5–9.9%', '10–19.9%', '20%+']],
        ['growthConsistency', 'Growth Consistency', 'Evaluate the last 24 months.', 20, ['Revenue declining', 'Highly inconsistent', 'Stable with fluctuations', 'Consistently growing', 'Consistently growing with accelerating profit']],
        ['revenuePredictability', 'Revenue Predictability', 'Measured from monthly revenue volatility.', 20, ['Extremely volatile', 'High variability', 'Moderate consistency', 'Predictable', 'Highly predictable recurring growth']]
      ]
    },
    {
      id: 'revenueQuality',
      title: 'Revenue Quality',
      weight: 20,
      capability: "How durable and transferable is the agency's revenue?",
      questions: [
        ['recurringRevenue', 'Recurring Revenue', 'Share of revenue that is recurring.', 25, ['Less than 20%', '20–39.9%', '40–59.9%', '60–79.9%', '80%+']],
        ['clientConcentration', 'Largest Client Concentration', 'Largest client as a percentage of total revenue.', 25, ['Greater than 30%', '20–29.9%', '15–19.9%', '10–14.9%', 'Less than 10%']],
        ['revenueDiversification', 'Revenue Diversification', 'Number and balance of meaningful clients.', 20, ['Very concentrated', 'Limited diversification', 'Moderate', 'Well diversified', 'Highly diversified']],
        ['averageClientTenure', 'Average Client Tenure', 'Average duration of active client relationships.', 15, ['Less than 12 months', '1–2 years', '2–3 years', '3–5 years', 'Greater than 5 years']],
        ['contractDuration', 'Contract Duration', 'Typical contractual commitment.', 15, ['Project only', 'Month-to-month', '6-month average', '12-month average', 'Multi-year relationships']]
      ]
    },
    {
      id: 'cash',
      title: 'Cash Performance',
      weight: 20,
      capability: 'Can management generate and protect liquidity?',
      questions: [
        ['cashReserve', 'Cash Reserve', 'Months of operating expenses held in unrestricted cash.', 25, ['Less than 1', '1–2', '2–3', '3–6', 'More than 6']],
        ['operatingCashFlow', 'Operating Cash Flow', 'Operating cash-flow trend.', 25, ['Negative', 'Break-even', 'Positive but inconsistent', 'Positive and stable', 'Positive and consistently growing']],
        ['currentRatio', 'Current Ratio', 'Current Assets ÷ Current Liabilities.', 20, ['Less than 1.0', '1.0–1.24', '1.25–1.49', '1.5–2.0', 'Greater than 2.0']],
        ['arCollection', 'Accounts Receivable Aging', 'Percentage collected within 30 days.', 15, ['Less than 50%', '50–69.9%', '70–84.9%', '85–94.9%', '95%+']],
        ['debtPosition', 'Debt Position', 'Debt-to-EBITDA ratio.', 15, ['Greater than 4x', '3–4x', '2–3x', '1–2x', 'Less than 1x']]
      ]
    },
    {
      id: 'capital',
      title: 'Capital Allocation',
      weight: 15,
      capability: 'Does management deploy capital to increase future enterprise value?',
      questions: [
        ['returnOnCapital', 'Return on Capital', 'Incremental Operating Profit ÷ Capital Invested.', 30, ['Negative', '0–9.9%', '10–19.9%', '20–29.9%', '30%+']],
        ['reinvestmentRate', 'Reinvestment Rate', 'Percentage of profits intentionally reinvested.', 20, ['Less than 10%', '10–24.9%', '25–39.9%', '40–59.9%', '60%+']],
        ['technologyInvestment', 'Technology Investment', 'How intentionally technology investment improves productivity and margin.', 15, ['Reactive spending only', 'Occasional purchases', 'Annual technology plan', 'Strategic technology investment', 'Technology consistently improves productivity and margins']],
        ['talentInvestment', 'Talent Investment', 'How intentionally talent investment creates capability.', 15, ['No leadership development', 'Occasional training', 'Defined development plans', 'Leadership development program', 'Talent investments consistently produce measurable organizational capability']],
        ['retainedEarningsGrowth', 'Retained Earnings Growth', 'Whether equity compounds over time.', 20, ['Declining', 'Flat', 'Growing slowly', 'Growing consistently', 'Growing rapidly while maintaining profitability']]
      ]
    }
  ];

  const ADD_BACKS = [
    'Owner health insurance',
    'One-time legal expenses',
    'Car insurance',
    'Personal vehicle expenses',
    'Travel and lodging',
    'Education or memberships',
    'Family on payroll',
    'Other owner benefits'
  ];

  const INVESTMENTS = [
    'Sales Team',
    'Marketing (Events, Travel)',
    'AI',
    'New Software or Technology',
    'Leadership Hiring',
    'Training',
    'SOP Documentation & Development',
    'Client Rewards',
    'New Services or Products',
    'Other'
  ];

  const EVIDENCE = [
    ['pnl', 'P&L statement', 'Level 1 · measures Profitability and Growth', true],
    ['balanceSheet', 'Balance Sheet', 'Level 2 · adds liquidity and capital structure', false],
    ['cashFlow', 'Cash Flow Statement', 'Level 2 · adds Cash Performance', false],
    ['clientRevenue', 'Client Revenue Detail', 'Level 3 · adds Revenue Quality', false],
    ['arap', 'AR/AP Aging', 'Level 3 · validates collections and liabilities', false],
    ['investmentAllocation', 'Owner Investment Allocation', 'Level 3 · supports ROIC-Lite', false],
    ['budget', 'Budget', 'Level 3 · supports planning and confidence', false],
    ['forecast', 'Forecast', 'Level 3 · supports growth predictability', false],
    ['ownerAddbacks', 'Owner Add-Backs Schedule', 'Level 3 · defines Adjusted SDE', false]
  ];

  const QUESTIONS = CATEGORIES.flatMap((category, categoryIndex) =>
    category.questions.map((question, questionIndex) => ({
      id: question[0],
      title: question[1],
      help: question[2],
      metricWeight: question[3],
      options: question[4],
      categoryId: category.id,
      categoryTitle: category.title,
      categoryWeight: category.weight,
      capability: category.capability,
      categoryIndex,
      categoryQuestionIndex: questionIndex
    }))
  );

  const EXTRA_STEPS = [
    { id: 'sdeBase', type: 'sde-base', title: 'SDE Review' },
    { id: 'addbacks', type: 'addbacks', title: 'Owner Add-Backs' },
    { id: 'investments', type: 'investments', title: 'Capital Investments' },
    { id: 'investmentTiming', type: 'investment-timing', title: 'Investment Timing' },
    { id: 'evidence', type: 'evidence', title: 'Financial Evidence' }
  ];

  const STEPS = [
    ...QUESTIONS.map((question, questionIndex) => ({
      id: question.id,
      type: 'question',
      questionIndex,
      title: question.title
    })),
    ...EXTRA_STEPS
  ];

  const safeJson = (value, fallback) => {
    try { return JSON.parse(value); }
    catch { return fallback; }
  };

  const stored = safeJson(localStorage.getItem('ccPerformanceState'), {}) || {};

  const model = {
    step: Number.isFinite(Number(stored.step))
      ? Math.max(0, Math.min(STEPS.length - 1, Number(stored.step)))
      : 0,
    answers: stored.answers || {},
    manual: {
      currentNetIncome: '',
      ownerCompensation: '',
      priorAdjustedSDE: '',
      addbacks: {},
      investments: {},
      investmentTiming: '',
      ...stored.manual
    },
    evidence: stored.evidence || { files: [] }
  };

  const root = document.getElementById('performanceStep');
  const nav = document.getElementById('performanceStepNav');
  const back = document.getElementById('performanceBack');
  const next = document.getElementById('performanceNext');
  const bar = document.getElementById('answeredBar');
  const count = document.getElementById('answeredCount');
  const stepCounter = document.getElementById('stepCounter');

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const money = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

  function persist() {
    localStorage.setItem('ccPerformanceState', JSON.stringify(model));
    localStorage.setItem('ccPerformanceAnswers', JSON.stringify(model.answers));
    const progress = progressPercent();
    localStorage.setItem('ccIndexPerformanceProgress', String(Math.min(99, progress)));
    window.CCDiagnostic?.setProgress?.('performance', Math.min(99, progress));
  }

  function answeredQuestionCount() {
    return QUESTIONS.filter(question => model.answers[question.id] !== undefined).length;
  }

  function progressPercent() {
    const answered = answeredQuestionCount();
    const questionProgress = (answered / QUESTIONS.length) * 82;
    const manualProgress = sdeBaseComplete() ? 4 : 0;
    const addbackProgress = model.step > QUESTIONS.length ? 3 : 0;
    const investmentProgress = investmentsComplete() ? 4 : 0;
    const timingProgress = investmentTimingComplete() ? 2 : 0;
    const evidenceProgress = (model.evidence.files || []).length ? 5 : 0;
    return Math.min(99, Math.round(questionProgress + manualProgress + addbackProgress + investmentProgress + timingProgress + evidenceProgress));
  }

  function sdeBaseComplete() {
    return ['currentNetIncome', 'ownerCompensation', 'priorAdjustedSDE']
      .every(key => String(model.manual[key] ?? '').trim() !== '');
  }

  function investmentTotal() {
    return Object.values(model.manual.investments || {})
      .reduce((sum, item) => sum + (item?.selected ? Number(item.amount || 0) : 0), 0);
  }

  function investmentsComplete() {
    const values = Object.values(model.manual.investments || {});
    if (!values.length) return true;
    return values.every(item => !item?.selected || String(item.amount ?? '').trim() !== '');
  }

  function investmentTimingComplete() {
    return investmentTotal() === 0 || Boolean(model.manual.investmentTiming);
  }

  function categoryQuestions(category) {
    return QUESTIONS.filter(question => question.categoryId === category.id);
  }

  function categoryAnswered(category) {
    return categoryQuestions(category).filter(question => model.answers[question.id] !== undefined).length;
  }

  function categoryComplete(category) {
    return categoryAnswered(category) === categoryQuestions(category).length;
  }

  function renderNav() {
    nav.innerHTML = CATEGORIES.map(category => {
      const categoryQs = categoryQuestions(category);
      const answered = categoryAnswered(category);
      const currentStep = STEPS[model.step];
      const currentQuestion = currentStep?.type === 'question' ? QUESTIONS[currentStep.questionIndex] : null;
      const active = currentQuestion?.categoryId === category.id;
      const complete = categoryComplete(category);
      const firstQuestionIndex = QUESTIONS.findIndex(question => question.categoryId === category.id);

      return `
        <button type="button" data-question-index="${firstQuestionIndex}" class="${active ? 'active' : ''} ${complete ? 'complete' : ''}">
          <span>${esc(category.title)}</span>
          <small>${answered}/${categoryQs.length}</small>
        </button>
      `;
    }).join('');

    nav.querySelectorAll('[data-question-index]').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.questionIndex);
        if (!Number.isFinite(index)) return;
        model.step = index;
        persist();
        render();
      });
    });
  }

  function questionGlobalNumber(question) {
    return QUESTIONS.findIndex(item => item.id === question.id) + 1;
  }

  function renderQuestion(question) {
    const selected = model.answers[question.id];
    const globalNumber = questionGlobalNumber(question);
    const categoryQs = categoryQuestions(CATEGORIES[question.categoryIndex]);

    root.innerHTML = `
      <div class="performance-question-layout">
        <div class="performance-question-meta">
          <div>
            <span class="performance-category-label">${esc(question.categoryTitle)}</span>
            <small>${question.categoryQuestionIndex + 1} / ${categoryQs.length} in category</small>
          </div>
          <strong>Question ${globalNumber} of ${QUESTIONS.length}</strong>
        </div>

        <div class="performance-question-card">
          <p class="performance-capability">${esc(question.capability)}</p>
          <h2>${esc(question.title)}</h2>
          <p class="performance-question-help">${esc(question.help)}</p>

          <div class="performance-answer-list">
            ${question.options.map((option, score) => `
              <button
                type="button"
                class="performance-answer ${Number(selected) === score ? 'selected' : ''}"
                data-score="${score}"
              >
                <span class="performance-answer-radio">${Number(selected) === score ? '✓' : ''}</span>
                <span class="performance-answer-copy">${esc(option)}</span>
              </button>
            `).join('')}
          </div>

          <p class="performance-error" id="performanceError">Select an answer before continuing.</p>
        </div>
      </div>
    `;

    root.querySelectorAll('[data-score]').forEach(button => {
      button.addEventListener('click', () => {
        model.answers[question.id] = Number(button.dataset.score);
        persist();
        renderQuestion(question);
        updateHeader();
        renderNav();
      });
    });
  }

  function amountRows(items, kind) {
    return items.map(label => {
      const item = model.manual[kind]?.[label] || {};
      return `
        <div class="amount-item">
          <label>
            <input
              type="checkbox"
              data-kind="${kind}"
              data-label="${esc(label)}"
              ${item.selected ? 'checked' : ''}
            >
            <span>${esc(label)}</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            data-amount-kind="${kind}"
            data-amount-label="${esc(label)}"
            value="${esc(item.amount)}"
            ${item.selected ? '' : 'disabled'}
          >
        </div>
      `;
    }).join('');
  }

  function manualNumbers() {
    const addbacks = Object.values(model.manual.addbacks || {})
      .reduce((sum, item) => sum + (item?.selected ? Number(item.amount || 0) : 0), 0);
    const investments = investmentTotal();
    const adjusted = Number(model.manual.currentNetIncome || 0)
      + Number(model.manual.ownerCompensation || 0)
      + addbacks;
    const prior = Number(model.manual.priorAdjustedSDE || 0);
    const roic = investments > 0 ? ((adjusted - prior) / investments) * 100 : null;
    return { addbacks, investments, adjusted, prior, roic };
  }

  function renderSdeBase() {
    root.innerHTML = `
      <div class="performance-question-layout">
        <div class="performance-question-meta"><span class="performance-category-label">Manual financial input</span><strong>SDE Review</strong></div>
        <div class="performance-question-card">
          <p class="performance-capability">Seller Discretionary Earnings</p>
          <h2>Tell us the core numbers needed to calculate Adjusted SDE.</h2>
          <p class="performance-question-help">Use the last 12 months. Owner compensation is entered separately because it is an SDE add-back.</p>

          <div class="performance-field-stack">
            <label>TTM net income<input type="number" min="0" step="0.01" data-manual="currentNetIncome" value="${esc(model.manual.currentNetIncome)}" placeholder="0"></label>
            <label>Owner compensation<input type="number" min="0" step="0.01" data-manual="ownerCompensation" value="${esc(model.manual.ownerCompensation)}" placeholder="0"></label>
            <label>Prior-year Adjusted SDE<input type="number" min="0" step="0.01" data-manual="priorAdjustedSDE" value="${esc(model.manual.priorAdjustedSDE)}" placeholder="0"></label>
          </div>

          <p class="performance-error" id="performanceError">Complete all three fields before continuing.</p>
        </div>
      </div>
    `;

    root.querySelectorAll('[data-manual]').forEach(input => {
      input.addEventListener('input', () => {
        model.manual[input.dataset.manual] = input.value;
        persist();
        updateHeader();
      });
    });
  }

  function renderAddbacks() {
    const numbers = manualNumbers();
    root.innerHTML = `
      <div class="performance-question-layout">
        <div class="performance-question-meta"><span class="performance-category-label">Manual financial input</span><strong>Owner Add-Backs</strong></div>
        <div class="performance-question-card">
          <p class="performance-capability">Seller Discretionary Earnings</p>
          <h2>What owner benefits or one-time expenses should be added back?</h2>
          <p class="performance-question-help">Check all that apply and enter the amount for the last 12 months. Leave everything unchecked if there were no additional add-backs.</p>

          <div class="amount-list">${amountRows(ADD_BACKS, 'addbacks')}</div>

          <div class="calculation-card single-calculation">
            <div><span>Current Adjusted SDE</span><strong>$${money(numbers.adjusted)}</strong></div>
          </div>
        </div>
      </div>
    `;
    bindAmountRows('addbacks', renderAddbacks);
  }

  function renderInvestments() {
    const numbers = manualNumbers();
    root.innerHTML = `
      <div class="performance-question-layout">
        <div class="performance-question-meta"><span class="performance-category-label">Manual financial input</span><strong>Capital Investments</strong></div>
        <div class="performance-question-card">
          <p class="performance-capability">Capital Allocation Review</p>
          <h2>Where did the agency intentionally reinvest money during the last fiscal year?</h2>
          <p class="performance-question-help">Check every investment that applies and enter the incremental amount. If there were no intentional investments, leave all options unchecked.</p>

          <div class="amount-list">${amountRows(INVESTMENTS, 'investments')}</div>

          <div class="calculation-card single-calculation">
            <div><span>Total intentional capital invested</span><strong>$${money(numbers.investments)}</strong></div>
          </div>

          <p class="performance-error" id="performanceError">Enter an amount for every selected investment.</p>
        </div>
      </div>
    `;
    bindAmountRows('investments', renderInvestments);
  }

  function bindAmountRows(kind, rerender) {
    root.querySelectorAll(`[data-kind="${kind}"]`).forEach(box => {
      box.addEventListener('change', () => {
        const label = box.dataset.label;
        model.manual[kind] = model.manual[kind] || {};
        model.manual[kind][label] = model.manual[kind][label] || { amount: '' };
        model.manual[kind][label].selected = box.checked;
        persist();
        rerender();
        updateHeader();
      });
    });

    root.querySelectorAll(`[data-amount-kind="${kind}"]`).forEach(input => {
      input.addEventListener('input', () => {
        const label = input.dataset.amountLabel;
        model.manual[kind] = model.manual[kind] || {};
        model.manual[kind][label] = model.manual[kind][label] || { selected: true };
        model.manual[kind][label].amount = input.value;
        persist();
        updateHeader();
      });
    });
  }

  function renderInvestmentTiming() {
    const total = investmentTotal();
    const options = total > 0
      ? ['Beginning of Year', 'Middle of Year', 'End of Year']
      : ['Not applicable — no intentional investments'];

    root.innerHTML = `
      <div class="performance-question-layout">
        <div class="performance-question-meta"><span class="performance-category-label">Manual financial input</span><strong>Investment Timing</strong></div>
        <div class="performance-question-card">
          <p class="performance-capability">Capital Allocation Review</p>
          <h2>${total > 0 ? 'When did these investments primarily occur?' : 'No intentional capital investment was entered.'}</h2>
          <p class="performance-question-help">${total > 0 ? 'Choose the period that best represents when most of the investment was deployed.' : 'Continue to financial evidence. ROIC-Lite will remain unavailable until investment data exists.'}</p>

          <div class="performance-answer-list">
            ${options.map(option => `
              <button type="button" class="performance-answer ${model.manual.investmentTiming === option ? 'selected' : ''}" data-timing="${esc(option)}">
                <span class="performance-answer-radio">${model.manual.investmentTiming === option ? '✓' : ''}</span>
                <span class="performance-answer-copy">${esc(option)}</span>
              </button>
            `).join('')}
          </div>
          <p class="performance-error" id="performanceError">Choose an investment period before continuing.</p>
        </div>
      </div>
    `;

    if (total === 0 && !model.manual.investmentTiming) {
      model.manual.investmentTiming = 'Not applicable — no intentional investments';
      persist();
    }

    root.querySelectorAll('[data-timing]').forEach(button => {
      button.addEventListener('click', () => {
        model.manual.investmentTiming = button.dataset.timing;
        persist();
        renderInvestmentTiming();
        updateHeader();
      });
    });
  }

  function evidenceLevel() {
    const types = new Set((model.evidence.files || []).map(file => file.type));
    const level1 = types.has('pnl');
    const level2 = level1 && types.has('balanceSheet') && types.has('cashFlow');
    const level3Count = ['clientRevenue', 'arap', 'investmentAllocation', 'budget', 'forecast', 'ownerAddbacks']
      .filter(type => types.has(type)).length;

    if (level2 && level3Count === 6) return { label: 'Very High', score: 95, validation: 'Verified' };
    if (level2) return { label: 'High', score: 82, validation: 'Needs Validation' };
    if (level1) return { label: 'Medium', score: 65, validation: 'Needs Validation' };
    return { label: 'Low', score: 45, validation: 'Needs Validation' };
  }

  function renderEvidence() {
    const level = evidenceLevel();
    root.innerHTML = `
      <div class="performance-question-layout">
        <div class="performance-question-meta"><span class="performance-category-label">Financial evidence</span><strong>Final step</strong></div>
        <div class="performance-question-card evidence-question-card">
          <p class="performance-capability">Confidence & Validation</p>
          <h2>Upload the financial evidence you have available.</h2>
          <p class="performance-question-help">Questionnaire-only completion is allowed. The Performance Index confidence increases as financial evidence is supplied.</p>

          <div class="evidence-grid">
            ${EVIDENCE.map(([type, label, help, required]) => {
              const file = (model.evidence.files || []).find(item => item.type === type);
              return `
                <article class="evidence-card ${required ? 'required' : ''}">
                  <h3>${esc(label)}${required ? ' · foundation' : ''}</h3>
                  <p>${esc(help)}</p>
                  <input type="file" data-evidence="${type}" accept=".pdf,.csv,.xlsx,.xls,.doc,.docx,image/*">
                  <div class="evidence-status ${file ? 'saved' : ''}" data-status="${type}">
                    ${file ? `Saved: ${esc(file.name)}` : 'No file selected'}
                  </div>
                </article>
              `;
            }).join('')}
          </div>

          <div class="confidence-preview">
            <div>
              <h3>Current evidence confidence</h3>
              <p>${level.label} confidence · ${level.validation}</p>
            </div>
            <strong>${level.score}%</strong>
          </div>
        </div>
      </div>
    `;

    root.querySelectorAll('[data-evidence]').forEach(input => {
      input.addEventListener('change', () => handleEvidence(input));
    });
  }

  async function handleEvidence(input) {
    const file = input.files?.[0];
    if (!file) return;

    const type = input.dataset.evidence;
    const status = root.querySelector(`[data-status="${type}"]`);

    if (file.size > 4 * 1024 * 1024) {
      status.textContent = 'File exceeds the 4 MB upload limit.';
      return;
    }

    status.textContent = 'Saving...';

    let record = {
      type,
      label: EVIDENCE.find(row => row[0] === type)?.[1],
      name: file.name,
      size: file.size,
      mimeType: file.type,
      stored: false,
      selectedAt: new Date().toISOString()
    };

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const account = window.CCAccount?.getAccount?.() || {};
      const response = await fetch('/api/evidence-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          evidenceType: type,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Backend upload unavailable');
      record = { ...record, ...payload.file, stored: true };
    } catch (error) {
      record.localOnly = true;
      record.uploadError = error.message;
    }

    model.evidence.files = (model.evidence.files || []).filter(item => item.type !== type);
    model.evidence.files.push(record);
    persist();
    renderEvidence();
    updateHeader();
  }

  function currentStepComplete() {
    const step = STEPS[model.step];
    if (!step) return false;
    if (step.type === 'question') {
      return model.answers[QUESTIONS[step.questionIndex].id] !== undefined;
    }
    if (step.type === 'sde-base') return sdeBaseComplete();
    if (step.type === 'addbacks') return true;
    if (step.type === 'investments') return investmentsComplete();
    if (step.type === 'investment-timing') return investmentTimingComplete();
    if (step.type === 'evidence') return true;
    return false;
  }

  function showError() {
    const error = document.getElementById('performanceError');
    if (error) error.classList.add('show');
  }

  function categoryScore(category) {
    const score = category.questions.reduce((sum, question) => {
      const answer = Number(model.answers[question[0]]) || 0;
      const metricWeight = question[3];
      return sum + ((answer / 4) * metricWeight);
    }, 0);
    return Math.round(score);
  }

  function finish() {
    const categoryScores = Object.fromEntries(
      CATEGORIES.map(category => [category.id, categoryScore(category)])
    );

    const overallScore = Math.round(
      CATEGORIES.reduce((sum, category) => {
        return sum + categoryScores[category.id] * category.weight / 100;
      }, 0)
    );

    const level = evidenceLevel();
    const numbers = manualNumbers();
    const evidenceTypes = new Set((model.evidence.files || []).map(file => file.type));
    const missingEvidence = EVIDENCE
      .filter(row => !evidenceTypes.has(row[0]))
      .map(row => row[1]);

    const details = {
      answers: model.answers,
      categoryScores,
      overallScore,
      manual: model.manual,
      adjustedSDE: numbers.adjusted,
      capitalInvested: numbers.investments,
      roicLite: numbers.roic,
      evidence: model.evidence,
      evidenceLevel: level.label,
      confidenceScore: level.score,
      validationStatus: level.validation,
      missingEvidence,
      completedAt: new Date().toISOString()
    };

    window.CCDiagnostic?.mark?.('performance', overallScore, details);

    if (!window.CCDiagnostic) {
      localStorage.setItem('agencyPerformanceScore', String(overallScore));
      localStorage.setItem('ccIndexPerformanceComplete', 'true');
      localStorage.setItem('ccIndexPerformanceProgress', '100');
      localStorage.setItem('ccIndexPerformanceResult', JSON.stringify(details));
    }

    localStorage.setItem('ccIndexPerformanceProgress', '100');
    window.location.href = '/diagnostic/';
  }

  function render() {
    renderNav();
    const step = STEPS[model.step];

    if (step.type === 'question') renderQuestion(QUESTIONS[step.questionIndex]);
    if (step.type === 'sde-base') renderSdeBase();
    if (step.type === 'addbacks') renderAddbacks();
    if (step.type === 'investments') renderInvestments();
    if (step.type === 'investment-timing') renderInvestmentTiming();
    if (step.type === 'evidence') renderEvidence();

    back.disabled = model.step === 0;
    next.textContent = model.step === STEPS.length - 1 ? 'Complete index →' : 'Continue →';
    updateHeader();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateHeader() {
    const progress = progressPercent();
    bar.style.width = `${progress}%`;
    count.textContent = `${progress}%`;

    const step = STEPS[model.step];
    if (step.type === 'question') {
      stepCounter.textContent = `Question ${step.questionIndex + 1} of ${QUESTIONS.length}`;
    } else {
      stepCounter.textContent = `${step.title} · Step ${model.step + 1} of ${STEPS.length}`;
    }
  }

  next.addEventListener('click', () => {
    if (!currentStepComplete()) {
      showError();
      return;
    }

    if (model.step < STEPS.length - 1) {
      model.step += 1;
      persist();
      render();
      return;
    }

    finish();
  });

  back.addEventListener('click', () => {
    if (model.step > 0) {
      model.step -= 1;
      persist();
      render();
    }
  });

  render();
  persist();
})();
