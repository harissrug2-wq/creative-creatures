(()=>{
  const loader=document.getElementById('ccPageLoader');
  if(!loader)return;
  const started=Date.now();
  let fallbackTimer=null;
  let windowLoaded=document.readyState!=='loading';
  let holdCount=0;

  const isPaymentPath = () => {
    const p = (window.location.pathname || '').toLowerCase();
    return p.includes('/payment') || p.includes('/signup-3') || p.includes('/checkout');
  };

  const isPaymentTarget = (formOrAnchor, urlStr) => {
    if (isPaymentPath()) return true;
    if (formOrAnchor) {
      if (formOrAnchor.hasAttribute?.('data-no-loader')) return true;
      if (['paymentForm', 's3LookupForm', 'lookupForm', 'archetypeLookupForm'].includes(formOrAnchor.id)) return true;
      if (formOrAnchor.classList?.contains('payment-form') || formOrAnchor.classList?.contains('payment-submit') || formOrAnchor.classList?.contains('s3-lookup-form')) return true;
    }
    if (urlStr) {
      const u = String(urlStr).toLowerCase();
      if (u.includes('/payment') || u.includes('stripe.com') || u.includes('/api/payment-confirmation') || u.includes('/checkout')) return true;
    }
    return false;
  };

  const setCopy=(label)=>{
    const text=loader.querySelector('[data-loader-copy]');
    if(text&&label)text.textContent=label;
  };

  const actuallyHide=()=>{
    if(!windowLoaded||holdCount>0)return;
    clearTimeout(fallbackTimer);
    loader.classList.add('cc-page-loader--hidden');
    loader.setAttribute('aria-hidden','true');
  };

  if (isPaymentPath()) {
    actuallyHide();
  }

  const show=(label='Loading your agency workspace…')=>{
    if (isPaymentPath()) return;
    setCopy(label);
    loader.classList.remove('cc-page-loader--hidden');
    loader.setAttribute('aria-hidden','false');
    clearTimeout(fallbackTimer);
    fallbackTimer=setTimeout(()=>{
      holdCount=0;
      windowLoaded=true;
      actuallyHide();
    },15000);
  };

  const hide=()=>actuallyHide();

  const hold=(label='Loading your agency workspace…')=>{
    if (isPaymentPath()) return () => {};
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
  else document.addEventListener('DOMContentLoaded',()=>{windowLoaded=true;actuallyHide();},{once:true});
  window.addEventListener('pageshow',()=>{windowLoaded=true;actuallyHide();});

  document.addEventListener('submit',event=>{
    const form=event.target;
    if(!form)return;
    if(form.target==='_blank'||form.classList?.contains('cc-ai-form')||form.closest?.('.cc-ai-panel')||isPaymentTarget(form,form.action))return;
    // Let AJAX form handlers cancel native submission before deciding to block the page.
    queueMicrotask(()=>{if(!event.defaultPrevented)show('Saving and loading…');});
  },true);

  document.addEventListener('click',event=>{
    const anchor=event.target.closest?.('a[href]');
    if(!anchor||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    if(anchor.target==='_blank'||anchor.hasAttribute('download')||isPaymentTarget(anchor,anchor.getAttribute('href')))return;
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

