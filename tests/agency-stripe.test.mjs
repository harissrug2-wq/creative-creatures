import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import handler, { invoiceInput, stripeRequest } from '../lib/agency-stripe.js';
import paymentHandler from '../api/payment-confirmation.js';
import { signSession } from '../lib/session-utils.js';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const requestId='33333333-3333-4333-8333-333333333333';
const origin='https://app.example.com';
Object.assign(process.env,{STRIPE_CONNECT_ENABLED:'true',STRIPE_CONNECT_SECRET_KEY:'sk_test_connect',STRIPE_CONNECT_CLIENT_ID:'ca_fixture',STRIPE_CONNECT_WEBHOOK_SECRET:'whsec_connect',STRIPE_CONNECT_APP_URL:origin,ACCOUNT_SESSION_SECRET:'test-session',SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'test-db'});
const reply=(data,status=200)=>({ok:status<400,status,headers:{get:()=>null},json:async()=>structuredClone(data)});
function fixture() {
 const state={calls:[],connections:[{account_id:A,livemode:false,stripe_account_id:'acct_agencyA',display_name:'Agency A',status:'connected',connected_at:new Date(0).toISOString()},{account_id:B,livemode:false,stripe_account_id:'acct_agencyB',status:'connected',connected_at:new Date(0).toISOString()}],operations:[],states:[],invoices:[],customers:[{id:'cus_A',account:'acct_agencyA',email:'client@example.com',name:'Client'},{id:'cus_B',account:'acct_agencyB',email:'other@example.com',name:'Other'}],cache:new Map(),failLine:0,priceChanged:false};
 global.fetch=async (url,opts={})=>{
  const u=new URL(url),method=opts.method||'GET';state.calls.push({url,opts});
  if(u.host==='db.example'){
   const path=u.pathname.replace('/rest/v1/',''),body=opts.body?JSON.parse(opts.body):null;
   if(path==='accounts'){const id=u.searchParams.get('id')?.slice(3);return reply([...[A,B]].filter(x=>x===id).map(id=>({id,access_plan:state.plan||'platform'})));}
   if(path==='rpc/agency_stripe_claim'){
    if(state.connections.some(x=>x.stripe_account_id===body.p_stripe_account_id&&x.account_id!==body.p_account_id))return reply({},409);
    let r=state.connections.find(x=>x.account_id===body.p_account_id&&x.livemode===body.p_livemode);
    if(r?.status==='connected')return reply({error:'already connected'});
    if(!r){r={};state.connections.push(r)}Object.assign(r,{account_id:body.p_account_id,livemode:body.p_livemode,stripe_account_id:body.p_stripe_account_id,status:'connected'});return reply(r);
   }
   const table=path==='agency_stripe_connections'?state.connections:path==='agency_stripe_operations'?state.operations:state.states;
   const matching=()=>table.filter(row=>[...u.searchParams].every(([k,v])=>{
    if(['limit','select','on_conflict'].includes(k))return true;
    const [op,...rest]=v.split('.'),value=rest.join('.');
    return op==='eq'?String(row[k])===value:op==='gt'?Date.parse(row[k])>Date.parse(value):op==='lte'?Date.parse(row[k])<=Date.parse(value):false;
   }));
   if(method==='GET')return reply(matching());
   if(method==='POST'){
    if(path==='agency_stripe_operations'&&table.some(x=>x.account_id===body.account_id&&x.livemode===body.livemode&&x.request_id===body.request_id))return reply([]);
    const r={...body,created_at:new Date().toISOString()};table.push(r);return reply([r]);
   }
   const rows=matching();if(method==='PATCH')rows.forEach(x=>Object.assign(x,body));if(method==='DELETE')rows.forEach(x=>table.splice(table.indexOf(x),1));return reply(rows);
  }
  if(u.host==='connect.stripe.com')return reply(u.pathname.endsWith('/token')?{stripe_user_id:state.oauthAccount||'acct_new',scope:'read_write',livemode:state.wrongMode||false}:{});
  assert.equal(u.host,'api.stripe.com');
  const acct=opts.headers['Stripe-Account'],p=u.pathname.replace('/v1/',''),body=Object.fromEntries(new URLSearchParams(opts.body||''));
  if(p==='account')return reply({id:acct||'acct_platform',business_profile:{name:'Connected agency'}});
  assert.ok(acct,'Every billing request must be scoped');
  const key=opts.headers['Idempotency-Key'];if(key&&state.cache.has(key))return reply(state.cache.get(key));
  let result;
  if(p==='customers'&&method==='GET')result={data:state.customers.filter(c=>c.account===acct),has_more:false};
  else if(p.startsWith('customers/')){
   const c=state.customers.find(c=>c.id===p.split('/')[1]&&c.account===acct);if(!c)return reply({},404);if(method==='POST')Object.assign(c,body);result=c;
  }else if(p==='customers'){result={id:'cus_new',account:acct,...body};state.customers.push(result)}
  else if(p==='invoices'&&method==='GET')result={data:state.invoices.filter(i=>i.account===acct),has_more:false};
  else if(p==='invoices'){
   result={id:'in_'+(state.invoices.length+1),account:acct,customer:body.customer,customer_email:'client@example.com',currency:body.currency,status:'draft',total:0,collection_method:body.collection_method,metadata:{cc_source:body['metadata[cc_source]'],cc_agency_id:body['metadata[cc_agency_id]']}};state.invoices.push(result);
  }else if(p==='invoiceitems'){
   if(state.failLine-->0)return reply({error:{code:'timeout'}},500);
   const i=state.invoices.find(i=>i.id===body.invoice&&i.account===acct);assert.ok(i);i.total+=Number(body.amount);result={id:'ii_1'};
  }else if(p.startsWith('invoices/')){
   const [,id,action]=p.split('/'),i=state.invoices.find(i=>i.id===id&&i.account===acct);if(!i)return reply({},404);
   if(action==='finalize'){i.status='open';if(state.priceChanged)i.total+=100;}
   else if(action==='send'){state.sent=(state.sent||0)+1;}
   else if(method==='POST')i.metadata.cc_ready=body['metadata[cc_ready]'];
   result=i;
  }else throw new Error('Unexpected '+url);
  if(key)state.cache.set(key,structuredClone(result));return reply(result);
 };
 return state;
}
async function call(action,body={},options={}){
 const req=Readable.from([JSON.stringify(body)]);req.method=options.method||'POST';req.query={action,...options.query};
 req.headers={origin,cookie:`cc_account_session=${signSession({role:'account',accountId:options.agency||A,...options.session},'test-session')}`,...options.headers};
 const res={headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.data=v?JSON.parse(v):null}};
 await (options.dispatch?paymentHandler:handler)(req,res);return res;
}
const invoice={customerId:'cus_A',description:'Monthly services',amount:'125.50',currency:'usd',daysUntilDue:30,requestId};

