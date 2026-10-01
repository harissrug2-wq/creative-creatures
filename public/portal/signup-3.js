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
    // Multiple-owner signup flow temporarily hidden for client demo.
  };

  const OWNERSHIP_KEY='ccPendingOwnership';
  const readPendingOwnership=()=>{try{return JSON.parse(localStorage.getItem(OWNERSHIP_KEY)||'null')}catch{return null}};
  const primaryOwnerDefaults=()=>({
    name:[localStorage.getItem('ccOwnerFirstName'),localStorage.getItem('ccOwnerLastName')].filter(Boolean).join(' ').trim(),
    email:(localStorage.getItem('ccOwnerEmail')||'').trim(),
    title:'Owner',ownershipPercent:100,isPrimary:true
  });
  const savePendingOwnership=owners=>localStorage.setItem(OWNERSHIP_KEY,JSON.stringify(owners));

  function initOwnershipSignup(){
    const lookupCard=document.querySelector('.lookup-embedded-card');
    if(!lookupCard||document.getElementById('signupOwnershipCard'))return;
    const current=readPendingOwnership();
    const owners=Array.isArray(current)&&current.length?current:[primaryOwnerDefaults()];
    const card=document.createElement('section');
    card.id='signupOwnershipCard';
    card.className='signup-ownership-card';
    card.innerHTML=`
      <div class="signup-ownership-head">
        <div><span class="signup-ownership-kicker">AGENCY OWNERSHIP</span><h2>Does this agency have more than one owner?</h2><p>Add every active owner or partner now. Ownership must total 100%. This structure is used for Owner Independence and future AOFI™ Scorecards.</p></div>
        <div class="signup-ownership-total"><span>Total</span><strong id="signupOwnershipTotal">100%</strong></div>
      </div>
      <div class="signup-ownership-choice">
        <button type="button" data-owner-mode="single">One owner</button>
        <button type="button" data-owner-mode="multiple">Multiple owners / partners</button>
      </div>
      <div id="signupOwnerRows"></div>
      <div class="signup-ownership-actions"><button type="button" class="cc-btn cc-btn-secondary" id="signupAddPartner">＋ Add Partner</button><span id="signupOwnershipError"></span></div>`;
    lookupCard.insertAdjacentElement('afterend',card);

    let rows=owners.map((o,i)=>({...o,isPrimary:i===0}));
    const rowsEl=card.querySelector('#signupOwnerRows'),totalEl=card.querySelector('#signupOwnershipTotal'),errorEl=card.querySelector('#signupOwnershipError'),addBtn=card.querySelector('#signupAddPartner');
    const render=()=>{
      const multi=rows.length>1;
      card.querySelectorAll('[data-owner-mode]').forEach(b=>b.classList.toggle('selected',(b.dataset.ownerMode==='multiple')===multi));
      addBtn.hidden=!multi;
      rowsEl.innerHTML=rows.map((o,i)=>`<div class="signup-owner-row" data-index="${i}">
        <div class="signup-owner-row-head"><strong>${i===0?'Primary owner':'Partner '+i}</strong>${i===0?'':'<button type="button" data-remove-owner>Remove</button>'}</div>
        <label>Full name<input data-field="name" value="${String(o.name||'').replace(/"/g,'&quot;')}" placeholder="Full name"></label>
        <label>Email<input data-field="email" type="email" value="${String(o.email||'').replace(/"/g,'&quot;')}" placeholder="owner@agency.com"></label>
        <label>Role / title<input data-field="title" value="${String(o.title||'').replace(/"/g,'&quot;')}" placeholder="Managing Partner"></label>
        <label>Ownership %<input data-field="ownershipPercent" type="number" min="0" max="100" step="0.01" value="${Number(o.ownershipPercent||0)}"></label>
      </div>`).join('');
      bindRows();sync();
    };
    const bindRows=()=>{
      rowsEl.querySelectorAll('.signup-owner-row').forEach(el=>{
        const i=Number(el.dataset.index);
        el.querySelectorAll('[data-field]').forEach(input=>input.addEventListener('input',()=>{
          rows[i][input.dataset.field]=input.dataset.field==='ownershipPercent'?Number(input.value||0):input.value.trim();
          sync();
        }));
        el.querySelector('[data-remove-owner]')?.addEventListener('click',()=>{rows.splice(i,1);render()});
      });
    };
    const sync=()=>{
      rows[0].isPrimary=true;
      const total=rows.reduce((s,o)=>s+Number(o.ownershipPercent||0),0);
      totalEl.textContent=`${total.toFixed(2).replace('.00','')}%`;
      const valid=Math.abs(total-100)<=0.01&&rows.every(o=>o.name&&(!o.email||/^\S+@\S+\.\S+$/.test(o.email)));
      totalEl.classList.toggle('invalid',!valid);
      errorEl.textContent=valid?'':'Ownership must total 100%, and each owner needs a name.';
      savePendingOwnership(rows);
    };
    card.querySelector('[data-owner-mode="single"]').onclick=()=>{const p=rows[0]||primaryOwnerDefaults();rows=[{...p,ownershipPercent:100,isPrimary:true}];render()};
    card.querySelector('[data-owner-mode="multiple"]').onclick=()=>{if(rows.length===1){rows[0].ownershipPercent=50;rows.push({name:'',email:'',title:'Partner',ownershipPercent:50,isPrimary:false})}render()};
    addBtn.onclick=()=>{const used=rows.reduce((s,o)=>s+Number(o.ownershipPercent||0),0);rows.push({name:'',email:'',title:'Partner',ownershipPercent:Math.max(0,100-used),isPrimary:false});render()};
    render();
  }

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
      localStorage.setItem('ccProgramPath', destination);
      const query=new URLSearchParams({plan:destination,source:'signup'});
      const email=String(lead?.email||'').trim();
      if(email)query.set('email',email);
      location.href='/payment/?'+query.toString();
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
