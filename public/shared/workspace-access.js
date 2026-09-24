(function(){
  if(window.CCWorkspace)return;
  if(!document.querySelector('link[href="/shared/responsive.css"]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/shared/responsive.css';document.head.appendChild(css);}
  function mountChrome(access){const mount=()=>window.CCWorkspaceChrome?.mount(access);if(window.CCWorkspaceChrome)return mount();const script=document.createElement('script');script.src='/shared/workspace-chrome.js';script.onload=mount;document.head.appendChild(script);}
  const api='/api/account-auth';let accessPromise=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const urlParams = new URLSearchParams(location.search);
  let adminParam = urlParams.get('admin');
  let tenantParam = urlParams.get('tenant') || urlParams.get('accountId');

  if (adminParam === '1' && tenantParam) {
    sessionStorage.setItem('cc_admin_mode', '1');
    sessionStorage.setItem('cc_admin_tenant', tenantParam);
  } else if (sessionStorage.getItem('cc_admin_mode') === '1' && sessionStorage.getItem('cc_admin_tenant')) {
    adminParam = '1';
    tenantParam = sessionStorage.getItem('cc_admin_tenant');
    if (!urlParams.has('admin') || !urlParams.has('tenant')) {
      urlParams.set('admin', '1');
      urlParams.set('tenant', tenantParam);
      try {
        window.history.replaceState(null, '', `${location.pathname}?${urlParams.toString()}${location.hash}`);
      } catch {}
    }
  }

  function preserveLink(link) {
    if (adminParam !== '1' || !tenantParam || !link || !link.href) return;
    try {
      const url = new URL(link.href, location.href);
      if (url.origin === location.origin && !url.pathname.startsWith('/admin') && !url.pathname.startsWith('/login')) {
        url.searchParams.set('admin', '1');
        url.searchParams.set('tenant', tenantParam);
        link.href = url.pathname + url.search + url.hash;
      }
    } catch {}
  }

  function preserveAllLinks() {
    if (adminParam !== '1' || !tenantParam) return;
    document.querySelectorAll('a[href]').forEach(preserveLink);
  }

  document.addEventListener('click', event => {
    if (adminParam !== '1' || !tenantParam) return;
    const anchor = event.target?.closest?.('a[href]');
    if (anchor) preserveLink(anchor);
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preserveAllLinks);
  } else {
    preserveAllLinks();
  }

  async function request(action,options={}){
    const isPost = options.method === 'POST';
    let url = isPost ? api : `${api}?action=${encodeURIComponent(action)}`;
    let body = options.body || {};

    if (adminParam === '1' && tenantParam) {
      if (isPost) {
        body = { admin: '1', tenant: tenantParam, accountId: tenantParam, ...body };
      } else {
        url += `&admin=1&tenant=${encodeURIComponent(tenantParam)}&accountId=${encodeURIComponent(tenantParam)}`;
      }
    }

    const fetchOpts = isPost
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) }
      : { credentials: 'same-origin' };

    const r = await fetch(url, fetchOpts);
    const p = await r.json().catch(() => ({}));
    if(!r.ok)throw new Error(p.error||'Request failed.');
    return p;
  }

  const getAccess=()=>accessPromise||(accessPromise=request('workspace_access').then(r=>r.access).catch(error=>{accessPromise=null;throw error}));
  function applyAdminReadOnly(access){
    if(!access?.readOnly||document.querySelector('[data-admin-readonly-banner]'))return;
    const banner=document.createElement('div');
    banner.dataset.adminReadonlyBanner='1';
    banner.textContent='Admin view — read only. Account data cannot be changed from this session.';
    banner.style.cssText='position:sticky;top:0;z-index:9999;background:#fff7d6;border-bottom:1px solid #ead58a;color:#5b4a00;padding:9px 16px;text-align:center;font:700 12px/1.4 Inter,Arial,sans-serif';
    document.body.prepend(banner);
    const mutating=/\b(save|create|new|add|edit|delete|remove|archive|disconnect|connect|sync|send|invite|update|change|set|submit|recalculate|regenerate|define|activate)\b/i;
    document.addEventListener('click',event=>{
      const button=event.target?.closest?.('button,[role="button"]');
      if(button&&mutating.test(button.textContent||'')&&!/download|view|open|refresh/i.test(button.textContent||'')){
        event.preventDefault();event.stopImmediatePropagation();window.alert('Admin account view is read-only.');
      }
    },true);
    document.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();window.alert('Admin account view is read-only.');},true);
  }
  let chatModule;
  async function openAsk(){
    if(!chatModule)chatModule=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='/shared/ask-creature-ui.js';
      script.onload=resolve;script.onerror=()=>{chatModule=null;script.remove();reject(new Error('Chat could not load. Please refresh and try again.'));};
      document.head.appendChild(script);
    });
    try{await chatModule;await window.CCAskCreature.open();}catch(error){window.alert(error.message);}
  }

  function routeFeature(path){if(path.startsWith('/accelerator'))return'accelerator';if(path.startsWith('/integrations'))return'integrations';if(path.startsWith('/agency-scorecard'))return'scorecard';if(path.startsWith('/agency-goals'))return'goals';if(path.startsWith('/diagnostic'))return'diagnostic';if(path.startsWith('/portal'))return'portal';if(path.startsWith('/users'))return'users';if(path.startsWith('/leadership'))return'leadership';if(['/platform','/marketing','/sales','/billing','/onboarding','/service-delivery','/client-success','/talent-acquisition','/finance','/communication','/systems','/sops'].some(p=>path.startsWith(p)))return'monitor';return''}
  function gateCopy(feature,access){
    const workflow=access?.workflow||{},reportReady=workflow.reportReady===true,goalsComplete=workflow.goalsComplete===true;
    const labels={scorecard:'Agency Scorecard',goals:'Agency Goals',monitor:'Monitor',integrations:'Integrations'};
    const preview=Array.isArray(access?.previewFeatures)&&access.previewFeatures.includes(feature)&&!access.features.includes(feature);

    // Plan restrictions take priority over workflow restrictions. This keeps
    // Free AOFI and Diagnostic preview pages focused on the required upgrade.
    if(preview)return{
      kind:'upgrade',
      title:`Upgrade your account to access ${labels[feature]||'this feature'}`,
      message:`${labels[feature]||'This feature'} is visible in your workspace, but it is not included in your current account type.`,
      cta:'/account/upgrade/',
      ctaLabel:'View Upgrade Options'
    };

    if(feature==='scorecard'&&!reportReady)return{
      kind:'flow',
      title:'Complete your Diagnostic to view your Agency Scorecard',
      message:'Your Agency Scorecard becomes available after the Diagnostic is completed and the scorecard has been generated.',
      cta:'/diagnostic/',
      ctaLabel:'Complete Diagnostic'
    };
    if(feature==='goals'&&!reportReady)return{
      kind:'flow',
      title:'Complete your Agency Scorecard to view Agency Goals',
      message:'Agency Goals unlocks after your Diagnostic is complete and your Agency Scorecard has been generated.',
      cta:'/agency-scorecard/',
      ctaLabel:'View Agency Scorecard'
    };
    if(feature==='monitor'&&!reportReady)return{
      kind:'flow',
      title:'Complete your Agency Scorecard to view Monitor',
      message:'Monitor unlocks after your Diagnostic is complete and your Agency Scorecard has been generated.',
      cta:'/agency-scorecard/',
      ctaLabel:'View Agency Scorecard'
    };
    if(feature==='monitor'&&!goalsComplete)return{
      kind:'flow',
      title:'Complete Agency Goals to view Monitor',
      message:'Finish your Agency Goals and 90 Day Priorities before Monitor becomes available.',
      cta:'/agency-goals/',
      ctaLabel:'Complete Agency Goals'
    };
    return null;
  }
  function showGateNotice(copy){
    if(!copy||document.querySelector('[data-cc-access-gate]'))return;
    if(!document.querySelector('#cc-access-gate-style')){
      const style=document.createElement('style');style.id='cc-access-gate-style';style.textContent=`
        .cc-access-gate{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:28px;background:rgba(15,23,42,.46);backdrop-filter:blur(5px)}
        .cc-access-gate-card{width:min(620px,100%);background:#fff;border:1px solid #e4e4df;border-radius:20px;padding:34px;box-shadow:0 24px 70px rgba(15,23,42,.2);font-family:Inter,Arial,sans-serif;color:#111318}
        .cc-access-gate-icon{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;background:#eef0ff;color:#272cf3;font-size:22px;font-weight:800;margin-bottom:18px}
        .cc-access-gate-kicker{display:block;font-size:11px;font-weight:800;letter-spacing:.08em;color:#6b7280;margin-bottom:9px}
        .cc-access-gate-card h1{font-size:28px;line-height:1.15;letter-spacing:-.035em;margin:0 0 11px}
        .cc-access-gate-card p{font-size:14px;line-height:1.6;color:#667085;margin:0}
        .cc-access-gate-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}
        .cc-access-gate-actions a{min-height:43px;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;padding:0 17px;text-decoration:none;font-size:13px;font-weight:750}
        .cc-access-gate-primary{background:#272cf3;color:#fff}
        .cc-access-gate-secondary{border:1px solid #e4e4df;background:#fff;color:#4b5563}
        @media(max-width:640px){.cc-access-gate{padding:16px}.cc-access-gate-card{padding:25px 20px}.cc-access-gate-card h1{font-size:23px}.cc-access-gate-actions{display:grid}.cc-access-gate-actions a{width:100%}}
      `;document.head.appendChild(style);
    }
    const wrap=document.createElement('div');wrap.dataset.ccAccessGate='1';wrap.className='cc-access-gate';
    wrap.innerHTML=`<section class="cc-access-gate-card" role="dialog" aria-modal="true" aria-label="${esc(copy.title)}"><span class="cc-access-gate-icon">${copy.kind==='upgrade'?'↑':'✓'}</span><span class="cc-access-gate-kicker">${copy.kind==='upgrade'?'ACCOUNT UPGRADE':'NEXT STEP'}</span><h1>${esc(copy.title)}</h1><p>${esc(copy.message)}</p><div class="cc-access-gate-actions"><a class="cc-access-gate-primary" href="${copy.cta}">${esc(copy.ctaLabel)}</a><a class="cc-access-gate-secondary" href="/diagnostic/">Back to Diagnostic</a></div></section>`;
    document.body.appendChild(wrap);
  }
  async function guard(){try{
    const access=await getAccess();preserveAllLinks();
    if(access?.isAdmin||access?.actor?.role==='admin'||location.search.includes('admin=1')||sessionStorage.getItem('cc_admin_mode')==='1')return;
    const feature=routeFeature(location.pathname),previews=Array.isArray(access.previewFeatures)?access.previewFeatures:[],departments=['leadership','marketing','sales','billing','onboarding','service-delivery','client-success','talent-acquisition','finance','communication','systems','sops'];
    document.querySelectorAll('a[href]').forEach(link=>{try{
      const path=new URL(link.href,location.href).pathname,f=link.dataset.workspaceFeature||link.dataset.ccFeature||routeFeature(path),department=path.split('/').filter(Boolean)[0];
      const visible=!f||access.features.includes(f)||previews.includes(f);
      if(!visible||(access.actor.role==='member'&&departments.includes(department)&&!access.actor.departments.includes(department))){link.hidden=true;link.style.display='none'}
    }catch{}});
    const copy=feature?gateCopy(feature,access):null;
    if(copy){showGateNotice(copy);return}
    if(feature&&!access.features.includes(feature)){location.replace(access.features.includes('accelerator')?'/accelerator/':access.features.includes('monitor')?'/platform/':'/diagnostic/');return}
    if(access.actor.role==='member'){const department=location.pathname.split('/').filter(Boolean)[0],first=access.actor.departments[0];if(location.pathname.startsWith('/platform')&&first){location.replace(`/${first}/`);return}if((departments.includes(department)&&!access.actor.departments.includes(department))||location.pathname.startsWith('/users'))location.replace(first?`/${first}/`:'/login/')}
  }catch{}}
  window.CCWorkspace={request,getAccess,openAsk,guard,showGateNotice,gateCopy};guard();getAccess().then(access=>{applyAdminReadOnly(access);mountChrome(access)}).catch(()=>{});
})();

