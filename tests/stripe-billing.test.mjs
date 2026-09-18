import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {PLANS,checkoutParams,validatePaidSession,verifyWebhook,priceIds,rawBody,jsonBody} from '../lib/stripe-billing.js';
import handler from '../api/payment-confirmation.js';
process.env.STRIPE_SECRET_KEY='sk_test_fixture';process.env.STRIPE_WEBHOOK_SECRET='whsec_fixture';process.env.STRIPE_APP_URL='https://preview.example.com';process.env.ACCOUNT_SESSION_SECRET='fixture-secret';
for(const plan of Object.values(PLANS))for(const [key]of plan.prices)process.env[key]='price_'+key.replaceAll('_','');
const order={id:'12345678-1234-1234-1234-123456789abc',email:'buyer@example.com',plan:'platform',expires_at:new Date(Date.now()+35*60000).toISOString()};
const session={metadata:{cc_order_id:order.id},client_reference_id:order.id,livemode:false,currency:'usd',mode:'subscription',amount_total:309700,amount_subtotal:309700,status:'complete',payment_status:'paid'};
async function call(action,body,headers={},parsed=false){const req=Readable.from(parsed?[]:[JSON.stringify(body)]);if(parsed)req.body=body;req.method='POST';req.query={action};req.headers=headers;const res={headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.data=JSON.parse(v)}};await handler(req,res);return res;}
test('approved package totals and billing modes',()=>{
 assert.deepEqual(Object.values(PLANS).map(p=>[p.amount,p.mode]),[[680000,'payment'],[460000,'payment'],[309700,'subscription'],[649700,'subscription']]);
 const params=checkoutParams({...order,plan:'fractional_coo'},['price_monthly','price_setup']);
 assert.equal(params['line_items[0][price]'],'price_monthly');assert.equal(params['line_items[1][price]'],'price_setup');assert.equal(params.mode,'subscription');
 assert.equal(params.success_url,'https://preview.example.com/payment/?plan=fractional_coo&session_id={CHECKOUT_SESSION_ID}');
 assert.equal(params['subscription_data[metadata][cc_order_id]'],order.id);
});
test('only completed paid matching orders can activate',()=>{
 assert.equal(validatePaidSession(session,order),true);
 for(const patch of [{payment_status:'unpaid'},{status:'open'},{amount_total:1},{amount_subtotal:1},{currency:'eur'},{livemode:true},{mode:'payment'},{client_reference_id:'other'},{metadata:{cc_order_id:'other'}}])assert.throws(()=>validatePaidSession({...session,...patch},order));
});
test('webhook validates exact bytes, timestamp, and rotated signatures',()=>{
 const raw=Buffer.from('{"type":"checkout.session.completed"}'),now=1700000000;
 const signature=crypto.createHmac('sha256','whsec_fixture').update(`${now}.`).update(raw).digest('hex');
 assert.equal(verifyWebhook(raw,`t=${now},v1=${'0'.repeat(64)},v1=${signature}`,'whsec_fixture',now).type,'checkout.session.completed');
 assert.throws(()=>verifyWebhook(Buffer.from('{}'),`t=${now},v1=${signature}`,'whsec_fixture',now));
 assert.throws(()=>verifyWebhook(raw,`t=${now},v1=${signature}`,'whsec_fixture',now+301));
 assert.throws(()=>verifyWebhook(raw,`t=${now},v1=bad`,'whsec_fixture',now));
});
test('old simulated activation is disabled without touching database',async()=>{
 global.fetch=()=>{throw new Error('unexpected network')};const r=await call('',{to:'buyer@example.com',accessPlan:'fractional_coo',completedAt:new Date().toISOString()});assert.equal(r.statusCode,410);
});
test('cross-origin checkout is rejected',async()=>{const r=await call('checkout',{plan:'platform',email:order.email},{origin:'https://attacker.example'});assert.equal(r.statusCode,403);});
test('confirmation cannot reveal an order without checkout cookie',async()=>{const r=await call('status',{sessionId:'cs_test_stolen'},{origin:process.env.STRIPE_APP_URL});assert.equal(r.statusCode,401);});
test('price configuration must match server approved prices',async()=>{
 for(const [plan,spec] of Object.entries(PLANS)){
  global.fetch=async url=>{const id=url.split('/').pop();const [,amount,interval]=spec.prices.find(([key])=>process.env[key]===id);return{ok:true,json:async()=>({active:true,currency:'usd',unit_amount:amount,livemode:false,billing_scheme:'per_unit',recurring:interval?{interval,interval_count:1,usage_type:'licensed'}:null})}};
  assert.equal((await priceIds(plan)).length,spec.prices.length);
 }
 global.fetch=async()=>({ok:true,json:async()=>({active:true,currency:'usd',unit_amount:1,livemode:false})});await assert.rejects(priceIds('platform'));
});
test('checkout uses server prices and ignores client amount or lead ID',async()=>{
 process.env.SUPABASE_URL='https://database.example';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';
 const calls=[];global.fetch=async(url,options={})=>{
  calls.push({url,options});
  let data;
  if(url.includes('/prices/')){const setup=url.endsWith(process.env.STRIPE_PRICE_FRACTIONAL_COO_SETUP);data={active:true,currency:'usd',unit_amount:setup?250000:59700,livemode:false,billing_scheme:'per_unit',recurring:setup?null:{interval:'month',interval_count:1,usage_type:'licensed'}};}
  else if(url.includes('/rpc/cc_stripe_begin'))data=order;
  else if(url.endsWith('/checkout/sessions'))data={id:'cs_test_checkout',expires_at:Math.floor(Date.now()/1000)+86400,url:'https://checkout.stripe.com/c/test'};
  else data=[];
  return{ok:true,json:async()=>data};
 };
 const result=await call('checkout',{plan:'platform',email:order.email,amount:1,price:'price_attacker',leadId:'attacker'},{origin:process.env.STRIPE_APP_URL},true);
 assert.equal(result.statusCode,200);assert.match(result.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Lax/);
 const request=new URLSearchParams(calls.find(c=>c.url.endsWith('/checkout/sessions')).options.body);
 assert.equal(request.get('line_items[0][price]'),process.env.STRIPE_PRICE_PLATFORM);
 assert.equal(request.get('line_items[1][price]'),process.env.STRIPE_PRICE_FRACTIONAL_COO_SETUP);
 assert.equal(request.get('line_items[1][quantity]'),'1');
 assert.equal(request.has('line_items[2][price]'),false);
 assert.equal(request.has('amount'),false);
 const input=JSON.parse(calls.find(c=>c.url.includes('/rpc/cc_stripe_begin')).options.body);
 assert.deepEqual(input,{p_email:order.email,p_plan:'platform',p_account_id:null});
});
test('signed unpaid checkout event never fulfills',async()=>{
 const object={id:'cs_test_pending',metadata:{cc_order_id:order.id}};
 const event={type:'checkout.session.completed',livemode:false,data:{object}};
 const raw=JSON.stringify(event),stamp=Math.floor(Date.now()/1000),sig=crypto.createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET).update(`${stamp}.${raw}`).digest('hex');
 let count=0;global.fetch=async url=>{count++;assert.ok(url.includes('/checkout/sessions/'));return{ok:true,json:async()=>({...object,payment_status:'unpaid'})}};
 const result=await call('webhook',event,{'stripe-signature':`t=${stamp},v1=${sig}`});
 assert.equal(result.statusCode,200);assert.equal(count,1);
});

