import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function page(responses){
 const nodes=new Map(),calls=[],storage=new Map([['ccOwnerEmail','new@example.com'],['cc_account','member']]);
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,value:'',textContent:'',classList:{add(){}},events:{},appendChild(){},addEventListener(event,fn){this.events[event]=fn},querySelector(){return node('submit')},requestSubmit(){this.pending=this.events.submit({preventDefault(){}})}});return nodes.get(id)};
 const form=node('paymentForm');let destination='';
 vm.runInNewContext(read('public/payment/stripe-checkout.js'),{URL,URLSearchParams,document:{getElementById:node,createElement:()=>({}),querySelector:()=>node('continue')},window:{},location:{search:'?plan=diagnostic',assign:v=>destination=v},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:async(url,options)=>{calls.push({url,...options});const result=responses.shift();return{ok:result.ok,json:async()=>result.body}},history:{},setTimeout});
 return {node,form,calls,storage,destination:()=>destination};
}
test('member block offers explicit sign-out; no automatic session deletion',async()=>{
 const p=page([{ok:false,body:{error:'Member session',code:'MEMBER_CHECKOUT_SESSION'}}]);
 await p.form.events.submit({preventDefault(){}});
 assert.equal(p.node('checkoutSignOut').hidden,false);assert.equal(p.calls.length,1);assert.equal(p.calls[0].method,'POST');
});
test('confirmed sign-out preserves assessment email and starts a fresh checkout',async()=>{
 const p=page([{ok:false,body:{error:'Member session',code:'MEMBER_CHECKOUT_SESSION'}},{ok:true},{ok:true,body:{url:'https://checkout.stripe.com/c/pay/test'}}]);
 await p.form.events.submit({preventDefault(){}});await p.node('checkoutSignOut').events.click();await p.form.pending;
 assert.equal(p.calls[1].method,'DELETE');assert.equal(JSON.parse(p.calls[2].body).email,'new@example.com');assert.equal(p.storage.has('cc_account'),false);assert.match(p.destination(),/^https:\/\/checkout.stripe.com/);
});
test('failed logout never retries checkout',async()=>{
 const p=page([{ok:false}]);await p.node('checkoutSignOut').events.click();assert.equal(p.calls.length,1);assert.equal(p.storage.get('cc_account'),'member');assert.equal(p.node('checkoutSignOut').disabled,false);
});
test('unrelated errors do not offer session switching',async()=>{
 const p=page([{ok:false,body:{error:'Invalid package'}}]);await p.form.events.submit({preventDefault(){}});assert.equal(p.node('checkoutSignOut').hidden,true);
});
test('server still rejects member cookie before prices or orders are accessed',()=>{
 const src=read('api/payment-confirmation.js');const start=src.indexOf('      if(anySession?.memberId)');const end=src.indexOf('      let email=',start);
 assert.ok(start>0);assert.throws(()=>vm.runInNewContext(src.slice(start,end),{anySession:{memberId:'member'},fail:(status,message)=>Object.assign(new Error(message),{status})}),e=>e.status===403&&e.code==='MEMBER_CHECKOUT_SESSION');
 assert.ok(end<src.indexOf('      const ids=await priceIds(plan)',end));
});
