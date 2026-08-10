(() => {
  const host = document.querySelector('#checkoutPage');
  if (!host) return;

  const storedAccount = (() => { try { return JSON.parse(localStorage.getItem('ccUserAccount') || 'null'); } catch { return null; } })();
  const storedFirstName = localStorage.getItem('ccOwnerFirstName') || '';
  const storedLastName = localStorage.getItem('ccOwnerLastName') || '';
  const defaultName = storedAccount?.displayName || [storedFirstName, storedLastName].filter(Boolean).join(' ') || 'Agency Owner';
  const defaultEmail = storedAccount?.email || localStorage.getItem('ccOwnerEmail') || '';

  host.innerHTML = `
    <a href="/"><img class="checkout-logo" src="/monitor/creative-creatures-logo.png" alt="Creative Creatures"></a>
    
    <section class="checkout-progress">
      <div class="checkout-step complete"><span>✓</span><b>Identity Assessment</b></div><i></i>
      <div class="checkout-step current"><span>2</span><b>Payment & Account</b></div><i></i>
      <div class="checkout-step"><span>3</span><b>Integrations</b></div>
    </section>

    <section class="checkout-grid">
      <div class="checkout-copy">
        <h1>Agency Diagnostic Checkout</h1>
        <p>Set up your user account and unlock access to your guided Agency Diagnostic.</p>
        
        <form class="payment-form" id="paymentForm">
          <div class="field">
            <label for="fullName">Full Name</label>
            <input id="fullName" type="text" value="${escapeHtml(defaultName)}" placeholder="Jane Doe" required>
          </div>
          <div class="field">
            <label for="email">Work Email</label>
            <input id="email" type="email" value="${escapeHtml(defaultEmail)}" placeholder="owner@agency.com" required>
          </div>
          <div class="field">
            <label for="cardName">Name on card</label>
            <input id="cardName" type="text" value="${escapeHtml(defaultName)}" required>
          </div>
          <div class="field">
            <label for="cardNumber">Card number</label>
            <input id="cardNumber" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" required>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="expiry">Expiry</label>
              <input id="expiry" placeholder="MM/YY" autocomplete="cc-exp" required>
            </div>
            <div class="field">
              <label for="cvc">CVC</label>
              <input id="cvc" inputmode="numeric" placeholder="123" autocomplete="cc-csc" required>
            </div>
          </div>

          <button class="pay-button" id="payButton" type="submit">Complete & Continue →</button>
          <p class="secure-note">🔒 Encrypted payment simulation — provisions multi-tenant workspace.</p>
        </form>
      </div>

      <aside class="checkout-side">
        <article class="order-card">
          <div class="card-kicker">Included with your diagnostic</div>
          <div class="order-title">
            <div>
              <h2>Agency Diagnostic Access</h2>
              <code>Guided diagnostic suite</code>
            </div>
          </div>
          <p>Complete access to your agency back-office analysis and strategic scorecard.</p>
          <div class="order-features">
            <span><b>✓</b> Owner Archetype assessment & report</span>
            <span><b>✓</b> Back-office software integrations analysis</span>
            <span><b>✓</b> Financial data uploads & SDE analysis</span>
            <span><b>✓</b> Agency Owner Freedom Index & valuation</span>
            <span><b>✓</b> 90-day priorities & departmental goal tracker</span>
          </div>
        </article>

        <article class="executive-card">
          <header>
            <span>Your fractional executive</span>
            <div class="exec-profile">
              <div class="exec-avatar">MR</div>
              <div>
                <h3>Marcus Reyes</h3>
                <p>Fractional COO · assigned on activation</p>
              </div>
            </div>
          </header>
          <footer>
            <span>✉ &nbsp;marcus@creativecreatures.co</span>
            <span>📅 &nbsp;Kickoff invite lands in your inbox within 24 hours</span>
          </footer>
        </article>
      </aside>
    </section>

    <div class="modal-backdrop" id="paymentSuccessModal">
      <section class="modal-card">
        <div class="success-icon">✓</div>
        <h2 id="successTitle">Thank You!</h2>
        <p id="successCopy">We have emailed you a receipt for your agency diagnostic to this email address. You may stop now and sign in later.</p>
        
        <div class="post-payment-options">
          <a class="option-btn secondary" href="/sign-in/">Sign in later from creativecreatures.org to continue.</a>
          <a class="option-btn primary" href="/integrations/">Continue with the next steps →</a>
        </div>
      </section>
    </div>`;

  document.querySelector('#paymentForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const nameInput = document.querySelector('#fullName')?.value.trim() || 'Agency Owner';
    const emailInput = document.querySelector('#email')?.value.trim() || 'owner@agency.com';
    const button = document.querySelector('#payButton');
    if (button) {
      button.disabled = true;
      button.textContent = 'Processing payment…';
    }

    const nameParts = nameInput.split(' ');
    const firstName = nameParts[0] || 'Agency';
    const lastName = nameParts.slice(1).join(' ') || 'Owner';

    // Account creation & Multi-tenancy setup
    localStorage.setItem('ccUserAccount', JSON.stringify({
      displayName: nameInput,
      email: emailInput,
      createdAt: new Date().toISOString()
    }));
    localStorage.setItem('ccOwnerFirstName', firstName);
    localStorage.setItem('ccOwnerLastName', lastName);
    localStorage.setItem('ccOwnerEmail', emailInput);
    localStorage.setItem('ccSignedIn', 'true');
    localStorage.setItem('agencyPaymentComplete', 'true');

    // Update thank you copy with exact prompt requirement:
    // "Thank you, [User's Name]. We have emailed you a receipt for your agency diagnostic to this email address. You may stop now and sign in later."
    const successCopy = document.querySelector('#successCopy');
    if (successCopy) {
      successCopy.textContent = `Thank you, ${nameInput}. We have emailed you a receipt for your agency diagnostic to this email address. You may stop now and sign in later.`;
    }

    setTimeout(() => {
      document.querySelector('#paymentSuccessModal')?.classList.add('show');
    }, 600);
  });

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]);
  }
})();