test('Platform payment without setup fee cannot activate',()=>{assert.throws(()=>validatePaidSession({...session,amount_total:59700,amount_subtotal:59700},order));});

test('parsed status body still enforces checkout cookie',async()=>{
 const r=await call('status',{sessionId:'cs_test_stolen'},{origin:process.env.STRIPE_APP_URL},true);
 assert.equal(r.statusCode,401);
});
test('webhook reads exact stream bytes without invoking JSON getter',async()=>{
 const raw=Buffer.from('{ "type": "ignored.event", "livemode": false }\n');
 const req=Readable.from([raw]);
 Object.defineProperty(req,'body',{get(){throw new Error('body getter must not run');}});
 assert.deepEqual(await rawBody(req),raw);
});
test('parsed-only webhook body is rejected instead of reconstructed',async()=>{
 const req=Readable.from([]);req.body={type:'ignored.event'};
 await assert.rejects(rawBody(req),/Raw request body is required/);
});
test('JSON parsing rejects malformed and non-object bodies',async()=>{
 for(const body of ['{bad','null','[]','123'])await assert.rejects(jsonBody({body}),/Invalid JSON/);
});

test('coupons enabled with stable parameters and standard payments',()=>{
 const params=checkoutParams(order,['price_monthly','price_setup']);
 assert.equal(params.allow_promotion_codes,'true');
 assert.equal(params['managed_payments[enabled]'],'false');
 assert.equal(Object.hasOwn(params,'expires_at'),false);
});
test('verified discounts on setup and subscription activate at the correct total',()=>{
 const discounted={...session,amount_total:278730,total_details:{amount_discount:30970,amount_tax:0,amount_shipping:0}};
 assert.equal(validatePaidSession(discounted,order),true);
 assert.throws(()=>validatePaidSession({...discounted,amount_total:1},order));
 assert.throws(()=>validatePaidSession({...discounted,amount_subtotal:59700},order));
 assert.throws(()=>validatePaidSession({...discounted,total_details:{amount_discount:-1}},order));
 assert.throws(()=>validatePaidSession({...discounted,id:'wrong'},{...order,session_id:'cs_expected'}));
});
test('100 percent coupons activate only a completed zero-total session',()=>{
 const free={...session,payment_status:'no_payment_required',amount_total:0,total_details:{amount_discount:309700}};
 assert.equal(validatePaidSession(free,order),true);
 assert.throws(()=>validatePaidSession({...free,status:'open'},order));
 assert.throws(()=>validatePaidSession({...free,payment_status:'unpaid'},order));
 assert.throws(()=>validatePaidSession({...free,amount_total:10},order));
});