test('invoice input rejects floating ambiguity, invalid currencies and out-of-range amounts',()=>{
 assert.equal(invoiceInput(invoice).cents,12550);
 for(const patch of [{amount:'1.005'},{amount:'-1'},{amount:'NaN'},{amount:'0.99'},{currency:'jpy'},{daysUntilDue:0},{customerId:'cus_../x'}])assert.throws(()=>invoiceInput({...invoice,...patch}));
});
test('Stripe requests cannot fall back to the platform account',async()=>{
 fixture();await assert.rejects(stripeRequest({key:'sk_test_x'},'customers'),/connected agency/);
});
test('unsigned users, members, wrong-origin requests and unpaid plans cannot write',async()=>{
 const f=fixture();
 assert.equal((await call('save_customer',{}, {headers:{cookie:''}})).statusCode,403);
 assert.equal((await call('customers',{}, {session:{memberId:'member'}})).statusCode,403);
 assert.equal((await call('connect',{}, {headers:{origin:'https://evil.example'}})).statusCode,403);
 f.plan='owner_archetype';assert.equal((await call('customers')).statusCode,403);
 assert.equal(f.calls.filter(c=>c.url.includes('stripe.com')).length,0);
});
test('disabled feature returns status and makes no Stripe calls',async()=>{
 const f=fixture();process.env.STRIPE_CONNECT_ENABLED='false';
 try{const r=await call('status',{}, {method:'GET'});assert.equal(r.data.connection.configured,false);assert.equal((await call('connect')).statusCode,503);assert.ok(!f.calls.some(c=>c.url.includes('stripe.com')));}finally{process.env.STRIPE_CONNECT_ENABLED='true'}
});
test('dispatcher handles agency requests without touching package billing configuration',async()=>{
 fixture();const r=await call('customers',{}, {dispatch:true,query:{agency_stripe:'1'}});assert.equal(r.statusCode,200);assert.equal(r.data.records[0].id,'cus_A');
});
test('tenant input cannot select another Stripe account or customer',async()=>{
 const f=fixture();const r=await call('customers',{accountId:B,stripeAccountId:'acct_agencyB'});assert.equal(r.data.records[0].id,'cus_A');
 const bad=await call('create_invoice',{...invoice,customerId:'cus_B'});assert.equal(bad.statusCode,404);assert.equal(f.invoices.length,0);
 assert.ok(f.calls.filter(c=>c.url.includes('api.stripe.com')).every(c=>c.opts.headers['Stripe-Account']==='acct_agencyA'));
});
test('new draft excludes pending items, never sends, and attaches the line to that invoice',async()=>{
 const f=fixture();const r=await call('create_invoice',invoice);assert.equal(r.statusCode,200);assert.equal(r.data.invoice.total,12550);assert.equal(f.sent,undefined);
 const drafts=f.calls.filter(c=>new URL(c.url).pathname==='/v1/invoices');const p=new URLSearchParams(drafts[0].opts.body);
 assert.equal(p.get('pending_invoice_items_behavior'),'exclude');assert.equal(p.get('auto_advance'),'false');assert.equal(p.get('collection_method'),'send_invoice');
 assert.equal(new URLSearchParams(f.calls.find(c=>c.url.endsWith('/invoiceitems')).opts.body).get('invoice'),'in_1');
});
test('partial draft failure resumes with the same invoice and one line; completed replay does not duplicate',async()=>{
 const f=fixture();f.failLine=1;assert.equal((await call('create_invoice',invoice)).statusCode,502);assert.equal(f.invoices.length,1);
 assert.equal((await call('create_invoice',invoice)).statusCode,200);assert.equal(f.invoices.length,1);assert.equal(f.invoices[0].total,12550);
 await call('create_invoice',invoice);assert.equal(f.invoices.length,1);assert.equal(f.invoices[0].total,12550);
 assert.equal((await call('create_invoice',{...invoice,amount:'999'})).statusCode,409);
});
test('unfinished operations older than Stripe idempotency retention fail closed',async()=>{
 const f=fixture();f.failLine=1;await call('create_invoice',invoice);f.operations[0].created_at=new Date(Date.now()-24*3600000).toISOString();
 assert.equal((await call('create_invoice',invoice)).statusCode,409);assert.equal(f.invoices.length,1);
});
test('customers can be created and edited in the agency account with retry protection',async()=>{
 const f=fixture(),body={requestId,name:'New client',email:'new@example.com',phone:''};
 assert.equal((await call('save_customer',body)).statusCode,200);await call('save_customer',body);assert.equal(f.customers.length,3);
 const r=await call('save_customer',{...body,id:'cus_new',name:'Updated',requestId:crypto.randomUUID()});assert.equal(r.data.customer.name,'Updated');
});
test('send requires explicit review and never acts on foreign or external invoices',async()=>{
 fixture();await call('create_invoice',invoice);
 assert.equal((await call('send_invoice',{id:'in_1'})).statusCode,422);
 assert.equal((await call('send_invoice',{id:'in_1',confirm:true,total:1,currency:'usd',email:'client@example.com'})).statusCode,409);
 assert.equal((await call('send_invoice',{id:'in_1',confirm:true},{agency:B})).statusCode,404);
});
test('finalize/send is idempotent and a finalization total change prevents sending',async()=>{
 const f=fixture();await call('create_invoice',invoice);const body={id:'in_1',confirm:true,total:12550,currency:'usd',email:'client@example.com'};
 assert.equal((await call('send_invoice',body)).statusCode,200);assert.equal((await call('send_invoice',body)).statusCode,200);assert.equal(f.sent,1);
 const g=fixture();await call('create_invoice',invoice);g.priceChanged=true;assert.equal((await call('send_invoice',body)).statusCode,409);assert.equal(g.sent,undefined);
 assert.equal((await call('send_invoice',{...body,total:12650})).statusCode,200);assert.equal(g.sent,1);
});
test('OAuth accepts a valid server-side state even when the helper cookie is missing, and rejects swapped/replayed state',async()=>{
 const f=fixture();f.connections[0].status='disconnected';const start=await call('connect');assert.equal(start.statusCode,200);
 const state=new URL(start.data.authorizationUrl).searchParams.get('state');
 const sessionCookie=`cc_account_session=${signSession({role:'account',accountId:A},'test-session')}`;
 assert.equal((await call('callback',{}, {method:'GET',query:{state:'0'.repeat(64),code:'ac_x'},headers:{cookie:sessionCookie}})).statusCode,403);
 const r=await call('callback',{}, {method:'GET',query:{state,code:'ac_x'},headers:{cookie:sessionCookie}});assert.equal(r.statusCode,303);
 assert.equal((await call('callback',{}, {method:'GET',query:{state,code:'ac_x'},headers:{cookie:sessionCookie}})).statusCode,403);
 assert.equal(f.connections[0].stripe_account_id,'acct_new');
});
test('OAuth cannot attach the platform account or use a different environment',async()=>{
 for(const patch of [{oauthAccount:'acct_platform'},{wrongMode:true}]){
 const f=fixture();Object.assign(f,patch);f.connections[0].status='disconnected';const r=await call('connect');const state=new URL(r.data.authorizationUrl).searchParams.get('state');
 const cb=await call('callback',{}, {method:'GET',query:{state,code:'ac_x'},headers:{cookie:`cc_account_session=${signSession({role:'account',accountId:A},'test-session')}; cc_stripe_connect_state=${state}`}});assert.equal(cb.statusCode,409);assert.equal(f.connections[0].status,'disconnected');
 }
});
test('verified Connect revocation only disconnects the matching account/mode; stale events ignored',async()=>{
 const f=fixture();const event={type:'account.application.deauthorized',account:'acct_agencyA',livemode:false,created:Math.floor(Date.now()/1000)};
 assert.equal((await call('webhook',event)).statusCode,400);
 const raw=JSON.stringify(event),t=Math.floor(Date.now()/1000),sig=crypto.createHmac('sha256','whsec_connect').update(`${t}.${raw}`).digest('hex');
 assert.equal((await call('webhook',event,{headers:{'stripe-signature':`t=${t},v1=${sig}`,cookie:''}})).statusCode,200);assert.equal(f.connections[0].status,'disconnected');assert.equal(f.connections[1].status,'connected');
 f.connections[0].status='connected';f.connections[0].connected_at=new Date(Date.now()+5000).toISOString();await call('webhook',event,{headers:{'stripe-signature':`t=${t},v1=${sig}`}});assert.equal(f.connections[0].status,'connected');
});
