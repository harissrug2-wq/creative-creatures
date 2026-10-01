(()=> {
  const root=document.querySelector('#partnerPortal');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api=async(action,body)=>{
    const response=await fetch('/api/account-auth'+(body?'':`?action=${encodeURIComponent(action)}`),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body})}:{credentials:'same-origin'});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||'Partner Portal request failed.');
    return payload;
  };
  const initials=name=>String(name||'CC').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
  let apps=[],query='',category='All';
  const categories=['All','Valuation','Operations','Talent','Growth','Sales'];

  async function start(app,button){
    if(!app)return;
    button.disabled=true;
    const old=button.textContent;
    button.textContent='Connecting…';
    try{
      await api('partner_referral',{partnerAppId:app.id,intent:'information'});
      app.requested=true;
      render();
    }catch(error){
      button.disabled=false;
      button.textContent=old;
      window.alert(error.message);
    }
  }

  const categoryIcon=name=>({
    All:'▦',Valuation:'▣',Operations:'⌘',Talent:'♙',Growth:'↗',Sales:'⚑'
  }[name]||'•');

  function partnerRow(app){
    return `<div class="pp-row">
      <div class="pp-row-name"><span class="pp-avatar">${esc(initials(app.name))}</span><div><strong>${esc(app.name)}</strong><small>${esc(app.category||app.placement||'Partner')}</small></div></div>
      <button data-start="${esc(app.id)}">${app.requested?'Requested':'Start Connecting'}</button>
    </div>`;
  }

  function render(){
    const filtered=apps.filter(app=>{
      const text=`${app.name} ${app.category} ${app.placement} ${app.summary||''}`.toLowerCase();
      const categoryMatch=category==='All'||String(app.category||'').toLowerCase()===category.toLowerCase();
      return categoryMatch&&text.includes(query.toLowerCase());
    });
    const featured=filtered.slice(0,4);
    const first=featured[0],second=featured[1],third=featured[2],fourth=featured[3];

    root.innerHTML=`
      <section class="pp-hero">
        <div>
          <h1>Connect More. <span>Unlock More Intelligence.</span></h1>
          <p>Connect trusted partner systems to extend your capabilities and get more from your intelligence ecosystem.</p>
          <button class="pp-primary" id="explorePartners">Explore Partners <span>→</span></button>
        </div>
        <div class="pp-float-icons" aria-hidden="true"><i>▦</i><i>⌘</i><i>▥</i><i>◫</i><i>✣</i></div>
      </section>

      <section class="pp-controls">
        <label class="pp-search"><span>⌕</span><input id="partnerSearch" type="search" placeholder="Search partners or capabilities" value="${esc(query)}"></label>
        <div class="pp-filters">${categories.map(name=>`<button data-category="${name}" class="${name===category?'active':''}"><span>${categoryIcon(name)}</span>${name}</button>`).join('')}</div>
      </section>

      ${featured.length?`<section class="pp-feature-grid">
        ${first?`<article class="pp-feature-main"><div class="pp-feature-copy"><span class="pp-feature-symbol">✣</span><h2>${esc(first.name)}</h2><p>${esc(first.summary||first.placement||'Strategic partner capability')}</p><button data-start="${esc(first.id)}">${first.requested?'Requested':'Start Connecting'} <span>→</span></button></div><div class="pp-bubbles"><b>${esc(initials(first.name))}</b><i>${esc(initials(first.category||'VA'))}</i></div><div class="pp-dots">● ● ●</div></article>`:''}
        <div class="pp-feature-side">
          ${second?`<article class="pp-feature-secondary"><h3>${esc(second.name)}</h3><button data-start="${esc(second.id)}">${second.requested?'Requested':'Start Connecting'}</button><span class="pp-watermark">${esc(initials(second.name).slice(0,1))}</span></article>`:''}
          <div class="pp-mini-grid">
            ${third?`<article class="pp-mini orange"><span>${esc(third.name)}</span><b>↗</b></article>`:''}
            ${fourth?`<article class="pp-mini amber"><span>${esc(fourth.name)}</span><b>⌘</b></article>`:''}
          </div>
        </div>
      </section>`:''}

      <section class="pp-list-card">
        <header><h2>Featured partners <span>›</span></h2><small>${Math.min(2,filtered.length)} partners</small></header>
        <div class="pp-two-col">${filtered.slice(0,2).map(partnerRow).join('')||'<p class="pp-empty">No featured partners match this filter.</p>'}</div>
      </section>

      <section class="pp-list-card">
        <header><h2>All partners <span>›</span></h2><small>${filtered.length} partners</small></header>
        <div class="pp-two-col">${filtered.map(partnerRow).join('')||'<p class="pp-empty">No partners match this filter.</p>'}</div>
      </section>

      <section class="pp-bottom-banner">
        <div><h2>Built something agencies should <span>know about?</span></h2><p>List your application in our partner marketplace and connect with agencies looking for smarter tools.</p></div>
        <a href="mailto:partners@creativecreatures.org">Get Listed <span>→</span></a>
      </section>`;

    root.querySelector('#partnerSearch').addEventListener('input',e=>{query=e.target.value;render()});
    root.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.category;render()}));
    root.querySelectorAll('[data-start]').forEach(button=>button.addEventListener('click',()=>start(apps.find(app=>String(app.id)===button.dataset.start),button)));
    root.querySelector('#explorePartners')?.addEventListener('click',()=>root.querySelector('.pp-list-card')?.scrollIntoView({behavior:'smooth'}));
  }

  api('partner_portal').then(data=>{apps=Array.isArray(data.apps)?data.apps:[];render()}).catch(error=>{
    root.innerHTML=`<div class="partner-error"><strong>${esc(error.message)}</strong><p>Sign in again or retry after the Partner Portal migration is installed.</p><button onclick="location.reload()">Retry</button></div>`;
  });
})();