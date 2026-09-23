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
  async function guard(){try{const access=await getAccess();preserveAllLinks();if(access?.isAdmin||access?.actor?.role==='admin'||location.search.includes('admin=1')||sessionStorage.getItem('cc_admin_mode')==='1')return;const feature=routeFeature(location.pathname),departments=['leadership','marketing','sales','billing','onboarding','service-delivery','client-success','talent-acquisition','finance','communication','systems','sops'];document.querySelectorAll('a[href]').forEach(link=>{try{const path=new URL(link.href,location.href).pathname,f=link.dataset.workspaceFeature||link.dataset.ccFeature||routeFeature(path),department=path.split('/').filter(Boolean)[0];if((f&&!access.features.includes(f))||(access.actor.role==='member'&&departments.includes(department)&&!access.actor.departments.includes(department))){link.hidden=true;link.style.display='none'}}catch{}});if(feature&&!access.features.includes(feature)){location.replace(access.features.includes('accelerator')?'/accelerator/':access.features.includes('monitor')?'/platform/':'/diagnostic/');return}if(access.actor.role==='member'){const department=location.pathname.split('/').filter(Boolean)[0],first=access.actor.departments[0];if(location.pathname.startsWith('/platform')&&first){location.replace(`/${first}/`);return}if((departments.includes(department)&&!access.actor.departments.includes(department))||location.pathname.startsWith('/users'))location.replace(first?`/${first}/`:'/login/')}}catch{}}
  window.CCWorkspace={request,getAccess,openAsk,guard};guard();getAccess().then(access=>{applyAdminReadOnly(access);mountChrome(access)}).catch(()=>{});
})();

