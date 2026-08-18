(()=>{
  const loader=document.getElementById('ccPageLoader');
  if(!loader)return;
  const started=Date.now();
  let fallbackTimer=null;
  const show=(label='Loading your agency workspace…')=>{
    const text=loader.querySelector('[data-loader-copy]');
    if(text)text.textContent=label;
    loader.classList.remove('cc-page-loader--hidden');
    loader.setAttribute('aria-hidden','false');
    clearTimeout(fallbackTimer);
    fallbackTimer=setTimeout(hide,12000);
  };
  const hide=()=>{
    clearTimeout(fallbackTimer);
    const delay=Math.max(0,320-(Date.now()-started));
    setTimeout(()=>{
      loader.classList.add('cc-page-loader--hidden');
      loader.setAttribute('aria-hidden','true');
    },delay);
  };
  window.CCPageLoader={show,hide};
  if(document.readyState==='complete')hide();
  else window.addEventListener('load',hide,{once:true});
  window.addEventListener('pageshow',hide);
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
