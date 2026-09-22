import agencyStripeHandler from '../lib/agency-stripe.js';
import crypto from 'node:crypto';
import { PLANS, clean, fail, json, settings, db, rpc, stripe, owner, rawBody, jsonBody, verifyWebhook, priceIds, checkoutParams, checkoutSettled, validatePaidSession } from '../lib/stripe-billing.js';
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
  
  let firstName = 'there';
  if (order.account_id) {
    const accRows = await db(`accounts?id=eq.${encodeURIComponent(order.account_id)}&select=name,email&limit=1`).catch(()=>null);
    if (accRows?.[0]?.name) {
      firstName = clean(accRows[0].name).split(' ')[0] || 'there';
    }
  }
  if (firstName === 'there' && order.lead_snapshot?.name) {
    firstName = clean(order.lead_snapshot.name).split(' ')[0] || 'there';
  }

  let subject;
  let text;
  let html;

  if (order.plan === 'diagnostic') {
    subject = 'Establish your AOFI™ score, identify what matters most and build the plan to improve.';
    text = `Hi ${firstName},\n\n` +
      `Welcome to Creative Creatures.\n\n` +
      `You just signed up for a board-level diagnostic review powered by our Agency Intelligence Platform.\n\n` +
      `Together, we will:\n` +
      `- Establish your AOFI™ score and identify what will improve it.\n` +
      `- Analyze the issues and opportunities affecting performance and value.\n` +
      `- Set clear agency and department goals.\n` +
      `- Turn those goals into priorities your team can execute.\n\n` +
      `The diagnostic establishes your baseline. The real value comes when your leadership team and department heads use the platform each week to review performance, solve issues and stay accountable to the plan.\n\n` +
      `Use it weekly as designed, and we provide a 100% money-back guarantee to improve the performance and value of your agency.\n\n` +
      `Your next step is to complete the requested diagnostic information inside your account.\n\n` +
      `[Continue My Agency Diagnostic]\n${link}\n` +
      (setup ? `\nThis account setup link expires in 24 hours. If you need a new link later, use Forgot password on the sign-in page.\n` : '') +
      `\nLet’s build a stronger, more valuable and less owner-dependent agency.\n\n` +
      `Tony Lael\n` +
      `Founder, Creative Creatures`;

    html = `<div style="font-family:Inter,Arial,sans-serif;color:#111218;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">` +
      `<p style="font-size:16px;margin-bottom:16px;">Hi ${escapeHtml(firstName)},</p>` +
      `<p style="font-size:15px;margin-bottom:16px;">Welcome to Creative Creatures.</p>` +
      `<p style="font-size:15px;margin-bottom:16px;">You just signed up for a board-level diagnostic review powered by our Agency Intelligence Platform.</p>` +
      `<p style="font-size:15px;margin-bottom:12px;">Together, we will:</p>` +
      `<ul style="font-size:15px;margin:0 0 16px 0;padding-left:24px;line-height:1.8;color:#1f2937;">` +
      `<li>Establish your AOFI™ score and identify what will improve it.</li>` +
      `<li>Analyze the issues and opportunities affecting performance and value.</li>` +
      `<li>Set clear agency and department goals.</li>` +
      `<li>Turn those goals into priorities your team can execute.</li>` +
      `</ul>` +
      `<p style="font-size:15px;margin-bottom:16px;">The diagnostic establishes your baseline. The real value comes when your leadership team and department heads use the platform each week to review performance, solve issues and stay accountable to the plan.</p>` +
      `<p style="font-size:15px;margin-bottom:16px;">Use it weekly as designed, and we provide a 100% money-back guarantee to improve the performance and value of your agency.</p>` +
      `<p style="font-size:15px;margin-bottom:24px;">Your next step is to complete the requested diagnostic information inside your account.</p>` +
      `<div style="margin:28px 0;text-align:left;">` +
      `<a href="${escapeHtml(link)}" style="background-color:#2563eb;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">Continue My Agency Diagnostic</a>` +
      `</div>` +
      (setup ? `<p style="font-size:13px;color:#6b7280;margin-bottom:24px;">This account setup link is valid for 24 hours. If needed, you can request a new link using Forgot password on the sign-in page.</p>` : '') +
      `<p style="font-size:15px;margin-bottom:24px;">Let’s build a stronger, more valuable and less owner-dependent agency.</p>` +
      `<p style="font-size:15px;margin:0;"><strong>Tony Lael</strong><br><span style="color:#4b5563;">Founder, Creative Creatures</span></p>` +
      `</div>`;
  } else {
    const label=setup?'Choose your password':'Sign in to your workspace';
    subject=`Creative Creatures: ${PLANS[order.plan].label} payment confirmed`;
    text=`Hi ${firstName},\n\nYour ${PLANS[order.plan].label} payment is confirmed. ${label}: ${link}${setup?'\nThis link expires 24 hours after payment.':''}\nIf you need a new password link, use Forgot password on the sign-in page.`;
    html=`<div style="font-family:Inter,Arial,sans-serif;color:#111218;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">` +
      `<p style="font-size:16px;margin-bottom:16px;">Hi ${escapeHtml(firstName)},</p>` +
      `<p>Your ${escapeHtml(PLANS[order.plan].label)} payment is confirmed.</p>` +
      `<p><a href="${escapeHtml(link)}" style="background-color:#2563eb;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">${escapeHtml(label)}</a></p>` +
      (setup ? `<p style="font-size:13px;color:#6b7280;">This setup link is valid for 24 hours. If needed, request a new link using Forgot password on the sign-in page.</p>` : '') +
      `</div>`;
  }

  await sendEmail({to:order.email,subject,text,html});
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
      if(checkoutSettled(session))await fulfill(session);
    }
  }else if(['customer.subscription.updated','customer.subscription.deleted'].includes(event.type)){
    // Retrieve current state so out-of-order webhook payloads cannot restore canceled access.
    const sub=await stripe(`subscriptions/${encodeURIComponent(object.id)}`);
    if(sub.metadata?.cc_order_id){
      const order=await orderById(sub.metadata.cc_order_id);
      // A subscription event can arrive before checkout.session.completed.
      if(order.state!=='paid'&&order.session_id){
        const session=await stripe(`checkout/sessions/${encodeURIComponent(order.session_id)}`);
        if(checkoutSettled(session))await fulfill(session);
      }
      await rpc('cc_stripe_subscription',{p_subscription_id:sub.id,p_status:sub.status,p_event_at:event.created});
    }
  }
  return json(res,200,{received:true});
}
export default async function handler(req,res){
  if(req.query?.agency_stripe==='1')return agencyStripeHandler(req,res);
  try{
    const action=clean(req.query?.action);
    if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
    if(!['checkout','status','webhook'].includes(action))return json(res,410,{error:'Simulated payment activation has been disabled. Use Stripe Checkout.'});
    const cfg=settings();if(!accountSessionSecret())throw fail(503,'Account sessions are not configured.');
    if(action==='webhook')return await webhook(req,res,await rawBody(req));
    if(req.headers.origin!==cfg.url)throw fail(403,'Request origin is not allowed.');
    const b=await jsonBody(req);
    if(action==='checkout'){
      const plan=clean(b.plan);if(!Object.hasOwn(PLANS,plan))throw fail(422,'Choose a valid package.');
      const session=owner(req);
      // Members cannot start owner checkout, even when supplying a different email.
      const anySession=verifySession(parseCookies(req).cc_account_session,accountSessionSecret());
      if(anySession?.memberId)throw Object.assign(fail(403,'This browser is signed in as a team member. Sign out to purchase a package with your assessment email.'),{code:'MEMBER_CHECKOUT_SESSION'});
      let email=clean(b.email).toLowerCase();
      let accountId=null;
      if(session){
        const accs = await db(`accounts?id=eq.${encodeURIComponent(session.accountId)}&select=id,email&limit=1`).catch(()=>null);
        if(accs?.[0]?.id){
          accountId = accs[0].id;
          email = accs[0].email.toLowerCase();
        }
      }
      if(!/^\S+@\S+\.\S+$/.test(email))throw fail(422,'Enter your assessment email.');
      const ids=await priceIds(plan);
      const order=await rpc('cc_stripe_begin',{p_email:email,p_plan:plan,p_account_id:accountId});
      if(order.error)throw fail(409,order.error);
      let checkout;
      if(order.session_id){
        checkout=await stripe(`checkout/sessions/${encodeURIComponent(order.session_id)}`);
        if(checkout.status==='complete')throw fail(409,'This checkout is completed. Return to the payment confirmation or contact support.');
        // Retire older open sessions that were created without the coupon field.
        if(checkout.status==='open'&&!checkout.allow_promotion_codes){
          await stripe(`checkout/sessions/${encodeURIComponent(checkout.id)}/expire`,{},`cc-expire-${checkout.id}`);
          checkout=null;
        }else if(checkout.status==='expired')checkout=null;
        else if(checkout.status!=='open')throw fail(409,'This checkout is unavailable. Contact support.');
      }
      if(!checkout){
        checkout=await stripe('checkout/sessions',checkoutParams(order,ids),`cc-checkout-coupons-v4-${order.id}-${order.session_id||'new'}`);
        await db(`cc_stripe_orders?id=eq.${order.id}`,'PATCH',{
          session_id:checkout.id,expires_at:new Date(checkout.expires_at*1000).toISOString()
        });
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
    if(!checkoutSettled(checkout))return json(res,202,{paid:false,state:checkout.status});
    // Webhook owns fulfillment; the return page may safely run the same idempotent path.
    let fulfilled;try{fulfilled=await fulfill(checkout);}catch(error){
      const saved=await orderById(order.id);if(saved.state!=='paid')throw error;fulfilled=saved;
    }
    return json(res,200,{paid:true,plan:fulfilled.plan,emailSent:Boolean(fulfilled.notification_sent_at),loginUrl:`${cfg.url}/login/`});
  }catch(error){
    console.error('Stripe billing error',{status:error.status||500,message:error.message});
    return json(res,error.status||500,{code:error.code==='MEMBER_CHECKOUT_SESSION'?error.code:undefined,error:error.status?error.message:'Payment processing is temporarily unavailable. Your payment will be retried automatically; do not pay again.'});
  }
}
