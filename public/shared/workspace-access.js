(function(){
  if(window.CCWorkspace)return;
  const api='/api/account-auth';let accessPromise=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function request(action,options={}){const r=await fetch(options.method==='POST'?api:`${api}?action=${encodeURIComponent(action)}`,options.method==='POST'?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...(options.body||{})})}:{credentials:'same-origin'});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.error||'Request failed.');return p}
  const getAccess=()=>accessPromise||(accessPromise=request('workspace_access').then(r=>r.access).catch(error=>{accessPromise=null;throw error}));
  function install(){if(document.querySelector('#ccWorkspaceStyle'))return;const s=document.createElement('style');s.id='ccWorkspaceStyle';s.textContent=`body.cc-modal-open{overflow:hidden}.cc-ai-backdrop{position:fixed;inset:0;background:#11182773;z-index:100000;display:flex;justify-content:flex-end}.cc-ai-panel{width:min(520px,100%);height:100%;background:#fff;display:flex;flex-direction:column;box-shadow:-16px 0 50px #11182726}.cc-ai-head{padding:20px 22px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}.cc-ai-head h2{margin:0;font:700 22px/1.2 Inter,Arial}.cc-ai-close{border:0;background:none;font-size:28px;cursor:pointer}.cc-ai-messages{padding:18px;overflow:auto;flex:1;background:#fafafa}.cc-ai-msg{max-width:88%;padding:12px 14px;border-radius:16px;margin:0 0 12px;white-space:pre-wrap;line-height:1.5}.cc-ai-msg.user{margin-left:auto;background:#302cff;color:#fff}.cc-ai-msg.assistant{background:#fff;border:1px solid #e5e7eb}.cc-ai-empty{color:#64748b;text-align:center;margin:50px 20px}.cc-ai-form{display:flex;gap:10px;padding:16px;border-top:1px solid #e5e7eb}.cc-ai-form textarea{flex:1;resize:none;min-height:48px;max-height:130px;border:1px solid #cbd5e1;border-radius:12px;padding:12px;font:inherit}.cc-ai-form button{border:0;border-radius:12px;background:#302cff;color:white;font-weight:700;padding:0 18px}.cc-ai-error{color:#b91c1c;padding:0 18px 12px}@media(max-width:600px){.cc-ai-panel{width:100%}.cc-ai-form{padding:10px}.cc-ai-head{padding:15px}}`;document.head.appendChild(s)}
  async function openAsk(){
    if(document.querySelector('.cc-ai-backdrop'))return;
    install();document.body.classList.add('cc-modal-open');
    const wrap=document.createElement('div');wrap.className='cc-ai-backdrop';
    wrap.innerHTML=`<section class="cc-ai-panel" role="dialog" aria-modal="true" aria-label="Ask Creature"><header class="cc-ai-head"><h2>Ask Creature</h2><button class="cc-ai-close" aria-label="Close">×</button></header><div class="cc-ai-messages" aria-live="polite"><div class="cc-ai-empty">Ask for a summary, next steps, or help interpreting your agency data.</div></div><div class="cc-ai-error" role="alert" hidden></div><form class="cc-ai-form"><textarea maxlength="4000" required placeholder="Ask about this page or your agency…"></textarea><button>Send</button></form></section>`;
    document.body.appendChild(wrap);
    const list=wrap.querySelector('.cc-ai-messages'),error=wrap.querySelector('.cc-ai-error'),form=wrap.querySelector('form'),input=wrap.querySelector('textarea'),button=form.querySelector('button');
    let sending=false,closed=false,historyLoaded=false;
    const close=()=>{closed=true;wrap.remove();document.body.classList.remove('cc-modal-open');document.removeEventListener('keydown',escape)};
    const escape=e=>{if(e.key==='Escape')close()};
    document.addEventListener('keydown',escape);
    wrap.querySelector('.cc-ai-close').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
    const render=messages=>{
      if(historyLoaded)return;
      historyLoaded=true;
      if(messages.length){
        list.innerHTML=messages.map(m=>`<div class="cc-ai-msg ${m.role==='user'?'user':'assistant'}">${esc(m.content)}</div>`).join('');
        list.scrollTop=list.scrollHeight;
      }
    };
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'&&!e.shiftKey){
        e.preventDefault();
        if(input.value.trim()){
          if(typeof form.requestSubmit==='function')form.requestSubmit();
          else form.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
        }
      }
    });
    // Install before the first await so Send can never navigate the page.
    form.onsubmit=async e=>{
      e.preventDefault();
      if(sending||closed)return;
      const message=input.value.trim();if(!message)return;
      sending=true;error.hidden=true;
      list.querySelector('.cc-ai-empty')?.remove();
      const bubble=document.createElement('div');bubble.className='cc-ai-msg user';bubble.textContent=message;list.appendChild(bubble);
      const pending=document.createElement('div');pending.className='cc-ai-msg assistant';pending.textContent='Thinking…';list.appendChild(pending);
      input.value='';list.scrollTop=list.scrollHeight;
      try{
        const result=await request('',{method:'POST',body:{action:'ask_creature',message,currentPath:location.pathname}});
        if(!closed)pending.textContent=result.answer;
      }catch(err){
        if(!closed){pending.remove();bubble.remove();if(!input.value)input.value=message;error.hidden=false;error.textContent=err.message}
      }finally{
        sending=false;
        if(!closed){list.scrollTop=list.scrollHeight;input.focus()}
      }
    };
    input.focus();
    request('ask_creature_history').then(h=>{if(!closed)render(h.messages||[])}).catch(e=>{if(!closed&&!historyLoaded)console.warn('History load error:',e.message)});
  }

  function routeFeature(path){if(path.startsWith('/accelerator'))return'accelerator';if(path.startsWith('/integrations'))return'integrations';if(path.startsWith('/agency-scorecard'))return'scorecard';if(path.startsWith('/agency-goals'))return'goals';if(path.startsWith('/diagnostic'))return'diagnostic';if(path.startsWith('/portal'))return'portal';if(path.startsWith('/users'))return'users';if(path.startsWith('/leadership'))return'leadership';if(['/platform','/marketing','/sales','/billing','/onboarding','/service-delivery','/client-success','/talent-acquisition','/finance','/communication','/systems','/sops'].some(p=>path.startsWith(p)))return'monitor';return''}
  async function guard(){try{const access=await getAccess(),feature=routeFeature(location.pathname),departments=['leadership','marketing','sales','billing','onboarding','service-delivery','client-success','talent-acquisition','finance','communication','systems','sops'];document.querySelectorAll('a[href]').forEach(link=>{try{const path=new URL(link.href,location.href).pathname,f=routeFeature(path),department=path.split('/').filter(Boolean)[0];if((f&&!access.features.includes(f))||(access.actor.role==='member'&&departments.includes(department)&&!access.actor.departments.includes(department)))link.hidden=true}catch{}});if(feature&&!access.features.includes(feature)){location.replace(access.features.includes('accelerator')?'/accelerator/':access.features.includes('monitor')?'/platform/':'/diagnostic/');return}if(access.actor.role==='member'){const department=location.pathname.split('/').filter(Boolean)[0],first=access.actor.departments[0];if(location.pathname.startsWith('/platform')&&first){location.replace(`/${first}/`);return}if((departments.includes(department)&&!access.actor.departments.includes(department))||location.pathname.startsWith('/users'))location.replace(first?`/${first}/`:'/login/')}}catch{}}
  window.CCWorkspace={request,getAccess,openAsk,guard};guard();
})();
