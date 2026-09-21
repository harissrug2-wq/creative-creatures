(() => {
  const plans={diagnostic:{title:'1:1 Analysis & Planning Diagnostic',price:'$6,800',meta:'One-time payment · USD',features:['Agency analysis and planning','Private review sessions']},accelerator:{title:'Facilitated Breakthrough Accelerator',price:'$4,600',meta:'Six sessions · One-time payment · USD',features:['Facilitated 90-day program','Accelerator workspace']},platform:{title:'Platform / Partner Portal',price:'$3,097 today',meta:'$2,500 setup + $597 first month; then $597/month · USD',features:['Agency Intelligence Platform','Partner Portal']},fractional_coo:{title:'Fractional COO + Platform Bundle',price:'$6,497 today',meta:'$2,500 setup + $3,997 first month; then $3,997/month · USD',features:['Fractional COO support','Platform and guided setup']}};
  const query=new URLSearchParams(location.search);
  const chosen=query.get('plan')||localStorage.getItem('ccProgramPath')||'diagnostic';
  const plan=Object.hasOwn(plans,chosen)?chosen:'diagnostic',spec=plans[plan];
  document.title=`${spec.title} Payment · Creative Creatures`;
  document.getElementById('orderPlanTitle').textContent=spec.title;
  document.getElementById('orderPlanPrice').textContent=spec.price;
  document.getElementById('orderPlanMeta').textContent=spec.meta;
  document.getElementById('orderPlanDescription').textContent=['platform','fractional_coo'].includes(plan)?'The setup fee is charged once when this subscription starts.':'Access is activated after Stripe confirms payment.';
  const features=document.getElementById('orderPlanFeatures');
  for(const feature of spec.features){const li=document.createElement('li');li.textContent=feature;features.appendChild(li);}
  const account=window.CCAccount?.getAccount?.(),email=document.getElementById('checkoutEmail');
  email.value=account?.email||localStorage.getItem('ccOwnerEmail')||'';
  const form=document.getElementById('paymentForm'),button=form.querySelector('button[type=submit]'),error=document.getElementById('paymentError');
  const showError=message=>{error.textContent=message;error.classList.add('show');};
  async function request(action,body){const r=await fetch(`/api/payment-confirmation?action=${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Object.assign(new Error(data.error||'Unable to complete checkout.'),{code:data.code});return data;}
  const signOutButton=document.getElementById('checkoutSignOut');
  signOutButton.addEventListener('click',async()=>{
    if(signOutButton.disabled)return;
    signOutButton.disabled=true;button.disabled=true;
    try{
      const response=await fetch('/api/account-auth',{method:'DELETE'});
      if(!response.ok)throw new Error('Sign out failed. Please try again.');
      ['ccSignedIn','cc_account','ccUserAccount'].forEach(key=>localStorage.removeItem(key));
      // Keep the assessment email and report data needed for this purchase.
      localStorage.setItem('ccOwnerEmail',email.value.trim());
      signOutButton.hidden=true;button.disabled=false;
      form.requestSubmit();
    }catch(e){showError(e.message);signOutButton.disabled=false;button.disabled=false;}
  });
  form.addEventListener('submit' ,async event=>{event.preventDefault();signOutButton.hidden=true;signOutButton.disabled=false;button.disabled=true;error.textContent='';button.textContent='Opening Stripe…';try{const data=await request('checkout',{plan,email:email.value.trim()});const target=new URL(data.url);if(target.protocol!=='https:'||target.hostname!=='checkout.stripe.com')throw new Error('Unexpected checkout address.');location.assign(target.href);}catch(e){showError(e.message);signOutButton.hidden=e.code!=='MEMBER_CHECKOUT_SESSION';button.disabled=false;button.textContent='Continue to secure payment';}});
  if(query.get('cancelled')==='1')showError('Checkout was cancelled. No access was activated.');
  async function confirmPayment(){
    button.disabled=true;button.textContent='Checking payment…';
    const id=query.get('session_id');
    try{
      for(let attempt=0;attempt<12;attempt++){
        const data=await request('status',{sessionId:id});
        if(data.paid){
          document.getElementById('paymentGrid').hidden=true;document.getElementById('paymentThanks').hidden=false;
          document.getElementById('thanksName').textContent='';
          document.getElementById('paymentEmailStatus').textContent=data.emailSent?'Payment confirmed. Check your email to set your password, or sign in with your existing login.':'Payment confirmed. Your access is active. Sign in with your existing login, or use Forgot password to request a setup link.';
          const link=document.querySelector('.payment-continue');link.href='/login/';link.textContent='Sign in to your workspace';
          history.replaceState(null,'',`/payment/?plan=${data.plan}`);return;
        }
        if(data.state==='expired')throw new Error('This checkout expired without a completed payment.');
        await new Promise(resolve=>setTimeout(resolve,2000));
      }
      showError('Payment is still being confirmed. Refresh this page shortly; do not start another payment.');
    }catch(e){showError(e.message);}
    button.textContent='Refresh this page to check payment';
  }
  if(query.get('session_id'))confirmPayment();
})();
