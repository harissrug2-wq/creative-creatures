import { escapeHtml, sendEmail, validEmail } from './email-service.js';

const json=(res,status,payload)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(payload))};
const clean=value=>String(value??'').trim();
function supabaseConfig(){const url=clean(process.env.SUPABASE_URL).replace(/\/+$/,'');const serviceRole=clean(process.env.SUPABASE_SERVICE_ROLE_KEY);return url&&serviceRole?{url,serviceRole}:null}

async function request(config,path,options={}){
  const response=await fetch(`${config.url}/rest/v1/${path}`,{...options,headers:{apikey:config.serviceRole,'Content-Type':'application/json',...(options.headers||{})}});
  const text=await response.text();let payload=null;try{payload=text?JSON.parse(text):null}catch{payload=text}
  if(!response.ok){const error=new Error(payload?.message||payload?.hint||'Database request failed.');error.status=response.status;throw error}
  return payload;
}

async function verifyRecipient({accountId,email}){
  const config=supabaseConfig();if(!config)return false;
  const params=new URLSearchParams({select:'id,name,email,agency_name,diagnostic_state',limit:'1'});
  if(accountId&&!String(accountId).startsWith('local-'))params.set('id',`eq.${accountId}`);else params.set('email_normalized',`eq.${String(email).toLowerCase()}`);
  const rows=await request(config,`accounts?${params.toString()}`);
  const row=Array.isArray(rows)?rows[0]:null;
  if(!row||String(row.email||'').trim().toLowerCase()!==String(email).trim().toLowerCase())return false;
  return {config,row};
}

async function markPaymentComplete(config,row,completedAt){
  const current=row?.diagnostic_state&&typeof row.diagnostic_state==='object'?row.diagnostic_state:{};
  const diagnosticState={...current,paymentComplete:true,paymentCompletedAt:completedAt,updatedAt:new Date().toISOString()};
  const params=new URLSearchParams({id:`eq.${row.id}`});
  await request(config,`accounts?${params.toString()}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({diagnostic_state:diagnosticState,updated_at:new Date().toISOString()})});
  return diagnosticState;
}

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');if(req.method==='OPTIONS')return json(res,204,{});if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const to=clean(body.to).toLowerCase();if(!validEmail(to))return json(res,422,{error:'A valid account email is required.'});
    const verified=await verifyRecipient({accountId:clean(body.accountId),email:to});
    if(!verified)return json(res,403,{error:'The confirmation recipient could not be verified.',code:'ACCOUNT_EMAIL_MISMATCH'});
    const {config,row:account}=verified;
    const displayName=clean(account.name)||'Agency Owner';const agencyName=clean(account.agency_name)||'your agency';const completedAt=clean(body.completedAt)||new Date().toISOString();

    // Payment activation is persisted before email delivery. This makes the
    // admin Owner Archetype -> Diagnostics transition authoritative even if
    // email delivery is temporarily unavailable.
    await markPaymentComplete(config,account,completedAt);

    const result=await sendEmail({to,subject:'Creative Creatures - Agency Diagnostic confirmation',text:`Hi ${displayName},\n\nYour Agency Diagnostic activation for ${agencyName} has been recorded.\n\nThis environment currently uses a simulated checkout, so no real card charge was processed.\n\nContinue into your Creative Creatures workspace to complete integrations and your diagnostic.\n\nRecorded at: ${completedAt}`,html:`<div style="font-family:Inter,Arial,sans-serif;color:#111218;line-height:1.6;max-width:620px;margin:auto"><p style="font-size:13px;color:#6f7480;text-transform:uppercase;letter-spacing:.08em">Creative Creatures</p><h1 style="font-size:28px;line-height:1.2">Agency Diagnostic confirmation</h1><p>Hi ${escapeHtml(displayName)},</p><p>Your Agency Diagnostic activation for <strong>${escapeHtml(agencyName)}</strong> has been recorded.</p><div style="margin:22px 0;padding:16px 18px;background:#f7f7f5;border:1px solid #e5e5e2;border-radius:12px"><strong>Demo checkout notice</strong><br>This environment currently uses a simulated checkout, so no real card charge was processed.</div><p>Continue into your Creative Creatures workspace to complete integrations and your diagnostic.</p><p style="font-size:12px;color:#777">Recorded at ${escapeHtml(completedAt)}</p></div>`});
    return json(res,200,{sent:true,activated:true,id:result.id});
  }catch(error){
    console.error('payment confirmation email error',{code:error?.code,status:error?.status,message:error?.message});
    const status=error?.code==='EMAIL_NOT_CONFIGURED'?503:502;
    return json(res,status,{error:error?.code==='EMAIL_NOT_CONFIGURED'?'Email delivery is not configured.':'The confirmation email could not be sent.',code:error?.code||'PAYMENT_EMAIL_ERROR'});
  }
}
