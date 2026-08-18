(()=>{
  const loader=document.getElementById('ccPageLoader');
  if(!loader)return;
  const started=Date.now();
  let fallbackTimer=null;
  let windowLoaded=document.readyState==='complete';
  let holdCount=0;

  const setCopy=(label)=>{
    const text=loader.querySelector('[data-loader-copy]');
    if(text&&label)text.textContent=label;
  };

  const actuallyHide=()=>{
    if(!windowLoaded||holdCount>0)return;
    clearTimeout(fallbackTimer);
    const delay=Math.max(0,260-(Date.now()-started));
    setTimeout(()=>{
      if(holdCount>0)return;
      loader.classList.add('cc-page-loader--hidden');
      loader.setAttribute('aria-hidden','true');
    },delay);
  };

  const show=(label='Loading your agency workspace…')=>{
    setCopy(label);
    loader.classList.remove('cc-page-loader--hidden');
    loader.setAttribute('aria-hidden','false');
    clearTimeout(fallbackTimer);
    // Safety only. App-level holds normally release explicitly.
    fallbackTimer=setTimeout(()=>{
      holdCount=0;
      windowLoaded=true;
      actuallyHide();
    },30000);
  };

  const hide=()=>actuallyHide();

  const hold=(label='Loading your agency workspace…')=>{
    holdCount+=1;
    show(label);
    let released=false;
    return ()=>{
      if(released)return;
      released=true;
      holdCount=Math.max(0,holdCount-1);
      actuallyHide();
    };
  };

  const releaseAll=()=>{
    holdCount=0;
    actuallyHide();
  };

  window.CCPageLoader={show,hide,hold,releaseAll,get holdCount(){return holdCount;}};

  if(windowLoaded)actuallyHide();
  else window.addEventListener('load',()=>{windowLoaded=true;actuallyHide();},{once:true});
  window.addEventListener('pageshow',()=>{windowLoaded=true;actuallyHide();});

  document.addEventListener('submit',event=>{
    const form=event.target;
    if(form?.target==='_blank')return;
    show('Saving and loading…');
  },true);

  document.addEventListener('click',event=>{
    const anchor=event.target.closest?.('a[href]');
    if(!anchor||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    if(anchor.target==='_blank'||anchor.hasAttribute('download'))return;
    const href=anchor.getAttribute('href')||'';
    if(!href||href.startsWith('#')||/^(mailto:|tel:|javascript:)/i.test(href))return;
    try{
      const next=new URL(anchor.href,location.href);
      if(next.origin!==location.origin)return;
      if(next.pathname===location.pathname&&next.search===location.search&&next.hash)return;
      show('Loading your agency workspace…');
    }catch(_){ }
  },true);
})();
