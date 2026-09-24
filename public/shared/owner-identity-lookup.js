(() => {
  if (window.CCOwnerIdentityLookup) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));

  function injectStyles() {
    if (document.getElementById('cc-owner-identity-lookup-style')) return;
    const style = document.createElement('style');
    style.id = 'cc-owner-identity-lookup-style';
    style.textContent = `
      .cc-identity-lookup{margin:0;padding:0;background:transparent;text-align:left;color:#111827}
      .cc-identity-lookup *{box-sizing:border-box}
      .cc-identity-lookup h2{font-size:36px;line-height:1.16;letter-spacing:-.035em;margin:0 0 24px;color:#111827;font-weight:800}
      .cc-identity-lookup>p{margin:0 0 34px;color:#566072;line-height:1.5;font-size:18px;max-width:1180px}
      .cc-identity-lookup-options{display:grid;grid-template-columns:1fr 1fr;gap:22px}
      .cc-identity-lookup-option{min-height:132px;border:1px solid #d9dce5;background:#fff;border-radius:20px;padding:28px 28px;text-align:left;cursor:pointer;color:#171b2a;transition:border-color .15s,box-shadow .15s,transform .15s}
      .cc-identity-lookup-option:hover{border-color:#bbbff8;transform:translateY(-1px)}
      .cc-identity-lookup-option strong{display:block;font-size:24px;line-height:1.2;font-weight:800}
      .cc-identity-lookup-option span{display:block;color:#70798a;font-size:18px;line-height:1.4;margin-top:14px}
      .cc-identity-lookup-option.selected{border-color:#3739f0;box-shadow:0 0 0 3px rgba(55,57,240,.08)}
      .cc-identity-lookup-panel{margin-top:24px;padding-top:22px;border-top:1px solid #dedff1}
      .cc-identity-lookup-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .cc-identity-lookup-field.full{grid-column:1/-1}
      .cc-identity-lookup label{display:block;font-weight:750;font-size:14px;margin:0 0 8px;color:#22283a}
      .cc-identity-lookup input{width:100%;border:1px solid #ccd2df;border-radius:12px;padding:14px 15px;font:inherit;background:#fff;font-size:16px}
      .cc-identity-lookup button,.cc-identity-lookup a.cc-lookup-btn{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:12px;padding:13px 18px;font-weight:800;text-decoration:none;cursor:pointer}
      .cc-lookup-primary{background:#3033eb!important;color:#fff!important}
      .cc-lookup-secondary{background:#f4f5f8!important;color:#25283b!important}
      .cc-identity-lookup-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
      .cc-identity-lookup-message{margin-top:14px;padding:11px 13px;border-radius:10px;font-size:14px}
      .cc-identity-lookup-error{background:#fff0f0;color:#b42318}.cc-identity-lookup-success{background:#effaf3;color:#18794e}
      .cc-identity-lookup-results{display:grid;gap:10px;margin-top:12px}.cc-identity-result{border:1px solid #e5e7ef;border-radius:12px;padding:13px;background:#fff}
      .cc-identity-result strong,.cc-identity-result span,.cc-identity-result small{display:block}.cc-identity-result span,.cc-identity-result small{color:#6b7280;margin-top:2px}
      .cc-identity-why{color:#4b5563;line-height:1.55}
      .cc-aofi-confirmation{width:min(680px,calc(100% - 32px));margin:70px auto;background:#fff;border:1px solid #e3e5ec;border-radius:18px;padding:42px;box-shadow:0 18px 55px rgba(16,24,40,.07);text-align:left}
      .cc-aofi-confirmation-check{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:#eaf8ef;color:#169b52;font-size:22px;font-weight:800;margin-bottom:20px}
      .cc-aofi-confirmation h1{font-size:34px;letter-spacing:-.04em;margin:0 0 12px;color:#111827}
      .cc-aofi-confirmation p{font-size:15px;line-height:1.6;color:#667085;margin:0 0 10px}
      .cc-aofi-confirmation-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}
      .cc-aofi-confirmation a{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;padding:12px 18px;font-weight:800;text-decoration:none}
      .cc-aofi-confirmation-primary{background:#3033eb;color:#fff}
      .cc-aofi-confirmation-secondary{background:#f4f5f8;color:#25283b}

      @media(max-width:780px){
        .cc-identity-lookup h2{font-size:30px}.cc-identity-lookup>p{font-size:16px;margin-bottom:24px}
        .cc-identity-lookup-options,.cc-identity-lookup-fields{grid-template-columns:1fr}
        .cc-identity-lookup-option{min-height:auto;padding:22px}
        .cc-identity-lookup-option strong{font-size:21px}.cc-identity-lookup-option span{font-size:16px}
      }
    `;    document.head.appendChild(style);
  }

  async function requestLeads(values) {
    if (window.CCAccount?.lookupOwnerArchetypeLead) return window.CCAccount.lookupOwnerArchetypeLead(values);
    const qs = new URLSearchParams();
    Object.entries(values).forEach(([key,value]) => { if (String(value || '').trim()) qs.set(key, String(value).trim()); });
    const response = await fetch('/api/owner-archetype-leads?' + qs.toString(), { credentials:'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'We could not find your Owner Identity Report.');
    return Array.isArray(data.leads) ? data.leads : [];
  }

  function showFreeAofiConfirmation(lead, data) {
    const firstName = String(lead?.name || '').trim().split(/\s+/)[0] || 'there';
    const emailSent = data?.welcomeEmailSent !== false;
    sessionStorage.setItem('ccAofiFreeConfirmation', JSON.stringify({
      firstName,
      email:lead?.email || '',
      emailSent
    }));
    history.replaceState({}, '', '/owner-archetype/?aofi=confirmed');
    document.body.innerHTML = `
      <main>
        <section class="cc-aofi-confirmation">
          <span class="cc-aofi-confirmation-check">✓</span>
          <h1>Thank You ${esc(firstName)}!</h1>
          <p>Your Free AOFI™ account has been created successfully.</p>
          <p>${emailSent
            ? `We sent a confirmation email to <strong>${esc(lead?.email || '')}</strong> with your account setup link and sign-in details.`
            : `Your account is active. If the confirmation email does not arrive, use Forgot password from the sign-in page to create your password.`}</p>
          <p>You may stop now and sign in later, or continue directly to your Agency Diagnostic.</p>
          <div class="cc-aofi-confirmation-actions">
            <a class="cc-aofi-confirmation-primary" href="/diagnostic/">Continue to Agency Diagnostic →</a>
            <a class="cc-aofi-confirmation-secondary" href="/login/">Sign In Later</a>
          </div>
        </section>
      </main>`;
  }

  async function activateFreeAccount(lead, button, message) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Creating your free AOFI™ account…';
    try {
      const response = await fetch('/api/accounts', {
        method:'POST',
        credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          name:lead.name,
          email:lead.email,
          agencyUrl:lead.agency_url,
          agencyName:lead.agency_name,
          accessPlan:'aofi_free',
          journey:'aofi_free',
          source:'aofi-free',
          leadId:String(lead.id || '').replace(/^account:/,''),
          archetypeResult:lead.archetype_result || {},
          reportData:lead.report_data || {},
          diagnosticState:{indexes:{},count:0,allComplete:false,reportReady:false}
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.account) {
        const error = new Error(data.error || 'Your free AOFI™ account could not be created.');
        error.code = data.code || '';
        error.loginUrl = data.loginUrl || '';
        throw error;
      }
      window.CCAccount?.saveAccount?.({...data.account,backend_saved:true},{forceReset:true,replaceDiagnostic:true});
      localStorage.setItem('ccProgramPath','aofi_free');
      localStorage.setItem('ccSignedIn','true');
      showFreeAofiConfirmation(lead, data);
    } catch (error) {
      message.className='cc-identity-lookup-message cc-identity-lookup-error';
      if (error?.code === 'ACCOUNT_EXISTS' && error?.loginUrl) {
        message.innerHTML=`This email already has a Creative Creatures account. <a href="${esc(error.loginUrl)}"><strong>Sign in to continue →</strong></a>`;
      } else {
        message.textContent=error.message || 'Your free AOFI™ account could not be created.';
      }
      button.disabled=false;
      button.textContent=original;
    }
  }

  function mount(root) {
    if (!root || root.dataset.ccLookupMounted === '1') return;
    root.dataset.ccLookupMounted='1';
    injectStyles();
    root.classList.add('cc-identity-lookup');
    root.innerHTML = `
      <h2>Have you received your Agency Owner Identity Report yet?</h2>
      <p>Our first step is to examine the identity (archetype) of the agency owner. This helps us understand you and how your identity is shaping how you scale your agency. This is free, but extremely valuable and important.</p>
      <div class="cc-identity-lookup-options">
        <button type="button" class="cc-identity-lookup-option" data-choice="yes"><strong>Yes, I have one</strong><span>Please look it up for me</span></button>
        <button type="button" class="cc-identity-lookup-option" data-choice="no"><strong>No, not yet</strong><span>Please let me get started</span></button>
      </div>
      <section class="cc-identity-lookup-panel" data-panel="yes" hidden>
        <form data-lookup-form>
          <div class="cc-identity-lookup-fields">
            <div class="cc-identity-lookup-field full"><label>Name <small>(optional)</small></label><input name="name" autocomplete="name" placeholder="First and last name"></div>
            <div class="cc-identity-lookup-field"><label>Email</label><input name="email" type="email" autocomplete="email" placeholder="you@youragency.com"></div>
            <div class="cc-identity-lookup-field"><label>Agency URL</label><input name="agencyUrl" inputmode="url" placeholder="https://youragency.com"></div>
          </div>
          <div class="cc-identity-lookup-actions"><button class="cc-lookup-primary" type="submit">Find My Report →</button></div>
        </form>
        <div data-message></div><div class="cc-identity-lookup-results" data-results></div>
      </section>
      <section class="cc-identity-lookup-panel" data-panel="no" hidden></section>`;

    const yes=root.querySelector('[data-panel="yes"]'), no=root.querySelector('[data-panel="no"]'), results=root.querySelector('[data-results]'), message=root.querySelector('[data-message]');
    root.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => {
      root.querySelectorAll('[data-choice]').forEach(node => node.classList.toggle('selected', node===button));
      const mode=button.dataset.choice;
      yes.hidden=mode!=='yes'; no.hidden=mode!=='no';
    }));

    root.querySelector('[data-lookup-form]')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form=new FormData(event.currentTarget);
      const values={name:String(form.get('name')||'').trim(),email:String(form.get('email')||'').trim(),agencyUrl:String(form.get('agencyUrl')||'').trim()};
      message.className='';message.textContent='';results.innerHTML='';
      if(!values.name&&!values.email&&!values.agencyUrl){
        message.className='cc-identity-lookup-message cc-identity-lookup-error';message.textContent='Enter your name, email address, or agency URL.';return;
      }
      const submit=event.currentTarget.querySelector('button[type="submit"]'), original=submit.textContent;
      submit.disabled=true;submit.textContent='Finding report…';
      try{
        const leads=await requestLeads(values);
        if(!leads.length)throw new Error('No Owner Identity Report was found using those details.');
        message.className='cc-identity-lookup-message cc-identity-lookup-success';
        message.textContent=leads.some(lead=>lead.account_exists)
          ? 'A Creative Creatures account already exists for this report. Sign in to continue.'
          : 'Owner Identity Report found. Choose your next step below.';
        results.innerHTML=leads.map((lead,index)=>`
          <article class="cc-identity-result" data-index="${index}">
            <strong>${esc(lead.name)}</strong><span>${esc(lead.email)}</span><small>${esc(lead.agency_url)}</small>
            <div class="cc-identity-lookup-actions">
              <button type="button" class="cc-lookup-secondary" data-view="${index}">View Report</button>
              ${lead.account_exists
                ? `<button type="button" class="cc-lookup-primary" data-login="${index}">Account Found — Sign In</button>`
                : `<button type="button" class="cc-lookup-primary" data-free="${index}">Get My Free AOFI™ Score</button>`}
            </div>
          </article>`).join('');

        results.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',async()=>{
          const lead=leads[Number(button.dataset.view)];
          window.CCAccount?.useOwnerArchetypeLead?.(lead);
          try{await window.CCArchetypePDF?.openPdf?.()}catch(error){message.className='cc-identity-lookup-message cc-identity-lookup-error';message.textContent=error.message||'The report could not be opened.'}
        }));
        results.querySelectorAll('[data-free]').forEach(button=>button.addEventListener('click',()=>activateFreeAccount(leads[Number(button.dataset.free)],button,message)));
        results.querySelectorAll('[data-login]').forEach(button=>button.addEventListener('click',()=>{
          const lead=leads[Number(button.dataset.login)],query=new URLSearchParams({destination:'aofi_free'});
          if(lead.email)query.set('email',lead.email);
          location.href='/login/?'+query.toString();
        }));
      }catch(error){
        message.className='cc-identity-lookup-message cc-identity-lookup-error';message.textContent=error.message||'We could not find your Owner Identity Report.';
      }finally{submit.disabled=false;submit.textContent=original;}
    });
  }

  function restoreConfirmation(){
    if(new URLSearchParams(location.search).get('aofi')!=='confirmed')return false;
    try{
      const saved=JSON.parse(sessionStorage.getItem('ccAofiFreeConfirmation')||'null');
      if(!saved)return false;
      showFreeAofiConfirmation({name:saved.firstName,email:saved.email},{welcomeEmailSent:saved.emailSent});
      return true;
    }catch{return false}
  }
  function mountAll(){if(restoreConfirmation())return;document.querySelectorAll('[data-owner-identity-lookup]').forEach(mount)}
  window.CCOwnerIdentityLookup={mount,mountAll};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountAll);else mountAll();
})();
