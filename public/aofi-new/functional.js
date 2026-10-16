(() => {
  const params = new URLSearchParams(location.search);
  const screen = params.get('screen') || 'index';
  const workspaceScreens = new Set(['s05','s06','s07','s08','s09','s10','s15','s16','s17','s18','s19','s20','s21','s22','s23','s24','s25','s26','s27','s28','s29','s30','s31','s32','s33','s34','s35','s36','s37','s38','s39','s40']);
  const scoreScreens = new Set(['s07','s08','s09','s10']);
  const goalsScreens = new Set(['s21','s22','s23','s24','s25','s37','s38','s39','s40']);
  const monitorScreens = new Set(['s29','s30','s31']);
  const integrationScreens = new Set(['s26','s27','s28']);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const qs = (s, root=document) => root.querySelector(s);
  const qsa = (s, root=document) => [...root.querySelectorAll(s)];
  const money = value => Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value)) : '—';
  const fmt = (definition, value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    if (definition?.unit === '$') return money(n);
    if (definition?.unit === '%') return (Number.isInteger(n)?n:n.toFixed(1)) + '%';
    if (definition?.unit === 'level') return (Number.isInteger(n)?n:n.toFixed(1)) + ' / 5';
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  };

  const style = document.createElement('style');
  style.textContent = '.cc-live-banner{position:sticky;top:82px;z-index:15;margin:0 auto 16px;width:min(1500px,calc(100% - 48px));padding:11px 14px;border-radius:12px;background:#eef7ff;border:1px solid #cfe4ff;color:#174f8b;font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:12px}.cc-live-banner.error{background:#fff1f1;border-color:#f2caca;color:#a02f2f}.cc-live-banner.success{background:#edf9f1;border-color:#ccebd7;color:#137b45}.cc-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999;background:#111827;color:#fff;padding:12px 16px;border-radius:12px;box-shadow:0 18px 42px rgba(0,0,0,.22);max-width:min(560px,calc(100vw - 24px));font-size:13px}.cc-live-history{display:grid;gap:10px;width:100%;max-width:980px;margin:18px auto 0}.cc-history-row{display:grid;grid-template-columns:160px 90px 1fr;gap:14px;align-items:center;padding:13px 15px;border:1px solid #e6e8ef;background:#fff;border-radius:12px;text-align:left}.cc-history-row b{font-size:22px}@media(max-width:700px){.cc-live-banner{top:72px;width:calc(100% - 24px);flex-direction:column;align-items:flex-start}.cc-history-row{grid-template-columns:1fr 70px}.cc-history-row>:last-child{grid-column:1/-1}}';
  document.head.appendChild(style);

  function toast(message, timeout=3000){
    qs('.cc-toast')?.remove();
    const node=document.createElement('div'); node.className='cc-toast'; node.textContent=message; document.body.appendChild(node);
    setTimeout(()=>node.remove(),timeout);
  }
  function banner(message,type=''){
    let node=qs('.cc-live-banner');
    if(!node){node=document.createElement('div');node.className='cc-live-banner';qs('.topbar')?.after(node);}
    node.className=('cc-live-banner '+type).trim();
    node.innerHTML='<span>'+esc(message)+'</span><span style="font-weight:800">Live account data</span>';
    return node;
  }
  const account = () => window.CCAccount?.getAccount?.() || {};
  async function workspaceAccess(){
    const response=await fetch('/api/account-auth?action=workspace_access',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok || payload.authenticated===false){const e=new Error(payload.error||'Sign in to continue.');e.status=response.status;throw e;}
    return payload;
  }
  function bindHeader(){
    const destinations=['s01','s05','s07','s29','s21','s26','s32'];
    qsa('.nav span').forEach((node,i)=>{node.style.cursor='pointer';node.onclick=()=>location.href='/aofi-new/?screen='+(destinations[i]||'s01');});
    qsa('.ask').forEach(node=>{node.style.cursor='pointer';node.onclick=()=>location.href='/ask-creature/';});
  }
  function bindEntry(){
    if(screen==='s41'){
      const button=qsa('button').find(x=>x.textContent.includes('Get My AOFI'));
      if(button)button.onclick=()=>{
        const inputs=qsa('input');
        const first=inputs[0]?.value?.trim()||'',last=inputs[1]?.value?.trim()||'',url=inputs[2]?.value?.trim()||'',email=inputs[3]?.value?.trim()||'';
        if(!email || !/^\S+@\S+\.\S+$/.test(email)){toast('Enter a valid work email.');return;}
        localStorage.setItem('ccOwnerEmail',email); if(url)localStorage.setItem('ccAgencyWebsite',url); if(first||last)localStorage.setItem('ccOwnerName',(first+' '+last).trim());
        localStorage.setItem('ccProgramPath','aofi_free');
        location.href='/owner-archetype/assessment/?destination=aofi_free&source=aofi-new&email='+encodeURIComponent(email);
      };
    }
    if(screen==='s42'){const a=qs('a.btn.green');if(a)a.href='/aofi-new/?screen=s01';}
    if(screen==='s01'||screen==='s02'){
      const no=qsa('a.btn,button.btn').find(x=>x.textContent.includes('Start my Owner Archetype'));
      if(no)no.onclick=e=>{e.preventDefault();localStorage.setItem('ccProgramPath','aofi_free');location.href='/owner-archetype/assessment/?destination=aofi_free&source=aofi-new';};
      const yes=qsa('button.btn').find(x=>x.textContent.includes("I've done it")); if(yes)yes.onclick=()=>location.href='/aofi-new/?screen=s13';
    }
    if(screen==='s13'||screen==='s14'){
      const email=qs('.lookup input'); const button=qsa('.lookup .btn').find(x=>x.textContent.includes('secure link'));
      if(button)button.onclick=()=>{const value=email?.value?.trim()||'';location.href='/signup/lookup/?destination=aofi_free'+(value?'&email='+encodeURIComponent(value):'');};
    }
  }
  function bindOwnerFlow(){
    if(!screen.startsWith('owner-'))return;
    const current=account(); const title=current?.archetype_result?.title||current?.report_data?.archetypeTitle||current?.reportData?.archetypeTitle;
    if(title&&(screen==='owner-04'||screen==='owner-05'))qsa('h1').forEach(h=>{if(h.textContent.includes('Strategic Builder'))h.textContent=title;});
    if(['owner-01','owner-02','owner-03'].includes(screen)){
      const real=()=>{localStorage.setItem('ccProgramPath','aofi_free');location.href='/owner-archetype/assessment/?destination=aofi_free&source=aofi-new';};
      qsa('a.btn.navy,.choice').forEach(node=>node.onclick=e=>{e.preventDefault();real();});
    }
    if(screen==='owner-04')qsa('a.btn').forEach(node=>{if(node.textContent.includes('full report'))node.href='/owner-archetype/';if(node.textContent.includes('Continue'))node.href='/aofi-new/?screen=s03';});
    if(screen==='owner-05'){const a=qsa('a.btn').find(x=>x.textContent.includes('Continue'));if(a)a.href='/aofi-new/?screen=s03';}
  }
  async function hydrateAccountSetup(){
    if(screen!=='s03'&&screen!=='s04')return;
    try{await window.CCAccount?.ready}catch{}
    const a=account(); const name=(a.name||'').trim().split(/\s+/)[0]||'there';
    qsa('h1').forEach(h=>{if(h.textContent.includes('Nice work'))h.textContent='Nice work, '+name+'.';});
    if(screen==='s03'){
      const card=qs('.card');
      if(card&&!qsa('.btn',card).length){
        const next=document.createElement('a');next.className='btn navy';next.style.marginTop='22px';next.href='/aofi-new/?screen=s04';next.textContent='Create my password to continue →';card.appendChild(next);
      }
      return;
    }
    const emailInput=qsa('.field input')[0],passwordInput=qsa('.field input')[1],terms=qs('input[type="checkbox"]');
    if(emailInput&&a.email)emailInput.value=a.email;
    const cta=qsa('.btn.navy').find(x=>x.textContent.includes('Save and start'));
    if(cta)cta.onclick=async e=>{
      e.preventDefault();
      if(!a.id){location.href='/signup/lookup/?destination=aofi_free';return;}
      const password=passwordInput?.value||'';
      if(password.length<8){toast('Use at least 8 characters for your password.');return;}
      if(terms&&!terms.checked){toast('Agree to the Terms and Privacy policy to continue.');return;}
      cta.textContent='Saving password…';cta.setAttribute('aria-disabled','true');
      try{
        const response=await fetch('/api/account-auth',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set_initial_password',password})});
        const payload=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(payload.error||'Your password could not be saved.');
        toast('Password saved.');location.href='/aofi-new/?screen=s05';
      }catch(err){cta.textContent='Save and start my assessments →';cta.removeAttribute('aria-disabled');toast(err.message||'Your password could not be saved.',5000);}
    };
  }
  async function hydrateDiagnostic(){
    if(!['s05','s06','s15','s16','s17','s18'].includes(screen))return;
    const state=window.CCDiagnostic?.getState?.(); if(!state)return;
    if(screen==='s05'||screen==='s06'){
      const completed=1+Number(state.count||0); const sub=qs('.title .muted'); if(sub)sub.textContent=completed+' of 4 complete · '+(state.allComplete?'your score is ready':'about 15 minutes left');
      const cards=qsa('.timeline-card'),status=[state.ownerComplete,state.strength,state.independence,state.performance],links=['/owner-archetype/','/agency-strength-index/','/independence-index/','/agency-performance-index/'];
      cards.forEach((card,i)=>{if(status[i]){card.classList.add('complete');const c=qs('.circle',card);if(c)c.textContent='✓';}const a=qs('a.btn',card);if(a)a.href=links[i]||'#';});
      if(state.allComplete){const a=document.createElement('a');a.className='btn grad';a.href=state.reportReady?'/aofi-new/?screen=s07':'/aofi-new/?screen=s15';a.textContent=state.reportReady?'View my AOFI™ score →':'Generate my AOFI™ score →';qs('.title')?.appendChild(a);}
    }
    if(['s15','s16','s17','s18'].includes(screen)){
      const button=qsa('.btn.grad').find(x=>/Generate|Regenerate/i.test(x.textContent));
      if(button)button.onclick=async e=>{e.preventDefault();button.textContent='Generating…';try{await window.CCScorecard.generate();window.CCDiagnostic?.completeReportGeneration?.();location.href='/aofi-new/?screen=s07';}catch(err){toast(err.message||'Score could not be generated.',5000);}};
    }
  }
  async function hydrateScore(){
    if(!scoreScreens.has(screen))return;
    banner('Loading your saved AOFI™ score…');
    try{
      const model=await window.CCScorecard.load({fresh:true}),reports=model?.reports||{};
      const ring=qs('.ring strong');if(ring)ring.textContent=Math.round(Number(model.score)||0);
      const band=qs('.score-main .pill');if(band)band.textContent=(model.band?.label||'AOFI™')+' · '+Math.round(Number(model.score)||0)+'/100';
      const pills=qsa('.score-main .pill');if(pills[1])pills[1].innerHTML='Confidence <b>&nbsp;'+Math.round(Number(model.confidence)||0)+'%</b>';
      const val=qs('.score-top .score-card:nth-child(2) .value');if(val)val.textContent=model.valuation?.available?money(model.valuation.enterpriseValue):'Needs evidence';
      const ids=['performance','strength','independence'];
      qsa('.indexes .index').forEach((card,i)=>{const r=reports[ids[i]];if(!r)return;const m=qs('.mini',card);if(m)m.textContent=Math.round(Number(r.score)||0);const h=qs('h2',card);if(h)h.textContent=r.title;const p=qs('p',card);if(p)p.textContent=r.primaryConstraint||r.executiveQuestion;const open=qs('b',card);if(open){open.style.cursor='pointer';open.onclick=()=>location.href='/agency-scorecard/'+ids[i]+'/';}});
      if(screen==='s08'){
        const history=window.CCScorecard.getHistory?.()||[],trend=qs('.trend');
        if(trend)trend.innerHTML=history.length?'<div style="width:100%"><h2>Dated AOFI™ recalculations</h2><div class="cc-live-history">'+history.map((row,i)=>{const d=row.generatedAt?new Date(row.generatedAt).toLocaleString():'Saved score';const delta=i?Number(row.score)-Number(history[i-1].score):0;return '<div class="cc-history-row"><span>'+esc(d)+'</span><b>'+Math.round(Number(row.score)||0)+'</b><span>'+(i?(delta>=0?'+':'')+delta.toFixed(1)+' pts':'Baseline')+'</span></div>';}).join('')+'</div></div>':'<div><h2>Your first score is the baseline</h2><p class="muted">Regenerate AOFI™ after material changes to build a dated trend.</p></div>';
      }
      const define=qsa('a.btn').find(x=>x.textContent.includes('Define Agency Goals'));if(define)define.href='/aofi-new/?screen=s21';
      const build=qsa('a.btn').find(x=>x.textContent.includes('Build my 90-day plan'));
      if(build)build.onclick=async e=>{e.preventDefault();const a=account(),plan=a.accessPlan||a.access_plan||a.journey||'';if(plan==='aofi_free'){location.href='/payment/?plan=platform&source=aofi-new';return;}const picks=(model.opportunities||[]).slice(0,3).map((x,i)=>({title:x.capability||'Priority '+(i+1),description:x.recommendation||'',sourceType:'opportunity',sourceKey:'opportunity:'+(x.index||'index')+':'+String(x.capability||i).toLowerCase().replace(/[^a-z0-9]+/g,'-')}));try{if(picks.length)await window.CCGoals.createRocks(picks);location.href='/aofi-new/?screen=s24';}catch(err){toast(err.message||'Could not create priorities.',5000);}};
      banner('Showing live AOFI™ score for this account.','success');
    }catch(err){banner(err.message||'Your AOFI™ score is not available yet.','error');}
  }
  function targetDisplay(model,metric){const target=model.targets?.[metric.id],resolved=target?.resolvedValue??target?.resolved_target_value;return Number.isFinite(Number(resolved))?fmt(metric,resolved):'Not set';}
  async function hydrateGoals(){
    if(!goalsScreens.has(screen))return;
    if(['s37','s38','s39','s40'].includes(screen)){await bindGoalModal();return;}
    banner('Loading Agency Goals from your workspace…');
    try{
      const model=await window.CCGoals.load({fresh:true});if(!model)throw new Error('Agency Goals returned no data.');
      if(model.preview)banner('Free AOFI accounts can preview Agency Goals. Upgrade to save changes.','error');else banner('Agency Goals loaded for '+(model.account?.agencyName||model.account?.name||'this agency')+'.','success');
      const sections=qsa('.goal-section');
      if(sections[0]){const grid=qs('.score-grid',sections[0]);if(grid)grid.innerHTML=(model.metrics||[]).map(metric=>'<div class="metric" data-metric="'+esc(metric.id)+'"><small>'+esc(metric.label)+'</small><b>'+esc(metric.actualDisplay||fmt(metric,metric.actualValue))+'</b><div class="muted">Target '+esc(targetDisplay(model,metric))+'</div><button class="btn outline cc-set-target" data-id="'+esc(metric.id)+'" style="margin-top:12px;padding:9px 12px">'+(model.preview?'Upgrade to edit':'Set target')+'</button></div>').join('');qsa('.cc-set-target',grid).forEach(btn=>btn.onclick=async()=>{if(model.preview){location.href='/payment/?plan=platform&source=aofi-new';return;}const metric=model.metrics.find(x=>x.id===btn.dataset.id),raw=prompt('Set target for '+metric.label,String(model.targets?.[metric.id]?.resolvedValue??metric.actualValue??''));if(raw===null)return;try{await window.CCGoals.saveTarget(metric.id,'number',Number(raw),'Set from new AOFI UI');location.reload();}catch(err){toast(err.message||'Target could not be saved.',5000);}});}
      const dept=qs('#departments .table')||qsa('.goal-section .table')[0];if(dept)dept.innerHTML=(model.departments||[]).filter(x=>x.goal||x.suggestion).map(row=>'<div class="row"><b>'+esc(row.name)+'</b><span>'+esc(row.goal||row.suggestion?.goal||'Needs definition')+'</span><span>'+esc(row.owner||'Unassigned')+'</span><span class="status">'+esc(row.status||'Needs Definition')+'</span></div>').join('')||'<div class="row"><b>No department goals yet</b><span>Use Add departmental goal.</span><span></span><span></span></div>';
      const rocks=qs('#rocks .table')||qsa('.goal-section .table')[1];if(rocks)rocks.innerHTML=(model.rocks||[]).map(row=>'<div class="row"><b>'+esc(row.title)+'</b><span>'+esc(row.description||row.sourceType||'90-day priority')+'</span><span>'+esc(row.owner||'Unassigned')+'</span><span class="status">'+esc(row.status||row.due||'Not started')+'</span></div>').join('')||'<div class="row"><b>No 90-day rocks yet</b><span>Create priorities from the AOFI™ score after defining goals.</span><span></span><span></span></div>';
      qsa('a.btn').forEach(a=>{if(a.textContent.includes('Add departmental'))a.href='/aofi-new/?screen=s37';if(a.textContent.includes('Add rock'))a.href='/aofi-new/?screen=s38';if(a.textContent.includes('Add your team'))a.href='/users/';});
    }catch(err){banner(err.message||'Agency Goals could not be loaded.','error');}
  }
  async function bindGoalModal(){
    if(screen==='s40'){const save=qsa('.btn.grad')[0];if(save)save.onclick=()=>location.href='/users/';return;}
    try{
      const model=await window.CCGoals.load({fresh:true});if(model.preview)banner('Upgrade is required before Agency Goals can be edited.','error');
      const fields=qsa('.modal input,.modal select'),save=qsa('.modal .btn.grad')[0];
      if(screen==='s37'&&save)save.onclick=async()=>{if(model.preview){location.href='/payment/?plan=platform&source=aofi-new';return;}const department=fields[0]?.value||'Marketing',goal=fields[1]?.value?.trim()||'',done=fields[2]?.value?.trim()||'',owner=fields[3]?.value||'Agency Owner';if(!goal){toast('Enter a departmental goal.');return;}try{await window.CCGoals.saveDepartment({department,goal,owner,done,status:'Needs Definition',completion:'This quarter'});location.href='/aofi-new/?screen=s23';}catch(err){toast(err.message||'Goal could not be saved.',5000);}};
      if(screen==='s38'&&save)save.onclick=async()=>{if(model.preview){location.href='/payment/?plan=platform&source=aofi-new';return;}const title=fields[0]?.value?.trim()||'',owner=fields[2]?.value||'Agency Owner',due=fields[3]?.value||'This quarter';if(!title){toast('Enter a 90-day rock.');return;}try{await window.CCGoals.createRocks([{title,owner,due,sourceType:'manual',sourceKey:'manual:'+Date.now()}]);location.href='/aofi-new/?screen=s24';}catch(err){toast(err.message||'Rock could not be added.',5000);}};
      if(screen==='s39'&&save){const rock=(model.rocks||[])[0];if(rock&&fields[0])fields[0].value=rock.title||'';save.onclick=async()=>{if(!rock){toast('No saved rock is available to edit.');return;}try{await window.CCGoals.updateRock({id:rock.id,title:fields[0]?.value||rock.title,owner:fields[2]?.value||rock.owner,due:fields[3]?.value||rock.due});location.href='/aofi-new/?screen=s24';}catch(err){toast(err.message||'Rock could not be updated.',5000);}};}
      qsa('.modal .btn.outline').forEach(b=>b.onclick=()=>history.back());
    }catch(err){banner(err.message||'Agency Goals could not be loaded.','error');}
  }
  async function hydrateMonitor(){
    if(!monitorScreens.has(screen))return;
    banner('Loading Monitor from your saved Agency Goals and source data…');
    try{
      const model=await window.CCGoals.load({fresh:true}),metrics=model.metrics||[];
      const holder=qs('#monitor-kpis .kpis');if(holder)holder.innerHTML=metrics.map(metric=>{const target=targetDisplay(model,metric),p=model.progress?.[metric.id],state=p?.state==='achieved'?'On pace':p?.state==='in_progress'?'Watch':target==='Not set'?'Set target':'Off pace';return '<div class="metric"><small>'+esc(metric.label)+'</small><b>'+esc(metric.actualDisplay||fmt(metric,metric.actualValue))+'</b><div class="muted">Goal '+esc(target)+'</div><span class="status" style="margin-top:10px">'+esc(state)+'</span></div>';}).join('');
      const top=qsa('.goal-section .table')[0];if(top)top.innerHTML=metrics.slice(0,4).map(metric=>'<div class="row"><b>'+esc(metric.label)+'</b><span>'+esc(metric.actualDisplay||fmt(metric,metric.actualValue))+'</span><span>'+esc(targetDisplay(model,metric))+'</span><span class="status">'+(model.progress?.[metric.id]?.state==='achieved'?'On pace':'Watch')+'</span></div>').join('');
      if(model.preview)banner('Monitor is preview-only on Free AOFI. Upgrade to use live operating data.','error');else banner('Monitor loaded for '+(model.account?.agencyName||model.account?.name||'this agency')+'.','success');
    }catch(err){banner(err.message||'Monitor could not load account data.','error');}
  }
  async function hydrateIntegrations(){
    if(!integrationScreens.has(screen))return;
    banner('Checking connected integrations…');
    try{
      const response=await fetch('/api/account-auth?action=integration_statuses',{credentials:'same-origin',cache:'no-store'}),payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||'Integration status could not be loaded.');
      qsa('.integration-item').forEach(row=>{row.style.cursor='pointer';row.onclick=()=>location.href='/integrations/';});qsa('.integration-head .btn').forEach(btn=>btn.onclick=()=>location.href='/integrations/');
      banner('Integration status is live. Open an integration to connect, sync, manage or disconnect it.','success');
    }catch(err){banner(err.message||'Integration status could not be loaded.','error');}
  }
  function bindUpgrade(){
    if(screen==='s11'){const buttons=qsa('.modal .btn');if(buttons[0])buttons[0].onclick=()=>location.href='/payment/?plan=platform&source=aofi-new';if(buttons[1])buttons[1].onclick=()=>location.href='/payment/?plan=fractional_coo&source=aofi-new';}
    if(screen==='s12'){const button=qsa('.btn.blue')[0];if(button)button.onclick=()=>location.href='/payment/?plan=fractional_coo&source=aofi-new';}
    if(screen==='s19'||screen==='s20'){const button=qsa('a.btn.grad')[0];if(button)button.href='/aofi-new/?screen=s21';}
  }
  function bindPortal(){
    if(!['s32','s33','s34','s35','s36'].includes(screen))return;
    qsa('.program,.metric').forEach(node=>{node.style.cursor='pointer';node.onclick=()=>location.href='/portal/';});const btn=qs('.portal-hero .btn');if(btn)btn.onclick=()=>location.href='/portal/';
  }
  async function init(){
    bindHeader();bindEntry();bindOwnerFlow();bindUpgrade();bindPortal();
    try{await window.CCAccount?.ready}catch{}
    await hydrateAccountSetup();
    if(workspaceScreens.has(screen)){
      try{await workspaceAccess();}
      catch(err){banner('Sign in to use this live workspace screen.','error');if(err.status===401){const node=qs('.cc-live-banner');if(node)node.innerHTML='<span>Sign in to use this live workspace screen.</span><a class="btn navy" style="padding:8px 12px;width:auto" href="/login/?destination=aofi_free">Sign in →</a>';}return;}
    }
    await hydrateDiagnostic();await hydrateScore();await hydrateGoals();await hydrateMonitor();await hydrateIntegrations();
  }
  init().catch(err=>{console.error('AOFI new functional UI error',err);toast(err.message||'This screen could not finish loading.',5000);});
})();