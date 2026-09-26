(()=>{
  const root=document.querySelector('#ownershipRoot');
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let model=null;

  async function request(options={}){
    const response=await fetch('/api/ownership',{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||'Ownership request failed.');
    return payload;
  }
  const activeOwners=()=>Array.isArray(model?.owners)?model.owners.filter(o=>o.status==='active'):[];
  const total=()=>activeOwners().reduce((sum,o)=>sum+Number(o.ownershipPercent||0),0);
  const statusCopy=status=>status==='complete'?'Owner Identity complete':status==='invited'?'Identity invitation sent':status==='in_progress'?'Identity in progress':'Owner Identity not started';

  function row(owner,index){
    const primary=owner.isPrimary===true;
    return `<article class="owner-card" data-owner-index="${index}">
      <div class="owner-card-top"><div><span class="owner-number">Owner ${index+1}</span><strong>${primary?'Primary Owner':'Partner'}</strong></div>${primary?'<span class="primary-pill">Primary</span>':'<button type="button" class="owner-remove" data-remove-owner>Remove</button>'}</div>
      <div class="owner-grid">
        <label>Full name<input data-owner-field="name" value="${esc(owner.name)}" required></label>
        <label>Email<input data-owner-field="email" type="email" value="${esc(owner.email||'')}" ${primary?'readonly':''} placeholder="partner@agency.com"></label>
        <label>Role / title<input data-owner-field="title" value="${esc(owner.title||'')}" placeholder="Managing Partner"></label>
        <label>Ownership %<div class="percent-input"><input data-owner-field="ownershipPercent" type="number" min="0" max="100" step="0.01" value="${Number(owner.ownershipPercent||0)}"><span>%</span></div></label>
      </div>
      <div class="owner-card-foot"><span class="identity-status">${esc(statusCopy(owner.ownerIdentityStatus))}</span>${!primary&&!owner.memberId?'<label class="invite-check"><input data-owner-field="invite" type="checkbox" checked> Invite this partner to the same agency workspace</label>':''}</div>
    </article>`;
  }

  function history(){
    const rows=Array.isArray(model?.history)?model.history:[];
    if(!rows.length)return '<p class="history-empty">Ownership history begins after you confirm this structure.</p>';
    return rows.slice(0,8).map(item=>`<div class="history-row"><div><strong>${new Date(item.effective_at).toLocaleDateString()}</strong><span>${esc(item.reason==='ownership_update'?'Ownership updated':'Ownership confirmed')}</span></div><div>${(item.structure||[]).map(o=>`${esc(o.name)} ${Number(o.ownershipPercent||0)}%`).join(' · ')}</div></div>`).join('');
  }

  function render(){
    const owners=activeOwners();
    const sum=total();
    const valid=Math.abs(sum-100)<=0.01;
    root.innerHTML=`<section class="ownership-hero">
      <div><span class="eyebrow">AGENCY PROFILE</span><h1>Ownership & Partners</h1><p>Keep your current ownership structure accurate. Agency-level Strength and Performance stay shared, while Owner Identity and owner-dependency can be tracked by partner.</p></div>
      <div class="ownership-total ${valid?'valid':'invalid'}"><span>Total ownership</span><strong>${sum.toFixed(2).replace('.00','')}%</strong><small>${valid?'Ready to save':'Must equal 100%'}</small></div>
    </section>
    ${model.needsConfirmation?`<section class="ownership-notice"><strong>Confirm your ownership structure before relying on owner-dependency scoring.</strong><span>If this agency has multiple owners, add every active partner now. If you are the only owner, simply confirm the 100% structure below.</span></section>`:''}
    ${model.reassessment?.ownerIndependenceNeedsReview?`<section class="ownership-notice warning"><strong>Ownership changed — Owner Independence needs reassessment.</strong><span>Your historical Scorecard is preserved. Reassess Owner Independence so the next AOFI™ Scorecard reflects the current partner structure.</span><a href="/diagnostic/">Go to AOFI™ Diagnostic →</a></section>`:''}
    <section class="ownership-panel">
      <div class="ownership-panel-head"><div><h2>Current owners</h2><p>Add active owners and make sure percentages total 100%.</p></div><button type="button" class="cc-btn cc-btn-secondary" id="addPartner">＋ Add Partner</button></div>
      <div id="ownerRows">${owners.map(row).join('')}</div>
      <div class="ownership-actions"><div id="ownershipError" class="ownership-error"></div><button type="button" class="cc-btn cc-btn-primary" id="saveOwnership" ${valid?'':'disabled'}>Confirm Ownership Structure</button></div>
    </section>
    <section class="ownership-panel"><div class="ownership-panel-head"><div><h2>Ownership history</h2><p>Historical structures remain tied to the period in which each AOFI™ Scorecard was generated.</p></div></div><div class="history-list">${history()}</div></section>`;
    bind();
  }

  function readRows(){
    return [...root.querySelectorAll('[data-owner-index]')].map(card=>{
      const base=activeOwners()[Number(card.dataset.ownerIndex)]||{};
      const get=name=>card.querySelector(`[data-owner-field="${name}"]`);
      return {...base,
        name:get('name')?.value.trim()||'',email:get('email')?.value.trim()||'',title:get('title')?.value.trim()||'',
        ownershipPercent:Number(get('ownershipPercent')?.value||0),invite:get('invite')?.checked!==false
      };
    });
  }
  function syncFromInputs(){
    const rows=readRows();model.owners=rows;
    const sum=rows.reduce((s,o)=>s+Number(o.ownershipPercent||0),0);
    const totalNode=root.querySelector('.ownership-total');
    if(totalNode){totalNode.classList.toggle('valid',Math.abs(sum-100)<=.01);totalNode.classList.toggle('invalid',Math.abs(sum-100)>.01);totalNode.querySelector('strong').textContent=`${sum.toFixed(2).replace('.00','')}%`;totalNode.querySelector('small').textContent=Math.abs(sum-100)<=.01?'Ready to save':'Must equal 100%'}
    const save=root.querySelector('#saveOwnership');if(save)save.disabled=Math.abs(sum-100)>.01;
  }
  function bind(){
    root.querySelectorAll('[data-owner-field]').forEach(input=>input.addEventListener('input',syncFromInputs));
    root.querySelector('#addPartner')?.addEventListener('click',()=>{
      model.owners=readRows();
      model.owners.push({id:null,name:'',email:'',title:'Partner',ownershipPercent:0,isPrimary:false,status:'active',ownerIdentityStatus:'not_started',invite:true});
      render();
    });
    root.querySelectorAll('[data-remove-owner]').forEach(button=>button.addEventListener('click',()=>{
      const card=button.closest('[data-owner-index]');const index=Number(card.dataset.ownerIndex);
      model.owners=readRows().filter((_,i)=>i!==index);render();
    }));
    root.querySelector('#saveOwnership')?.addEventListener('click',async()=>{
      syncFromInputs();const owners=activeOwners();const button=root.querySelector('#saveOwnership');const error=root.querySelector('#ownershipError');
      error.textContent='';button.disabled=true;button.innerHTML='<span class="cc-inline-spinner"></span>Saving ownership…';
      try{
        const result=await request({method:'POST',body:JSON.stringify({action:'save_ownership',owners})});
        model={...model,...result,needsConfirmation:false,history:model.history||[],reassessment:result.reassessment||{}};
        const refreshed=await request();model=refreshed;render();
      }catch(err){error.textContent=err.message;button.disabled=false;button.textContent='Confirm Ownership Structure'}
    });
  }
  request().then(data=>{model=data;render()}).catch(error=>{root.innerHTML=`<section class="ownership-loading"><h1>Ownership & Partners</h1><p class="ownership-error">${esc(error.message)}</p></section>`});
})();