import agencyStripeHandler from '../lib/agency-stripe.js';
import crypto from 'node:crypto';
import { PLANS, clean, fail, json, settings, db, rpc, stripe, owner, rawBody, jsonBody, verifyWebhook, priceIds, checkoutParams, checkoutSettled, validatePaidSession } from '../lib/stripe-billing.js';
import { hashPassword, signSession, verifySession, parseCookies, setSessionCookie, accountSessionSecret } from '../lib/session-utils.js';
import { sendEmail, escapeHtml } from '../lib/email-service.js';
export const config={api:{bodyParser:false}};
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v||'');
const tokenFor=id=>crypto.createHmac('sha256',accountSessionSecret()).update(`stripe-onboarding:${id}`).digest('hex');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const allDepartments=['leadership','marketing','sales','billing','onboarding','service-delivery','client-success','talent-acquisition','finance','communication','systems','sops'];
function normalizeOwnershipDraft(value,email){
  if(!Array.isArray(value)||!value.length)return null;
  const rows=value.slice(0,10).map((row,index)=>({
    name:clean(row?.name),
    email:clean(row?.email).toLowerCase(),
    title:clean(row?.title)||(index===0?'Owner':'Partner'),
    ownershipPercent:Number(row?.ownershipPercent),
    isPrimary:index===0||row?.isPrimary===true
  }));
  const total=rows.reduce((sum,row)=>sum+(Number.isFinite(row.ownershipPercent)?row.ownershipPercent:0),0);
  if(rows.some(row=>!row.name||!Number.isFinite(row.ownershipPercent)||row.ownershipPercent<0||row.ownershipPercent>100))throw fail(422,'Every owner needs a name and ownership percentage between 0 and 100.');
  if(Math.abs(total-100)>0.01)throw fail(422,`Ownership must total 100%. Current total is ${total.toFixed(2)}%.`);
  const emails=rows.map(row=>row.email).filter(Boolean);
  if(new Set(emails).size!==emails.length)throw fail(422,'Each owner email must be unique.');
  if(rows[0].email&&email&&rows[0].email!==email)rows[0].email=email;
  return rows;
}
async function applySignupOwnership(result,order){
  const owners=Array.isArray(order.ownership_draft)?order.ownership_draft:null;
  const accountId=result?.account_id||order.account_id;
  if(!accountId||!owners?.length)return;
  const accountRows=await db(`accounts?id=eq.${encodeURIComponent(accountId)}&select=id,name,email,agency_name,archetype_result&limit=1`).catch(()=>null);
  const account=accountRows?.[0];if(!account)return;
  const existing=await db(`agency_owners?select=id&account_id=eq.${encodeURIComponent(accountId)}&limit=1`).catch(()=>null);
  if(existing?.length)return;
  const today=new Date().toISOString().slice(0,10);
  const savedOwners=[];
  for(let index=0;index<owners.length;index++){
    const row=owners[index];
    let memberId=null;
    if(index>0&&row.email){
      const otherPrimary=await db(`accounts?select=id&email_normalized=eq.${encodeURIComponent(row.email)}&limit=1`).catch(()=>null);
      if(otherPrimary?.[0]&&otherPrimary[0].id!==accountId)throw fail(409,`${row.email} already owns another agency account.`);
      const existingMember=await db(`account_members?select=id,account_id&email_normalized=eq.${encodeURIComponent(row.email)}&limit=1`).catch(()=>null);
      if(existingMember?.[0]&&existingMember[0].account_id!==accountId)throw fail(409,`${row.email} already belongs to another agency workspace.`);
      if(existingMember?.[0])memberId=existingMember[0].id;
      else{
        const temporaryPassword=`CC-${crypto.randomBytes(8).toString('base64url')}!`;
        const created=await db('account_members?select=id','POST',{account_id:accountId,name:row.name,email:row.email,email_normalized:row.email,password_hash:hashPassword(temporaryPassword),role:'partner',departments:allDepartments,status:'active'});
        memberId=created?.[0]?.id||null;
        try{
          const login=`${settings().url}/login/`;
          await sendEmail({
            to:row.email,
            subject:`You've been added as a partner of ${account.agency_name||'your agency'}`,
            text:`Hi ${row.name},\n\nYou've been added as an agency partner in Creative Creatures.\nSign in: ${login}\nTemporary password: ${temporaryPassword}\n`,
            html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#171820"><h2>You've been added as an agency partner</h2><p>Hi ${escapeHtml(row.name)},</p><p>You've been added as a partner of <strong>${escapeHtml(account.agency_name||'your agency')}</strong>.</p><p><strong>Sign in:</strong> <a href="${escapeHtml(login)}">${escapeHtml(login)}</a><br><strong>Temporary password:</strong> ${escapeHtml(temporaryPassword)}</p></div>`
          });
        }catch(error){console.error('signup partner invite email failed',error)}
      }
    }
    const inserted=await db('agency_owners?select=*','POST',{account_id:accountId,member_id:memberId,name:row.name,email:row.email||null,email_normalized:row.email||null,title:row.title,ownership_percent:row.ownershipPercent,is_primary:index===0,status:'active',effective_from:today,owner_identity_status:index===0&&Object.keys(account.archetype_result||{}).length?'complete':'not_started'});
    if(inserted?.[0])savedOwners.push(inserted[0]);
  }
  const structure=savedOwners.map(row=>({id:row.id,name:row.name,email:row.email||'',title:row.title||'',ownershipPercent:Number(row.ownership_percent||0),isPrimary:row.is_primary===true,ownerIdentityStatus:row.owner_identity_status||'not_started'}));
  const snapshots=await db('agency_ownership_snapshots?select=*','POST',{account_id:accountId,reason:'signup_ownership',structure,created_by:account.name||account.email||'signup'});
  const snapshot=snapshots?.[0]||null;
  const currentRows=await db(`accounts?id=eq.${encodeURIComponent(accountId)}&select=diagnostic_state&limit=1`).catch(()=>null);
  const current=currentRows?.[0]?.diagnostic_state&&typeof currentRows[0].diagnostic_state==='object'?currentRows[0].diagnostic_state:{};
  await db(`accounts?id=eq.${encodeURIComponent(accountId)}`,'PATCH',{diagnostic_state:{...current,ownershipConfirmedAt:new Date().toISOString(),ownershipSnapshotId:snapshot?.id||null,ownerCount:structure.length}});
}

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
  await applySignupOwnership(result,order);
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
      const ownership=accountId?null:normalizeOwnershipDraft(b.ownership,email);
      if(ownership)await db(`cc_stripe_orders?id=eq.${order.id}`,'PATCH',{ownership_draft:ownership});
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
