import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
let JSDOM;try{({JSDOM}=await import(process.env.JSDOM_MODULE||'jsdom'));}catch{}
const html=fs.readFileSync(new URL('../public/integrations/stripe/index.html',import.meta.url),'utf8');
const script=fs.readFileSync(new URL('../public/integrations/stripe/billing.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setTimeout(resolve,15));
const submit=(w,id)=>w.document.getElementById(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
test('billing forms: escaping, exact amount, durable retry and reviewed test send',{skip:!JSDOM},async()=>{
 const dom=new JSDOM(html,{url:'https://app.example.com/integrations/stripe/',runScripts:'outside-only'}),w=dom.window;
 try{
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
  const calls=[],customers=[{id:'cus_fixture',name:'<img src=x onerror=alert(1)>',email:'client@example.com'}],invoices=[];let fail=true;
  w.fetch=async(url,opts={})=>{
   const action=new URL(url,w.location.href).searchParams.get('action'),b=JSON.parse(opts.body||'{}');calls.push({action,b});
   const connection={connected:true,configured:true,name:'Test Agency',environment:'test',stripeAccountId:'acct_fixture'};
   let data={connection},ok=true;
   if(action==='customers')data={records:customers,hasMore:false,connection};
   if(action==='invoices')data={records:invoices,hasMore:false,connection};
   if(action==='create_invoice'){
    if(fail){fail=false;ok=false;data={error:'Temporary error'}}
    else{const invoice={id:'in_fixture',number:'DRAFT-1',customerEmail:'client@example.com',description:b.description,total:12550,currency:'usd',status:'draft',manageable:true};invoices.push(invoice);data={invoice}}
   }
   if(action==='send_invoice'){invoices[0].status='open';data={sent:true};}
   return{ok,status:ok?200:502,json:async()=>data};
  };
  w.eval(script);await flush();
  assert.equal(w.document.querySelector('#records img'),null,'customer text must not become HTML');
  w.document.querySelector('[data-invoice]').click();
  w.document.querySelector('[name=description]').value='Services';w.document.querySelector('[name=amount]').value='125.50';
  assert.equal(w.document.querySelector('[name=amount]').getAttribute('pattern'),'[0-9]{1,6}(\\.[0-9]{1,2})?');
  submit(w,'editorForm');await flush();assert.match(w.document.getElementById('formError').textContent,/Temporary/);
  assert.equal(w.document.querySelector('[name=amount]').disabled,true);
  submit(w,'editorForm');await flush();
  const attempts=calls.filter(x=>x.action==='create_invoice');assert.equal(attempts.length,2);assert.deepEqual(attempts[0].b,attempts[1].b);assert.equal(attempts[1].b.amount,'125.50');
  assert.equal(w.document.getElementById('editor').open,false);assert.match(w.document.getElementById('records').textContent,/DRAFT-1/);
  assert.equal(calls.filter(x=>x.action==='send_invoice').length,0);
  w.document.querySelector('[data-send]').click();assert.match(w.document.getElementById('sendSummary').textContent,/client@example.com/);
  submit(w,'sendForm');await flush();const send=calls.find(x=>x.action==='send_invoice');assert.equal(send.b.confirm,true);assert.equal(send.b.total,12550);assert.match(w.document.getElementById('notice').textContent,/Test mode does not deliver/);
 }finally{w.close()}
});