test('old open checkout without coupons is expired before replacement',async()=>{
 const requests=[];
 global.fetch=async(url,options={})=>{
  requests.push({url,options});let data=[];
  if(url.includes('/prices/')){const setup=url.endsWith(process.env.STRIPE_PRICE_FRACTIONAL_COO_SETUP);data={active:true,currency:'usd',unit_amount:setup?250000:59700,livemode:false,billing_scheme:'per_unit',recurring:setup?null:{interval:'month',interval_count:1,usage_type:'licensed'}};}
  else if(url.includes('/rpc/cc_stripe_begin'))data={...order,session_id:'cs_old'};
  else if(url.endsWith('/checkout/sessions/cs_old'))data={id:'cs_old',status:'open',allow_promotion_codes:false};
  else if(url.endsWith('/expire'))data={id:'cs_old',status:'expired'};
  else if(url.endsWith('/checkout/sessions'))data={id:'cs_new',url:'https://checkout.stripe.com/c/new',expires_at:1800000000};
  return{ok:true,json:async()=>data};
 };
 const r=await call('checkout',{plan:'platform',email:order.email},{origin:process.env.STRIPE_APP_URL},true);
 assert.equal(r.statusCode,200);
 const expired=requests.findIndex(x=>x.url.endsWith('/expire'));
 const created=requests.findIndex(x=>x.url.endsWith('/checkout/sessions'));
 assert.ok(expired>=0&&created>expired);
 assert.equal(new URLSearchParams(requests[created].options.body).get('allow_promotion_codes'),'true');
 const patch=requests.find(x=>x.options.method==='PATCH');
 assert.deepEqual(JSON.parse(patch.options.body),{session_id:'cs_new',expires_at:new Date(1800000000*1000).toISOString()});
});
