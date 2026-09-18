import crypto from 'node:crypto';
import { accountSessionSecret, parseCookies, verifySession } from './session-utils.js';

export const PLANS = Object.freeze({
  diagnostic: { label:'1:1 Analysis & Planning Diagnostic', mode:'payment', amount:680000, prices:[['STRIPE_PRICE_DIAGNOSTIC',680000,null]] },
  accelerator: { label:'Facilitated Breakthrough Accelerator', mode:'payment', amount:460000, prices:[['STRIPE_PRICE_ACCELERATOR',460000,null]] },
  platform: { label:'Platform / Partner Portal', mode:'subscription', amount:309700, prices:[['STRIPE_PRICE_PLATFORM',59700,'month'],['STRIPE_PRICE_FRACTIONAL_COO_SETUP',250000,null]] },
  fractional_coo: { label:'Fractional COO + Platform Bundle', mode:'subscription', amount:649700, prices:[['STRIPE_PRICE_FRACTIONAL_COO',399700,'month'],['STRIPE_PRICE_FRACTIONAL_COO_SETUP',250000,null]] }
});
export const fail = (status,message) => Object.assign(new Error(message),{status});
export const clean = v => String(v??'').trim();
export const json = (res,status,data) => {res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};
export function settings(){
  const secret=clean(process.env.STRIPE_SECRET_KEY), webhook=clean(process.env.STRIPE_WEBHOOK_SECRET), url=clean(process.env.STRIPE_APP_URL).replace(/\/$/,'');
  if(!/^sk_(test|live)_/.test(secret)||!webhook||!/^https:\/\//.test(url)) throw fail(503,'Stripe checkout is not configured.');
  if(new URL(url).origin!==url) throw fail(503,'STRIPE_APP_URL must be an HTTPS origin without a path.');
  return {secret,webhook,url,live:secret.startsWith('sk_live_')};
}
export async function db(path,method='GET',body){
  const url=clean(process.env.SUPABASE_URL).replace(/\/$/,''),key=clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if(!url||!key)throw fail(503,'Payment database is not configured.');
  const r=await fetch(`${url}/rest/v1/${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const data=await r.json().catch(()=>null);
  if(!r.ok){console.error('Billing database request failed',{status:r.status,code:data?.code});throw fail(503,'Payment storage is unavailable. Check the billing migration.');}
  return data;
}
export const rpc=(name,body)=>db(`rpc/${name}`,'POST',body);
export async function stripe(path,body,idempotencyKey){
  const {secret}=settings();const headers={Authorization:`Bearer ${secret}`,'Stripe-Version':'2024-06-20'};
  if(body)headers['Content-Type']='application/x-www-form-urlencoded';
  if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
  const r=await fetch(`https://api.stripe.com/v1/${path}`,{method:body?'POST':'GET',headers,body:body?new URLSearchParams(body).toString():undefined,signal:AbortSignal.timeout(20000)});
  const data=await r.json();if(!r.ok){console.error('Stripe request failed',{status:r.status,type:data?.error?.type,code:data?.error?.code,param:data?.error?.param,message:String(data?.error?.message||'').replace(/(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+/g,'[REDACTED]')});throw fail(502,'Stripe could not complete this request. Please try again.');}return data;
}
export function owner(req){const p=verifySession(parseCookies(req).cc_account_session,accountSessionSecret());return p?.role==='account'&&!p.memberId?p:null;}
export async function rawBody(req){
  // Do not invoke Vercel's lazy body getter: webhook signatures need the stream's exact bytes.
  const parts=[];let size=0;
  if(req[Symbol.asyncIterator]&&!req.readableEnded&&!req.destroyed){
    for await(const chunk of req){const part=Buffer.from(chunk);size+=part.length;if(size>1048576)throw fail(413,'Request too large.');parts.push(part);}
    if(size)return Buffer.concat(parts);
  }
  const body=Object.getOwnPropertyDescriptor(req,'body')?.value;
  if(Buffer.isBuffer(body)||typeof body==='string'){
    const raw=Buffer.from(body);if(raw.length>1048576)throw fail(413,'Request too large.');return raw;
  }
  throw fail(400,'Raw request body is required.');
}
export async function jsonBody(req){
  let body;
  try{body=req.body;}catch{throw fail(400,'Invalid JSON.');}
  if(body===undefined||body===null)body=await rawBody(req);
  if(Buffer.isBuffer(body)||typeof body==='string'){
    try{body=JSON.parse(body.toString()||'{}');}catch{throw fail(400,'Invalid JSON.');}
  }
  if(!body||typeof body!=='object'||Array.isArray(body))throw fail(400,'Invalid JSON.');
  return body;
}
export function verifyWebhook(raw,header,secret,now=Math.floor(Date.now()/1000)){
  const fields=String(header||'').split(',').map(v=>v.split('='));const stamp=fields.find(v=>v[0]==='t')?.[1];
  if(!/^\d+$/.test(stamp||'')||Math.abs(now-Number(stamp))>300)throw fail(400,'Invalid webhook signature.');
  const expected=crypto.createHmac('sha256',secret).update(`${stamp}.`).update(raw).digest();
  const valid=fields.some(([k,v])=>k==='v1'&&/^[a-f0-9]{64}$/i.test(v||'')&&crypto.timingSafeEqual(Buffer.from(v,'hex'),expected));
  if(!valid)throw fail(400,'Invalid webhook signature.');return JSON.parse(raw.toString('utf8'));
}
export async function priceIds(plan){
  const spec=PLANS[plan];if(!spec)throw fail(422,'Choose a valid package.');
  const ids=[];
  for(const [env,amount,interval] of spec.prices){
    const id=clean(process.env[env]);if(!/^price_[a-zA-Z0-9]+$/.test(id))throw fail(503,`Missing ${env}.`);
    const p=await stripe(`prices/${id}`);
    if(!p.active||p.currency!=='usd'||p.unit_amount!==amount||p.livemode!==settings().live||p.billing_scheme!=='per_unit'||(interval?(p.recurring?.interval!==interval||p.recurring.interval_count!==1||p.recurring.usage_type!=='licensed'):Boolean(p.recurring)))throw fail(503,`${env} does not match the approved USD package price.`);
    ids.push(id);
  }return ids;
}
export function checkoutParams(order,ids){
  const spec=PLANS[order.plan],{url}=settings();
  const p={allow_promotion_codes:'true',mode:spec.mode,customer_email:order.email,client_reference_id:order.id,'metadata[cc_order_id]':order.id,
    success_url:`${url}/payment/?plan=${order.plan}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:`${url}/payment/?plan=${order.plan}&cancelled=1`,
    'payment_method_types[0]':'card','managed_payments[enabled]':'false'};
  ids.forEach((id,i)=>{p[`line_items[${i}][price]`]=id;p[`line_items[${i}][quantity]`]='1';});
  if(spec.mode==='subscription')p['subscription_data[metadata][cc_order_id]']=order.id;
  return p;
}
export function checkoutSettled(session){
  return session.status==='complete'&&(session.payment_status==='paid'||
    (session.payment_status==='no_payment_required'&&session.amount_total===0));
}
export function validatePaidSession(session,order){
  const spec=PLANS[order.plan];
  const discount=session.total_details?.amount_discount??0;
  const tax=session.total_details?.amount_tax??0;
  const shipping=session.total_details?.amount_shipping??0;
  // Use only the session retrieved from Stripe, never browser-supplied amounts.
  if(!spec||session.metadata?.cc_order_id!==order.id||session.client_reference_id!==order.id||
    (order.session_id&&session.id!==order.session_id)||session.livemode!==settings().live||
    session.currency!=='usd'||session.mode!==spec.mode||session.amount_subtotal!==spec.amount||
    !Number.isSafeInteger(discount)||discount<0||discount>spec.amount||tax!==0||shipping!==0||
    !Number.isSafeInteger(session.amount_total)||session.amount_total!==spec.amount-discount)
    throw fail(409,'Stripe payment does not match this order.');
  if(!checkoutSettled(session))throw fail(409,'Payment has not completed.');
  return true;
}
