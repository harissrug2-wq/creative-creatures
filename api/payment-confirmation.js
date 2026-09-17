import crypto from 'node:crypto';
import { PLANS, clean, fail, json, settings, db, rpc, stripe, owner, rawBody, verifyWebhook, priceIds, checkoutParams, validatePaidSession } from '../lib/stripe-billing.js';
import { hashPassword, signSession, verifySession, parseCookies, setSessionCookie, accountSessionSecret } from '../lib/session-utils.js';
import { sendEmail, escapeHtml } from '../lib/email-service.js';
export const config={api:{bodyParser:false}};
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v||'');
const tokenFor=id=>crypto.createHmac('sha256',accountSessionSecret()).update(`stripe-onboarding:${id}`).digest('hex');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
async function orderById(id){if(!uuid(id))throw fail(400,'Invalid order.');const rows=await db(`cc_stripe_orders?id=eq.${id}&limit=1`);if(!rows?.[0])throw fail(404,'Order not found.');return rows[0];}
async function notify(order){
  if(order.notification_sent_at)return;
  const {url}=settings();const setup=order.new_account&&new Date(order.reset_expires_at).getTime()>Date.now();
  const link=setup?`${url}/login/?reset=${tokenFor(order.id)}&email=${encodeURIComponent(order.email)}`:`${url}/login/`;
  const label=setup?'Choose your password':'Sign in to your workspace';
  const text=`Your ${PLANS[order.plan].label} payment is confirmed. ${label}: ${link}${setup?'\nThis link expires 24 hours after payment.':''}\nIf you need a new password link, use Forgot password on the sign-in page.`;
  await sendEmail({to:order.email,subject:'Creative Creatures: payment confirmed',text,html:`<p>Your ${escapeHtml(PLANS[order.plan].label)} payment is confirmed.</p><p><a href="${escapeHtml(link)}">${label}</a></p><p>If needed, request a new link using Forgot password on the sign-in page.</p>`});
  order.notification_sent_at=new Date().toISOString();
  await db(`cc_stripe_orders?id=eq.${order.id}`,'PATCH',{notification_sent_at:order.notification_sent_at});
}
async function fulfill(session){
  const order=await orderById(session.metadata?.cc_order_id);
  validatePaidSession(session,order);
  const subId=typeof session.subscription==='string'?session.subscription:session.subscription?.id;
  const sub=subId?await stripe(`subscriptions/${encodeURIComponent(subId)}`):null;
  const result=await rpc('cc_stripe_fulfill',{p_order_id:order.id,p_session_id:session.id,p_customer_id:typeof session.customer==='string'?session.customer:session.customer?.id||null,p_subscription_id:subId||'',p_subscription_status:sub?.status||null,p_password_hash:hashPassword(crypto.randomBytes(32).toString('hex')),p_reset_hash:hash(tokenFor(order.id))});
  await notify(result);
  return result;
}
async function webhook(req,res,raw){
  const event=verifyWebhook(raw,req.headers['stripe-signature'],settings().webhook);
  if(event.livemode!==settings().live)throw fail(400,'Incorrect Stripe environment.');
  const object=event.data?.object;
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
    if(object?.metadata?.cc_order_id){
      const session=await stripe(`checkout/sessions/${encodeURIComponent(object.id)}`);
      if(session.payment_status==='paid')await fulfill(session);
    }
  }else if(['customer.subscription.updated','customer.subscription.deleted'].includes(event.type)){
    // Retrieve current state so out-of-order webhook payloads cannot restore canceled access.
    const sub=await stripe(`subscriptions/${encodeURIComponent(object.id)}`);
    if(sub.metadata?.cc_order_id){
      const order=await orderById(sub.metadata.cc_order_id);
      // A subscription event can arrive before checkout.session.completed.
      if(order.state!=='paid'&&order.session_id){
        const session=await stripe(`checkout/sessions/${encodeURIComponent(order.session_id)}`);
        if(session.payment_status==='paid')await fulfill(session);
      }
      await rpc('cc_stripe_subscription',{p_subscription_id:sub.id,p_status:sub.status,p_event_at:event.created});
    }
  }
  return json(res,200,{received:true});
}
export default async function handler(req,res){
  try{
    const action=clean(req.query?.action);
    if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
    if(!['checkout','status','webhook'].includes(action))return json(res,410,{error:'Simulated payment activation has been disabled. Use Stripe Checkout.'});
    const cfg=settings();if(!accountSessionSecret())throw fail(503,'Account sessions are not configured.');
    const raw=await rawBody(req);
    if(action==='webhook')return await webhook(req,res,raw);
    if(req.headers.origin!==cfg.url)throw fail(403,'Request origin is not allowed.');
    let b;try{b=JSON.parse(raw.toString()||'{}');}catch{throw fail(400,'Invalid JSON.');}
    if(action==='checkout'){
      const plan=clean(b.plan);if(!Object.hasOwn(PLANS,plan))throw fail(422,'Choose a valid package.');
      const session=owner(req);
      // Members cannot start owner checkout, even when supplying a different email.
      const anySession=verifySession(parseCookies(req).cc_account_session,accountSessionSecret());
      if(anySession?.memberId)throw fail(403,'Only the agency owner can buy a package.');
      let email=clean(b.email).toLowerCase();
      if(session){const a=(await db(`accounts?id=eq.${encodeURIComponent(session.accountId)}&select=email&limit=1`))?.[0];if(!a)throw fail(401,'Sign in again.');email=a.email.toLowerCase();}
      if(!/^\S+@\S+\.\S+$/.test(email))throw fail(422,'Enter your assessment email.');
      const ids=await priceIds(plan);
      const order=await rpc('cc_stripe_begin',{p_email:email,p_plan:plan,p_account_id:session?.accountId||null});
      if(order.error)throw fail(409,order.error);
      let checkout;
      if(order.session_id){checkout=await stripe(`checkout/sessions/${encodeURIComponent(order.session_id)}`);if(checkout.status!=='open')throw fail(409,'This checkout is completed or expired. Return to the payment confirmation or contact support.');}
      else{
        checkout=await stripe('checkout/sessions',checkoutParams(order,ids),`cc-checkout-${order.id}`);
        await db(`cc_stripe_orders?id=eq.${order.id}`,'PATCH',{session_id:checkout.id});
      }
      const cookie=signSession({role:'checkout',orderId:order.id},accountSessionSecret(),86400);
      setSessionCookie(res,'cc_checkout_session',cookie,86400);
      return json(res,200,{url:checkout.url});
    }
    const binding=verifySession(parseCookies(req).cc_checkout_session,accountSessionSecret());
    if(binding?.role!=='checkout')throw fail(401,'Open this confirmation in the browser used for checkout. You can also sign in using the email sent after payment.');
    const order=await orderById(binding.orderId);
    if(!order.session_id||b.sessionId!==order.session_id)throw fail(403,'This checkout belongs to a different session.');
    const checkout=await stripe(`checkout/sessions/${encodeURIComponent(order.session_id)}`);
    if(checkout.payment_status!=='paid')return json(res,202,{paid:false,state:checkout.status});
    // Webhook owns fulfillment; the return page may safely run the same idempotent path.
    let fulfilled;try{fulfilled=await fulfill(checkout);}catch(error){
      const saved=await orderById(order.id);if(saved.state!=='paid')throw error;fulfilled=saved;
    }
    return json(res,200,{paid:true,plan:fulfilled.plan,emailSent:Boolean(fulfilled.notification_sent_at),loginUrl:`${cfg.url}/login/`});
  }catch(error){
    console.error('Stripe billing error',{status:error.status||500,message:error.message});
    return json(res,error.status||500,{error:error.status?error.message:'Payment processing is temporarily unavailable. Your payment will be retried automatically; do not pay again.'});
  }
}
