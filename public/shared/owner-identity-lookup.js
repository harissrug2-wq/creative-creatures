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
      .cc-identity-lookup{max-width:760px;margin:34px auto 28px;padding:24px;border:1px solid #e2e5ee;border-radius:18px;background:#fff;box-shadow:0 16px 38px rgba(27,30,55,.07);text-align:left}
      .cc-identity-lookup *{box-sizing:border-box}.cc-identity-lookup h2{font-size:22px;line-height:1.2;margin:0 0 8px;color:#171820}.cc-identity-lookup>p{margin:0 0 18px;color:#626b7d;line-height:1.55}
      .cc-identity-lookup-options{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cc-identity-lookup-option{border:1px solid #dfe3ec;background:#fff;border-radius:12px;padding:15px;text-align:left;cursor:pointer;color:#22263b}.cc-identity-lookup-option strong{display:block;font-size:15px}.cc-identity-lookup-option span{display:block;color:#6b7280;font-size:13px;margin-top:3px}.cc-identity-lookup-option.selected{border-color:#3538ee;box-shadow:0 0 0 2px rgba(53,56,238,.09)}
      .cc-identity-lookup-panel{margin-top:16px;padding-top:16px;border-top:1px solid #eceef4}.cc-identity-lookup-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cc-identity-lookup-field.full{grid-column:1/-1}.cc-identity-lookup label{display:block;font-weight:700;font-size:12px;margin:0 0 6px;color:#374151}.cc-identity-lookup input{width:100%;border:1px solid #d6dae4;border-radius:9px;padding:11px 12px;font:inherit;background:#fff}.cc-identity-lookup button,.cc-identity-lookup a.cc-lookup-btn{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:9px;padding:11px 15px;font-weight:750;text-decoration:none;cursor:pointer}.cc-lookup-primary{background:#3033eb!important;color:#fff!important}.cc-lookup-secondary{background:#f4f5f8!important;color:#25283b!important}.cc-identity-lookup-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      .cc-identity-lookup-message{margin-top:12px;padding:10px 12px;border-radius:9px;font-size:13px}.cc-identity-lookup-error{background:#fff0f0;color:#b42318}.cc-identity-lookup-success{background:#effaf3;color:#18794e}.cc-identity-lookup-results{display:grid;gap:10px;margin-top:12px}.cc-identity-result{border:1px solid #e5e7ef;border-radius:12px;padding:13px}.cc-identity-result strong,.cc-identity-result span,.cc-identity-result small{display:block}.cc-identity-result span,.cc-identity-result small{color:#6b7280;margin-top:2px}.cc-identity-why{color:#4b5563;line-height:1.55}
      @media(max-width:640px){.cc-identity-lookup{padding:18px}.cc-identity-lookup-options,.cc-identity-lookup-fields{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
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
      if (!response.ok || !data.account) throw new Error(data.error || 'Your free AOFI™ account could not be created.');
      window.CCAccount?.saveAccount?.({...data.account,backend_saved:true},{forceReset:true,replaceDiagnostic:true});
      localStorage.setItem('ccProgramPath','aofi_free');
      localStorage.setItem('ccSignedIn','true');
      location.href='/diagnostic/';
    } catch (error) {
      message.className='cc-identity-lookup-message cc-identity-lookup-error';
      message.textContent=error.message || 'Your free AOFI™ account could not be created.';
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
      <p>Your Owner Identity Report is the first context layer for your free Agency Owner Freedom Index™ score.</p>
      <div class="cc-identity-lookup-options">
        <button type="button" class="cc-identity-lookup-option" data-choice="yes"><strong>Yes, I have one</strong><span>Find my report and continue</span></button>
        <button type="button" class="cc-identity-lookup-option" data-choice="no"><strong>No, not yet</strong><span>Start my Owner Identity assessment</span></button>
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
      <section class="cc-identity-lookup-panel" data-panel="no" hidden>
        <p class="cc-identity-why">Your Owner Identity assessment takes about three minutes. When it is complete, your next step is to establish your free AOFI™ score.</p>
        <a class="cc-lookup-btn cc-lookup-primary" href="/owner-archetype/assessment/?destination=aofi_free&source=aofi-lookup">Start My Owner Identity Assessment →</a>
      </section>`;

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
        message.textContent='Owner Identity Report found. Choose your next step below.';
        results.innerHTML=leads.map((lead,index)=>`
          <article class="cc-identity-result" data-index="${index}">
            <strong>${esc(lead.name)}</strong><span>${esc(lead.email)}</span><small>${esc(lead.agency_url)}</small>
            <div class="cc-identity-lookup-actions">
              <button type="button" class="cc-lookup-secondary" data-view="${index}">View Report</button>
              ${lead.account_exists
                ? `<button type="button" class="cc-lookup-primary" data-login="${index}">Continue to My AOFI™ Score</button>`
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

  function mountAll(){document.querySelectorAll('[data-owner-identity-lookup]').forEach(mount)}
  window.CCOwnerIdentityLookup={mount,mountAll};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountAll);else mountAll();
})();
