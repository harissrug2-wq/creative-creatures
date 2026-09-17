(function(){
  if(window.CCWorkspace)return;
  const api='/api/account-auth';let accessPromise=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function request(action,options={}){const r=await fetch(options.method==='POST'?api:`${api}?action=${encodeURIComponent(action)}`,options.method==='POST'?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...(options.body||{})})}:{credentials:'same-origin'});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.error||'Request failed.');return p}
  const getAccess=()=>accessPromise||(accessPromise=request('workspace_access').then(r=>r.access).catch(error=>{accessPromise=null;throw error}));
  let chatModule;
  async function openAsk(){
    if(!chatModule)chatModule=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='/shared/ask-creature-ui.js';
      script.onload=resolve;script.onerror=()=>{chatModule=null;script.remove();reject(new Error('Chat could not load. Please refresh and try again.'));};
      document.head.appendChild(script);
    });
    try{await chatModule;window.CCAskCreature.open();}catch(error){window.alert(error.message);}
  }

  function routeFeature(path){if(path.startsWith('/accelerator'))return'accelerator';if(path.startsWith('/integrations'))return'integrations';if(path.startsWith('/agency-scorecard'))return'scorecard';if(path.startsWith('/agency-goals'))return'goals';if(path.startsWith('/diagnostic'))return'diagnostic';if(path.startsWith('/portal'))return'portal';if(path.startsWith('/users'))return'users';if(path.startsWith('/leadership'))return'leadership';if(['/platform','/marketing','/sales','/billing','/onboarding','/service-delivery','/client-success','/talent-acquisition','/finance','/communication','/systems','/sops'].some(p=>path.startsWith(p)))return'monitor';return''}
  async function guard(){try{const access=await getAccess(),feature=routeFeature(location.pathname),departments=['leadership','marketing','sales','billing','onboarding','service-delivery','client-success','talent-acquisition','finance','communication','systems','sops'];document.querySelectorAll('a[href]').forEach(link=>{try{const path=new URL(link.href,location.href).pathname,f=link.dataset.workspaceFeature||link.dataset.ccFeature||routeFeature(path),department=path.split('/').filter(Boolean)[0];if((f&&!access.features.includes(f))||(access.actor.role==='member'&&departments.includes(department)&&!access.actor.departments.includes(department))){link.hidden=true;link.style.display='none'}}catch{}});if(feature&&!access.features.includes(feature)){location.replace(access.features.includes('accelerator')?'/accelerator/':access.features.includes('monitor')?'/platform/':'/diagnostic/');return}if(access.actor.role==='member'){const department=location.pathname.split('/').filter(Boolean)[0],first=access.actor.departments[0];if(location.pathname.startsWith('/platform')&&first){location.replace(`/${first}/`);return}if((departments.includes(department)&&!access.actor.departments.includes(department))||location.pathname.startsWith('/users'))location.replace(first?`/${first}/`:'/login/')}}catch{}}
  window.CCWorkspace={request,getAccess,openAsk,guard};guard();
})();
