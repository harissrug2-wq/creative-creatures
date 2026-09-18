(function(){
 'use strict';
 if(window.CCAskCreature)return;
 let current=null;
 const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
 async function api(action,data){
  const url='/api/account-auth';
  const response=await fetch(data?.method==='POST'?url:`${url}?${new URLSearchParams({action,...(data||{})})}`,data?.method==='POST'?{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...data.body})}:{credentials:'same-origin'});
  const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Chat could not load. Please try again.');return result;
 }
 function open(){
  if(current){current.fresh();return;}
  if(!document.getElementById('ccAskStyle')){const css=el('link');css.id='ccAskStyle';css.rel='stylesheet';css.href='/shared/ask-creature.css';document.head.appendChild(css);}
  const previousFocus=document.activeElement,hadModal=document.body.classList.contains('cc-modal-open');
  const wrap=el('div','cc-chat-overlay');
  wrap.innerHTML=`<section class="cc-chat-panel" role="dialog" aria-modal="true" aria-labelledby="ccChatTitle">
   <header class="cc-chat-header">
     <div class="cc-chat-brand" aria-hidden="true"><img src="/portal/creative-creatures-logo.png" alt="Creative Creatures" class="cc-chat-brand-logo"></div>
     <div class="cc-chat-heading">
       <h2 id="ccChatTitle">Ask Creature</h2>
       <p class="cc-chat-page-badge" id="ccChatBadge">Agency Scorecard context · A</p>
     </div>
     <button type="button" class="cc-chat-icon cc-chat-close" aria-label="Close chat">×</button>
   </header>
   <nav class="cc-chat-toolbar" aria-label="Chat controls"><button type="button" class="cc-chat-new">＋ New chat</button><button type="button" class="cc-chat-history" aria-pressed="false">◷ History</button><span class="cc-chat-page"></span></nav>
   <div class="cc-chat-content"></div><p class="cc-chat-error" role="alert" hidden></p>
   <form class="cc-chat-form" data-no-loader="true">
     <label class="cc-chat-sr" for="ccChatInput">Your question</label>
     <div class="cc-chat-compose">
       <textarea id="ccChatInput" rows="1" maxlength="4000" placeholder="Ask about Agency Scorecard…" required></textarea>
       <button type="submit" aria-label="Send message">↑</button>
     </div>
     <p class="cc-chat-footer-note" id="ccChatFooterNote">Mock responses · scoped to agency scorecard</p>
   </form>
  </section>`;
  document.body.appendChild(wrap);
  document.body.classList.add('cc-ask-creature-open');
  const panel = wrap.querySelector('.cc-chat-panel');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      panel.classList.add('is-open');
    });
  });
  const content=wrap.querySelector('.cc-chat-content'),form=wrap.querySelector('form'),input=wrap.querySelector('textarea'),send=form.querySelector('button'),error=wrap.querySelector('.cc-chat-error'),historyButton=wrap.querySelector('.cc-chat-history'),newButton=wrap.querySelector('.cc-chat-new'),badgeNode=wrap.querySelector('#ccChatBadge'),footerNoteNode=wrap.querySelector('#ccChatFooterNote');
  let conversationId,messageCount=0,messages=[],sending=false,closed=false,view='chat',epoch=0,faq=null,historyOffset=0,olderOffset=0,hasOlder=false,retry=null,loading=false;
  const showError=e=>{error.hidden=false;error.textContent=e.message||String(e);};
  const clearError=()=>{error.hidden=true;error.textContent='';};
  function busy(){send.disabled=sending||loading||view!=='chat';input.disabled=loading||view!=='chat';newButton.disabled=sending;historyButton.disabled=sending;}
  function close(){
    if (closed) return;
    closed=true;
    epoch++;
    panel.classList.remove('is-open');
    document.body.classList.remove('cc-ask-creature-open');
    setTimeout(() => { wrap.remove(); }, 260);
    document.removeEventListener('keydown',onKey);
    current=null;
    previousFocus?.focus();
  }
  function onKey(e){if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const items=[...wrap.querySelectorAll('button:not(:disabled),textarea:not(:disabled),a[href]')].filter(n=>n.getClientRects().length);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}
  document.addEventListener('keydown',onKey);wrap.querySelector('.cc-chat-close').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close();};
  function bubble(m){
    const row=el('div',`cc-chat-message ${m.role==='user'?'is-user':'is-creature'}`);
    const speaker = el('span','cc-chat-speaker');
    if (m.role === 'user') {
      speaker.textContent = 'You';
    } else {
      speaker.innerHTML = '<img src="/portal/creative-creatures-logo.png" class="cc-speaker-logo" alt=""> Ask Creature';
    }
    row.append(speaker, el('div','cc-chat-text',m.content));
    return row;
  }
  function welcome(){
   content.replaceChildren();
   const topicName = faq?.topic || 'Agency Scorecard';
   const card = el('section','cc-chat-welcome-card');
   card.append(
     el('h3','',`How can I help with ${topicName}?`),
     el('p','',`I can summarize what's on screen, surface what needs attention, or draft a quick update based on this tab's data.`)
   );

   const suggestionsWrap = el('div','cc-chat-suggestions-wrap');
   suggestionsWrap.append(el('div','cc-chat-suggestions-title','Suggestions'));
   const choices = el('div','cc-chat-suggestions');
   const defaultQuestions = [
     'Summarize this tab',
     'What needs my attention?',
     'Draft a quick update'
   ];
   const questionsList = (faq && faq.questions && faq.questions.length) ? faq.questions : defaultQuestions;
   for(const question of questionsList){
     const b = el('button','cc-chat-suggestion-btn');
     b.type = 'button';
     b.append(el('span','',question), el('span','cc-chat-btn-arrow','→'));
     b.onclick = () => { input.value = question; form.requestSubmit(); };
     choices.append(b);
   }
   suggestionsWrap.append(choices);
   content.append(card, suggestionsWrap);
  }
  function render(){content.replaceChildren();if(hasOlder){const b=el('button','cc-chat-more','Load older messages');b.type='button';b.onclick=()=>loadOlder(b);content.append(b);}messages.forEach(m=>content.append(bubble(m)));content.scrollTop=content.scrollHeight;}
  function fresh(){if(sending)return;epoch++;conversationId=crypto.randomUUID();messageCount=0;messages=[];olderOffset=0;hasOlder=false;retry=null;view='chat';loading=false;input.value='';form.hidden=false;historyButton.setAttribute('aria-pressed','false');clearError();welcome();busy();input.focus();}
  async function history(append=false){
   const ticket=++epoch;view='history';loading=true;form.hidden=true;clearError();historyButton.setAttribute('aria-pressed','true');busy();
   if(!append){historyOffset=0;content.replaceChildren(el('h3','cc-chat-section-title','Your conversations'),el('p','cc-chat-muted','Loading chat history…'));}
   try{const r=await api('ask_creature_history',{offset:String(historyOffset)});if(closed||ticket!==epoch)return;
    if(!append)content.replaceChildren(el('h3','cc-chat-section-title','Your conversations'));
    content.querySelector('.cc-chat-more')?.remove();
    if(!r.conversations.length&&!append)content.append(el('p','cc-chat-muted','No saved chats yet. Start a new chat to begin.'));
    for(const t of r.conversations){const b=el('button','cc-chat-history-item');b.type='button';b.append(el('strong','',t.title),el('span','',`${new Date(t.updated_at).toLocaleString()} · ${t.message_count} messages`));b.onclick=()=>resume(t.id);content.append(b);}
    historyOffset=r.nextOffset;if(r.hasMore){const b=el('button','cc-chat-more','Load more conversations');b.type='button';b.onclick=()=>history(true);content.append(b);}
   }catch(e){if(ticket===epoch&&!closed){if(!append)content.replaceChildren(el('h3','cc-chat-section-title','Your conversations'));showError(e);}}
   finally{if(ticket===epoch&&!closed){loading=false;busy();}}
  }
  async function resume(id){
   const ticket=++epoch;loading=true;clearError();busy();content.replaceChildren(el('p','cc-chat-muted','Opening conversation…'));
   try{const r=await api('ask_creature_history',{conversationId:id});if(closed||ticket!==epoch)return;conversationId=id;messageCount=r.messageCount;messages=r.messages;olderOffset=r.nextOffset;hasOlder=r.hasMore;retry=null;view='chat';input.value='';form.hidden=false;historyButton.setAttribute('aria-pressed','false');render();}
   catch(e){if(!closed&&ticket===epoch){content.replaceChildren();showError(e);}}
   finally{if(!closed&&ticket===epoch){loading=false;busy();input.focus();}}
  }
  async function loadOlder(button){const ticket=epoch;button.disabled=true;const height=content.scrollHeight;try{const r=await api('ask_creature_history',{conversationId,offset:String(olderOffset)});if(closed||ticket!==epoch)return;const ids=new Set(messages.map(m=>m.id).filter(Boolean));messages=[...r.messages.filter(m=>!ids.has(m.id)),...messages];olderOffset=r.nextOffset;hasOlder=r.hasMore;render();content.scrollTop=content.scrollHeight-height;}catch(e){if(!closed&&ticket===epoch){showError(e);button.disabled=false;}}}
  newButton.onclick=fresh;historyButton.onclick=()=>history();
  input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!sending&&!loading&&input.value.trim())form.requestSubmit();}};
  form.onsubmit=async e=>{
   e.preventDefault();if(sending||loading||closed)return;const message=input.value.trim();if(!message)return;
   const requestId=retry?.message===message?retry.id:crypto.randomUUID(),ticket=epoch;retry={message,id:requestId};sending=true;clearError();busy();
   if(!messages.length)content.replaceChildren();const user=bubble({role:'user',content:message}),pending=bubble({role:'assistant',content:'Thinking…'});pending.classList.add('is-pending');pending.setAttribute('role','status');content.append(user,pending);content.scrollTop=content.scrollHeight;input.value='';
   try{const r=await api('ask_creature',{method:'POST',body:{message,currentPath:location.pathname,conversationId,requestId,messageCount}});if(closed||ticket!==epoch)return;messageCount=r.messageCount;messages.push({role:'user',content:message},{role:'assistant',content:r.answer});pending.querySelector('.cc-chat-text').textContent=r.answer;pending.classList.remove('is-pending');retry=null;}
   catch(e){if(!closed&&ticket===epoch){user.remove();pending.remove();input.value=message;showError(e);}}
   finally{sending=false;if(!closed&&ticket===epoch){busy();input.focus();content.scrollTop=content.scrollHeight;}}
  };
  current={fresh};fresh();
  api('ask_creature_faqs',{path:location.pathname}).then(r=>{
    if(closed)return;
    faq=r;
    const pageTopic = r.topic || 'Agency Scorecard';
    wrap.querySelector('.cc-chat-page').textContent = pageTopic;
    if(badgeNode) badgeNode.textContent = `${pageTopic} context · A`;
    if(input) input.placeholder = `Ask about ${pageTopic}...`;
    if(footerNoteNode) footerNoteNode.textContent = `Mock responses · scoped to ${pageTopic.toLowerCase()}`;
    if(view==='chat'&&!messages.length&&!sending)welcome();
  }).catch(e=>{
    if(!closed){
      faq={topic:'Agency Scorecard',questions:[]};
      if(badgeNode) badgeNode.textContent = `Agency Scorecard context · A`;
      if(input) input.placeholder = `Ask about Agency Scorecard...`;
      if(footerNoteNode) footerNoteNode.textContent = `Mock responses · scoped to agency scorecard`;
      if(view==='chat'&&!messages.length&&!sending)welcome();
      showError(e);
    }
  });
 }
 window.CCAskCreature={open};
})();
