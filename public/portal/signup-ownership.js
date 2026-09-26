(()=>{
  const params=new URLSearchParams(location.search);
  const plan=(params.get('plan')||localStorage.getItem('ccProgramPath')||'diagnostic').replace(/-/g,'_');
  localStorage.setItem('ccProgramPath',plan);
  const list=document.getElementById('signupOwnerList');
  const error=document.getElementById('signupOwnershipError');
  const totalNode=document.getElementById('signupOwnershipTotal');
  const continueBtn=document.getElementById('continueToPayment');
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const validEmail=v=>/^\S+@\S+\.\S+$/.test(String(v||'').trim());
  const readJson=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch{return fallback}};
  const selectedLead=readJson('ccSignupPrimaryOwner',null);
  const report=readJson('ownerArchetypeReportData',null);
  const account=window.CCAccount?.getAccount?.()||readJson('ccUserAccount',null)||{};
  const primary={
    name:String(selectedLead?.name||[report?.firstName||localStorage.getItem('ccOwnerFirstName'),report?.lastName||localStorage.getItem('ccOwnerLastName')].filter(Boolean).join(' ')||account?.name||account?.displayName||'Agency Owner').trim(),
    email:String(selectedLead?.email||report?.email||localStorage.getItem('ccOwnerEmail')||account?.email||'').trim().toLowerCase(),
    title:'Owner',ownershipPercent:100,isPrimary:true
  };
  let mode='single';
  let owners=[primary];

  const saved=readJson('ccSignupOwnership',null);
  if(Array.isArray(saved?.owners)&&saved.owners.length&&saved.primaryEmail===primary.email){
    owners=saved.owners.map((o,i)=>({...o,isPrimary:i===0}));
    mode=owners.length>1?'multiple':'single';
  }

  function ownerCard(owner,index){
    const primaryOwner=index===0;
    return `<article class="signup-owner-card" data-owner-index="${index}">
      <div class="signup-owner-card-head"><div><span>${primaryOwner?'PRIMARY OWNER':`PARTNER ${index}`}</span><strong>${primaryOwner?'Assessment owner':'Agency partner'}</strong></div>${primaryOwner?'':'<button type="button" data-remove-partner>Remove</button>'}</div>
      <div class="signup-owner-grid">
        <label>Full name<input data-field="name" value="${esc(owner.name||'')}" ${primaryOwner?'readonly':''} placeholder="Full name"></label>
        <label>Email<input data-field="email" type="email" value="${esc(owner.email||'')}" ${primaryOwner?'readonly':''} placeholder="partner@agency.com"></label>
        <label>Role / title<input data-field="title" value="${esc(owner.title||'')}" placeholder="${primaryOwner?'Owner':'Managing Partner'}"></label>
        <label>Ownership %<div class="signup-percent"><input data-field="ownershipPercent" type="number" min="0" max="100" step="0.01" value="${Number(owner.ownershipPercent||0)}"><span>%</span></div></label>
      </div>
    </article>`;
  }

  function readRows(){
    return [...list.querySelectorAll('[data-owner-index]')].map((card,index)=>{
      const field=name=>card.querySelector(`[data-field="${name}"]`);
      return {
        name:field('name')?.value.trim()||'',
        email:field('email')?.value.trim().toLowerCase()||'',
        title:field('title')?.value.trim()||(index===0?'Owner':'Partner'),
        ownershipPercent:Number(field('ownershipPercent')?.value||0),
        isPrimary:index===0
      };
    });
  }

  function validate(rows){
    if(!primary.email||!validEmail(primary.email))return 'Complete the Owner Identity step first so we have the primary owner email.';
    if(!rows.length)return 'Add at least one owner.';
    if(rows.some(o=>!o.name))return 'Every owner needs a full name.';
    if(rows.some(o=>!validEmail(o.email)))return 'Every owner needs a valid email address.';
    if(new Set(rows.map(o=>o.email)).size!==rows.length)return 'Each owner must use a different email address.';
    if(rows.some(o=>!Number.isFinite(o.ownershipPercent)||o.ownershipPercent<0||o.ownershipPercent>100))return 'Ownership percentages must be between 0 and 100.';
    const total=rows.reduce((sum,o)=>sum+o.ownershipPercent,0);
    if(Math.abs(total-100)>0.01)return `Ownership must total 100%. Current total is ${total.toFixed(2)}%.`;
    if(mode==='single'&&rows.length!==1)return 'Single-owner mode must contain one owner.';
    if(mode==='multiple'&&rows.length<2)return 'Add at least one partner for a multi-owner agency.';
    return '';
  }

  function updateTotal(){
    const rows=readRows();
    const total=rows.reduce((sum,o)=>sum+Number(o.ownershipPercent||0),0);
    const valid=Math.abs(total-100)<=.01;
    totalNode.classList.toggle('valid',valid);totalNode.classList.toggle('invalid',!valid);
    totalNode.querySelector('strong').textContent=`${total.toFixed(2).replace('.00','')}%`;
    totalNode.querySelector('small').textContent=valid?'Ready to continue':'Must equal 100%';
  }

  function bind(){
    list.querySelectorAll('input').forEach(input=>input.addEventListener('input',updateTotal));
    list.querySelectorAll('[data-remove-partner]').forEach(button=>button.addEventListener('click',()=>{
      owners=readRows();const card=button.closest('[data-owner-index]');owners.splice(Number(card.dataset.ownerIndex),1);render();
    }));
  }

  function render(){
    document.querySelectorAll('[data-owner-mode]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.ownerMode===mode));
    list.innerHTML=owners.map(ownerCard).join('')+(mode==='multiple'?'<button type="button" class="add-signup-partner" id="addSignupPartner">＋ Add another partner</button>':'');
    document.getElementById('addSignupPartner')?.addEventListener('click',()=>{
      owners=readRows();
      owners.push({name:'',email:'',title:'Partner',ownershipPercent:0,isPrimary:false});
      render();
    });
    bind();updateTotal();
  }

  document.querySelectorAll('[data-owner-mode]').forEach(button=>button.addEventListener('click',()=>{
    owners=readRows();
    mode=button.dataset.ownerMode;
    if(mode==='single'){
      owners=[{...owners[0],name:primary.name,email:primary.email,title:owners[0]?.title||'Owner',ownershipPercent:100,isPrimary:true}];
    }else if(owners.length===1){
      owners=[{...owners[0],name:primary.name,email:primary.email,ownershipPercent:50,isPrimary:true},{name:'',email:'',title:'Partner',ownershipPercent:50,isPrimary:false}];
    }
    render();
  }));

  continueBtn.addEventListener('click',()=>{
    owners=readRows();
    const message=validate(owners);
    error.textContent=message;
    if(message)return;
    localStorage.setItem('ccSignupOwnership',JSON.stringify({version:1,plan,primaryEmail:primary.email,confirmedAt:new Date().toISOString(),owners}));
    location.href='/payment/?plan='+encodeURIComponent(plan);
  });

  render();
})();