(() => {
  const host = document.querySelector('#diagnosticPage');
  if (!host) return;

  const reportToken = localStorage.getItem('ownerArchetypeReportToken') || 'sample-token-123';
  const firstName = localStorage.getItem('ccOwnerFirstName') || 'there';

  const strengthReady = localStorage.getItem('agencyStrengthScore') !== null;
  const independenceReady = localStorage.getItem('ownerIndependenceScore') !== null;
  let performanceReady = false;
  try {
    const details = JSON.parse(localStorage.getItem('agencyPerformanceDetails') || 'null');
    performanceReady = Boolean(localStorage.getItem('agencyPerformanceScore') && details?.completed === true);
  } catch {}
  const financialUploadReady = localStorage.getItem('agencyFinancialUploadComplete') === 'true';

  const completedCount = [strengthReady, independenceReady, performanceReady || financialUploadReady].filter(Boolean).length;
  const savedFiles = JSON.parse(localStorage.getItem('agencyUploadedFiles') || '{}');

  const steps = [
    {
      id: 'strength',
      className: 'strength',
      label: 'strength',
      time: '~8 min',
      title: 'Agency Strength Index',
      copy: 'Structural health across the 14 valuation drivers — team, delivery, and offer.',
      ready: strengthReady,
      unlocked: true,
      href: '/agency-strength-index/'
    },
    {
      id: 'independence',
      className: 'independence',
      label: 'independence',
      time: '~6 min',
      title: 'Owner Independence Index',
      copy: 'How much of the business runs without you — decisions, delivery, and revenue.',
      ready: independenceReady,
      unlocked: true,
      href: '/independence-index/'
    },
    {
      id: 'performance',
      className: 'performance',
      label: 'performance',
      time: '~10 min',
      title: 'Agency Performance Index',
      copy: 'Financials, SDE add-backs, and the inputs behind your valuation ladder.',
      ready: performanceReady || financialUploadReady,
      unlocked: true,
      href: '/agency-performance-index/'
    }
  ];

  const docSections = [
    {
      id: 'pl',
      title: 'Profit and Loss (P&L) Statement',
      badge: 'Required',
      copy: 'Upload your latest P&L statement covering trailing 12-24 months of agency operation.',
      accept: '.pdf,.csv,.xlsx,.xls'
    },
    {
      id: 'balance_sheet',
      title: 'Balance Sheet',
      badge: 'Required',
      copy: 'Upload your most recent balance sheet detailing agency assets, liabilities, and equity.',
      accept: '.pdf,.csv,.xlsx,.xls'
    },
    {
      id: 'ar_aging',
      title: 'Accounts Receivable Aging Report',
      badge: 'Required',
      copy: 'Upload an AR aging report showing current outstanding client invoices and payment timelines.',
      accept: '.pdf,.csv,.xlsx,.xls'
    },
    {
      id: 'sde_report',
      title: 'SDE (Seller Discretionary Earnings) Report',
      badge: 'Required',
      copy: 'Upload your SDE computation schedule or owner add-back documentation.',
      accept: '.pdf,.csv,.xlsx,.xls'
    },
    {
      id: 'client_revenue',
      title: 'Client Revenue Report',
      badge: 'Recommended',
      copy: 'Upload a breakdown of revenue by client for concentration risk analysis.',
      accept: '.pdf,.csv,.xlsx,.xls'
    },
    {
      id: 'service_mix',
      title: 'Service Revenue Mix Report',
      badge: 'Recommended',
      copy: 'Upload a report detailing revenue by service line or offering type.',
      accept: '.pdf,.csv,.xlsx,.xls'
    }
  ];

  host.innerHTML = `
    <header class="diagnostic-header">
      <div>
        <h1>Welcome back, ${escapeHtml(firstName)}.</h1>
        <p>Your Owner Archetype is already in. Three short questionnaires to go — we'll take them one at a time so nothing feels heavy.</p>
      </div>
      <aside class="diagnostic-progress">
        <div class="progress-top"><span>Analysis</span><strong id="progressText">Analysis 4 out of 4</strong></div>
        <div class="progress-track"><span style="width:${Math.max(33, (completedCount / 3) * 100)}%"></span></div>
        <p>${completedCount === 3 || financialUploadReady ? 'Your Agency Scorecard is unlocked.' : 'Finish all three to unlock your report.'}</p>
      </aside>
    </header>

    <section class="archetype-summary">
      <div class="summary-copy">
        <div class="summary-meta"><span class="delivery-badge">✓ DELIVERED</span><span class="summary-kind">archetype</span></div>
        <h2>Owner Archetype Report</h2>
        <p>Based on the quiz you completed at signup. It sets the frame for the three questionnaires below — how you lead shapes what the agency needs next.</p>
      </div>
      <div class="summary-actions">
        <a class="diag-button primary" href="/owner-archetype/report/${encodeURIComponent(reportToken)}">▧ &nbsp;View report</a>
        <a class="diag-button" href="/owner-archetype/assessment?retake=1">↻ &nbsp;Retake quiz</a>
      </div>
    </section>

    <section class="next-section">
      <div class="next-heading">
        <div>
          <h2>What's next</h2>
          <p>We'll walk you through these in order. Each one unlocks the next.</p>
        </div>
        <span>Step ${completedCount === 3 ? '3 of 3' : `${completedCount + 1} of 3`}</span>
      </div>

      <div class="diagnostic-timeline">
        ${steps.map((step, index) => renderStep(step, index)).join('')}
      </div>
    </section>

    <!-- Phase 5 Financial Data Upload Section -->
    <section class="financial-upload-section" id="financialUploadSection">
      <div class="section-title-box">
        <span class="upload-badge-pill">Phase 5: Financial Data Upload</span>
        <h2>Financial Data Upload</h2>
        <p>Upload your financial documents to complete your back-office systems analysis and generate your Agency Scorecard.</p>
      </div>

      <div class="doc-upload-grid">
        ${docSections.map(doc => renderDocSection(doc)).join('')}
      </div>

      <div class="doc-upload-footer">
        <div class="footer-info">
          <strong id="uploadStatusCount">${Object.keys(savedFiles).length} of 6 Documents Ready</strong>
          <span>All uploaded files are processed securely for your private Agency Scorecard.</span>
        </div>
        <button class="generate-scorecard-btn" id="generateScorecardBtn">
          Generate My Agency Scorecard
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="20" height="20"><path d="M5 12h14M14 7l5 5-5 5"/></svg>
        </button>
      </div>
    </section>

    <section class="integrations-strip">
      <div>
        <h3>Integrations feed your scoring</h3>
        <p>Connect the tools you declared during onboarding so the diagnostic can pull real numbers.</p>
      </div>
      <a href="/integrations/">Go to integrations →</a>
    </section>
  `;

  function renderStep(step, index) {
    const isCurrent = !step.ready && step.unlocked;
    const className = `diagnostic-item ${step.className} ${step.ready ? 'complete' : isCurrent ? 'current' : ''}`;
    const marker = step.ready ? '✓' : String(index + 1).padStart(2, '0');
    
    let action = `<a class="start-button" href="${step.href}">Start</a>`;
    if (step.ready) {
      action = `<a class="start-button review" href="${step.href}">Review</a>`;
    } else if (isCurrent) {
      action = `<a class="start-button primary" href="${step.href}">Start</a>`;
    }

    return `
      <article class="${className}">
        <span class="item-number">${marker}</span>
        <div class="item-card">
          <div>
            <div class="item-meta">
              <span class="item-type">${step.label}</span>
              <span class="item-time">· ${step.time}</span>
              ${isCurrent ? '<span class="up-next">UP NEXT</span>' : ''}
            </div>
            <h3>${step.title}</h3>
            <p>${step.copy}</p>
          </div>
          ${action}
        </div>
      </article>`;
  }

  function renderDocSection(doc) {
    const uploadedName = savedFiles[doc.id];
    return `
      <article class="doc-card ${uploadedName ? 'uploaded' : ''}" data-doc-id="${doc.id}">
        <div class="doc-header">
          <div>
            <span class="doc-type-tag ${doc.badge.toLowerCase()}">${doc.badge}</span>
            <h3>${doc.title}</h3>
          </div>
          <span class="doc-status-icon">${uploadedName ? '✓' : '⇡'}</span>
        </div>
        <p class="doc-instructions">${doc.copy}</p>
        
        <div class="upload-dropzone">
          <input type="file" id="file_${doc.id}" accept="${doc.accept}" class="file-input" />
          <label for="file_${doc.id}" class="dropzone-label">
            <span class="upload-file-icon">📄</span>
            <div class="upload-label-text">
              <strong class="file-title">${uploadedName || 'Click to select file or drag & drop'}</strong>
              <span class="file-hint">${uploadedName ? 'File attached · Click to replace' : 'PDF, CSV, XLSX accepted'}</span>
            </div>
            <span class="browse-btn">${uploadedName ? 'Replace' : 'Browse'}</span>
          </label>
        </div>
      </article>`;
  }

  // Handle file selections
  docSections.forEach(doc => {
    const input = host.querySelector(`#file_${doc.id}`);
    if (input) {
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          savedFiles[doc.id] = file.name;
          localStorage.setItem('agencyUploadedFiles', JSON.stringify(savedFiles));
          
          const card = host.querySelector(`[data-doc-id="${doc.id}"]`);
          if (card) {
            card.classList.add('uploaded');
            card.querySelector('.file-title').textContent = file.name;
            card.querySelector('.file-hint').textContent = 'File attached · Click to replace';
            card.querySelector('.browse-btn').textContent = 'Replace';
            card.querySelector('.doc-status-icon').textContent = '✓';
          }

          const count = Object.keys(savedFiles).length;
          const statusCount = host.querySelector('#uploadStatusCount');
          if (statusCount) statusCount.textContent = `${count} of 6 Documents Ready`;
        }
      });
    }
  });

  // Handle Generate Scorecard CTA button
  const generateBtn = host.querySelector('#generateScorecardBtn');
  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      localStorage.setItem('agencyFinancialUploadComplete', 'true');
      localStorage.setItem('agencyScorecardGenerated', 'true');
      localStorage.setItem('diagnosticComplete', 'true');
      localStorage.setItem('ownerIdentityComplete', 'true');

      if (!localStorage.getItem('agencyPerformanceScore')) {
        localStorage.setItem('agencyPerformanceScore', '84');
      }
      if (!localStorage.getItem('agencyStrengthScore')) {
        localStorage.setItem('agencyStrengthScore', '78');
      }
      if (!localStorage.getItem('ownerIndependenceScore')) {
        localStorage.setItem('ownerIndependenceScore', '72');
      }
      if (!localStorage.getItem('agencyPerformanceDetails')) {
        localStorage.setItem('agencyPerformanceDetails', JSON.stringify({
          currentSde: 480000,
          currentRevenue: 1950000,
          validation: 'green',
          completed: true
        }));
      }

      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating Scorecard…';

      setTimeout(() => {
        location.href = '/agency-scorecard/';
      }, 500);
    });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]);
  }
})();
