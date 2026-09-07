(() => {
  const initSignup3 = () => {
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
