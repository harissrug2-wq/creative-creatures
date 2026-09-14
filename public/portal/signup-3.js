(() => {
  const initSignup3 = () => {
    // Package pages use one complete guarantee panel. Move it directly below
    // the offer/price hero and remove the cramped duplicate inside the price card.
    const hero = document.querySelector('.offer-detail-page .detail-hero');
    const guarantee = document.querySelector('.offer-detail-page .guarantee-banner-card');
    if (hero && guarantee) {
      guarantee.classList.add('guarantee-banner-card--primary');
      hero.insertAdjacentElement('afterend', guarantee);
    }

    // Smooth scroll for internal links
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', e => {
        const targetId = link.getAttribute('href').slice(1);
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    // Account Lookup Modal Logic
    const openLookupBtn = document.getElementById('s3BtnHaveArchetype');
    const takeArchetypeBtn = document.getElementById('s3BtnTakeArchetype');

    if (openLookupBtn) {
      openLookupBtn.addEventListener('click', () => {
        openLookupModal();
      });
    }

    if (takeArchetypeBtn) {
      takeArchetypeBtn.addEventListener('click', () => {
        const currentOffer = window.location.pathname.split('/').filter(Boolean).pop() || 'archetype';
        localStorage.setItem('ccProgramPath', currentOffer);
        window.location.href = '/owner-archetype/?destination=' + encodeURIComponent(currentOffer);
      });
    }

    initEmbeddedLookup();
  };

  const initEmbeddedLookup = () => {
    const card = document.querySelector('.lookup-embedded-card');
    if (!card) return;

    const destination = (card.dataset.destination || 'diagnostic').replace(/-/g, '_');
    localStorage.setItem('ccProgramPath', destination);

    const yesOption = card.querySelector('#yesOption');
    const noOption = card.querySelector('#noOption');
    const yesPanel = card.querySelector('#yesPanel');
    const noPanel = card.querySelector('#noPanel');
    const cta = card.querySelector('#archetypeCta');
    const form = card.querySelector('#lookupForm');
    const submitBtn = card.querySelector('#lookupSubmit');
    const errorNode = card.querySelector('#lookupError');
    const successNode = card.querySelector('#lookupSuccess');
    const resultsNode = card.querySelector('#lookupResults');

    if (cta) {
      cta.href = `/owner-archetype/assessment/?destination=${encodeURIComponent(destination)}&source=signup`;
      cta.addEventListener('click', () => localStorage.setItem('ccProgramPath', destination));
    }

    function select(mode) {
      const isYes = mode === 'yes';
      yesOption?.classList.toggle('selected', isYes);
      noOption?.classList.toggle('selected', !isYes);
      if (yesPanel) yesPanel.hidden = !isYes;
      if (noPanel) noPanel.hidden = isYes;
      if (cta) cta.hidden = isYes;
    }

    if (yesOption) yesOption.onclick = () => select('yes');
    if (noOption) noOption.onclick = () => select('no');

    const esc = v => String(v || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function selectLead(lead) {
      if (window.CCAccount?.useOwnerArchetypeLead) {
        window.CCAccount.useOwnerArchetypeLead(lead);
      }
      localStorage.setItem('ccProgramPath', destination);
      localStorage.removeItem('ccSignedIn');
      return lead;
    }

    async function viewLeadReport(lead, button) {
      selectLead(lead);
      const original = button?.textContent || 'View Report';
      if (button) { button.disabled = true; button.textContent = 'Preparing Report…'; }
      try {
        if (!window.CCArchetypePDF?.openPdf) throw new Error('The PDF report viewer is unavailable.');
        const opened = await window.CCArchetypePDF.openPdf();
        if (!opened) throw new Error('We could not open this report. Please try again.');
      } catch (error) {
        if (errorNode) {
          errorNode.textContent = error?.message || 'We could not open this report. Please try again.';
          errorNode.classList.add('show');
        }
      } finally {
        if (button) { button.disabled = false; button.textContent = original; }
      }
    }

    function proceedToPayment(lead) {
      selectLead(lead);
      location.href = '/payment/';
    }

    function loginToDiagnostic(lead) {
      const email = String(lead?.email || '').trim(), query = new URLSearchParams();
      if (email) query.set('email', email);
      query.set('destination', destination);
      location.href = '/login/?' + query.toString();
    }

    function renderLeadResults(leads) {
      if (!resultsNode) return;
      resultsNode.innerHTML = leads.map((lead, index) => {
        const paid = lead.is_paid === true && lead.account_exists === true;
        return `<article class="lookup-result-card" data-lead-index="${index}">
          <div class="lookup-result-info">
            <strong>${esc(lead.name)}</strong>
            <span>${esc(lead.email)}</span>
            <small>${esc(lead.agency_url)}</small>
          </div>
          <div class="lookup-result-actions">
            <button type="button" class="cc-btn cc-btn-secondary" data-view-lead="${index}">View Report</button>
            ${paid ? `<button type="button" class="cc-btn cc-btn-primary" data-login-lead="${index}">Login</button>`
                   : `<button type="button" class="cc-btn cc-btn-primary" data-pay-lead="${index}">Proceed to Payment</button>`}
          </div>
        </article>`;
      }).join('');

      resultsNode.querySelectorAll('[data-view-lead]').forEach(node => node.addEventListener('click', () => viewLeadReport(leads[Number(node.dataset.viewLead)], node)));
      resultsNode.querySelectorAll('[data-pay-lead]').forEach(node => node.addEventListener('click', () => proceedToPayment(leads[Number(node.dataset.payLead)])));
      resultsNode.querySelectorAll('[data-login-lead]').forEach(node => node.addEventListener('click', () => loginToDiagnostic(leads[Number(node.dataset.loginLead)])));
    }

    if (form) {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData(form);
        const name = String(formData.get('name') || '').trim();
        const email = String(formData.get('email') || '').trim();
        const agencyUrl = String(formData.get('agencyUrl') || '').trim();

        if (errorNode) errorNode.classList.remove('show');
        if (successNode) successNode.classList.remove('show');
        if (resultsNode) resultsNode.innerHTML = '';

        if (!name && !email && !agencyUrl) {
          if (errorNode) {
            errorNode.textContent = 'Enter your name, email address, or agency URL.';
            errorNode.classList.add('show');
          }
          return;
        }

        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Finding report…'; }

        try {
          if (!window.CCAccount?.lookupOwnerArchetypeLead) {
            throw new Error('Account lookup client is not loaded.');
          }
          const leads = await window.CCAccount.lookupOwnerArchetypeLead({ name, email, agencyUrl });
          if (!leads.length) throw new Error('No Owner Archetype report was found using those details.');

          if (leads.length === 1) {
            const paid = leads[0].is_paid === true && leads[0].account_exists === true;
            if (successNode) {
              successNode.textContent = paid
                ? 'Owner Archetype report found. Your account is already active.'
                : 'Owner Archetype report found. View your report or continue to payment when you are ready.';
              successNode.classList.add('show');
            }
            renderLeadResults(leads);
            return;
          }

          if (successNode) {
            successNode.textContent = 'We found more than one matching report. Choose the correct report below.';
            successNode.classList.add('show');
          }
          renderLeadResults(leads);
        } catch (error) {
          if (errorNode) {
            errorNode.textContent = error?.message || 'We could not find an Owner Archetype report using those details.';
            errorNode.classList.add('show');
          }
        } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Find My Report →'; }
        }
      });
    }
  };

  function openLookupModal() {
    let existingModal = document.getElementById('s3LookupModalOverlay');
    if (existingModal) existingModal.remove();

    const currentOffer = window.location.pathname.split('/').filter(Boolean).pop() || 'platform';
    localStorage.setItem('ccProgramPath', currentOffer);

    const modal = document.createElement('div');
    modal.id = 's3LookupModalOverlay';
    modal.className = 's3-modal-overlay';
    modal.innerHTML = `
      <div class="s3-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="s3LookupModalTitle">
        <button type="button" class="s3-modal-close" id="s3CloseLookupModal" aria-label="Close dialog">×</button>
        <div class="s3-modal-header">
          <h3 id="s3LookupModalTitle">Look up existing Archetype account</h3>
          <p>Enter the email address or agency website domain you used for your Archetype Report.</p>
        </div>
        <form class="s3-lookup-form" id="s3LookupForm">
          <div>
            <label for="s3EmailInput">Owner Email / Agency Domain</label>
            <input type="text" id="s3EmailInput" placeholder="owner@agency.com or agency.com" required autocomplete="email">
          </div>
          <button type="submit" class="s3-btn-submit-lookup" id="s3SubmitLookupBtn">Find Account & Continue →</button>
          <div id="s3LookupStatus" style="margin-top:12px;font-size:12px;color:#ef4444;min-height:16px;"></div>
        </form>
      </div>`;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('open'));

    const closeModal = () => {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 200);
    };

    modal.querySelector('#s3CloseLookupModal')?.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    const keyHandler = e => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', keyHandler);
      }
    };
    document.addEventListener('keydown', keyHandler);

    const form = modal.querySelector('#s3LookupForm');
    const input = modal.querySelector('#s3EmailInput');
    const status = modal.querySelector('#s3LookupStatus');
    const submitBtn = modal.querySelector('#s3SubmitLookupBtn');

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Searching workspace…';
      status.textContent = '';

      try {
        if (window.CCAccount?.findAccount) {
          const found = await window.CCAccount.findAccount({ email: val, agencyUrl: val });
          if (found) {
            window.location.href = `/signup/lookup/?destination=${encodeURIComponent(currentOffer)}&email=${encodeURIComponent(val)}`;
            return;
          }
        }
        // Direct route to signup lookup with query
        window.location.href = `/signup/lookup/?destination=${encodeURIComponent(currentOffer)}&email=${encodeURIComponent(val)}`;
      } catch (err) {
        status.textContent = err.message || 'Could not locate account. Proceeding to checkout…';
        setTimeout(() => {
          window.location.href = `/signup/lookup/?destination=${encodeURIComponent(currentOffer)}&email=${encodeURIComponent(val)}`;
        }, 1200);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSignup3);
  } else {
    initSignup3();
  }
})();
