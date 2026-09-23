import { sendEmail, escapeHtml } from '../lib/email-service.js';

const clean=value=>String(value??'').trim();
const lower=value=>clean(value).toLowerCase();
const allowedOrigins=new Set([
  'https://aofreedomindex.com',
  'https://www.aofreedomindex.com',
  'https://app.creativecreatures.org'
]);

function json(res,status,payload){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(payload));
}
function config(){
  const url=clean(process.env.SUPABASE_URL).replace(/\/+$/,'');
  const key=clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return url&&key?{url,key}:null;
}
async function db(c,path,options={}){
  const response=await fetch(`${c.url}/rest/v1/${path}`,{
    ...options,
    headers:{apikey:c.key,'Content-Type':'application/json',...(options.headers||{})}
  });
  const text=await response.text();
  let payload=null;try{payload=text?JSON.parse(text):null}catch{payload=text}
  if(!response.ok){
    const error=new Error(payload?.message||payload?.hint||'Request storage failed.');
    error.status=response.status;throw error;
  }
  return payload;
}
function bodyOf(req){
  if(req.body&&typeof req.body==='object')return req.body;
  const raw=clean(req.body);
  if(!raw)return{};
  try{return JSON.parse(raw)}catch{}
  return Object.fromEntries(new URLSearchParams(raw));
}
async function sendSlackNotice(record){
  const url=clean(process.env.AOFI_REQUEST_SLACK_WEBHOOK_URL);
  if(!url)return false;
  const response=await fetch(url,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      text:`New AOFI™ score request\nName: ${record.name}\nEmail: ${record.email}\nAgency: ${record.agency_name||record.agency_url||'Not supplied'}`
    })
  });
  if(!response.ok)throw new Error('Slack notification failed.');
  return true;
}
async function sendRequesterEmail(record,redirectUrl){
  const firstName=record.name.split(/\s+/)[0]||'there';
  await sendEmail({
    to:record.email,
    subject:'Get your free Agency Owner Freedom Index™ score',
    text:`Hi ${firstName},\n\nYour free AOFI™ score request is ready.\n\nStart here: ${redirectUrl}\n\nFirst we will locate or create your Agency Owner Identity Report, then you can complete the Agency Diagnostic for your free AOFI™ score.\n\nCreative Creatures`,
    html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#171820"><h2>Get your free AOFI™ score</h2><p>Hi ${escapeHtml(firstName)},</p><p>Your free Agency Owner Freedom Index™ score request is ready.</p><p>First we will locate or create your Agency Owner Identity Report. Then you can complete the Agency Diagnostic and generate your AOFI™ Scorecard.</p><p style="margin:26px 0"><a href="${escapeHtml(redirectUrl)}" style="display:inline-block;background:#3033eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9px;font-weight:700">Get My Free AOFI™ Score →</a></p><p style="font-size:13px;color:#667085">No card is required for the free AOFI™ score.</p></div>`
  });
}

export default async function handler(req,res){
  const origin=clean(req.headers?.origin);
  if(origin&&allowedOrigins.has(origin))res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return allowedOrigins.has(origin)?json(res,204,{}):json(res,403,{error:'Origin not allowed.'});
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
  if(origin&&!allowedOrigins.has(origin))return json(res,403,{error:'Origin not allowed.'});

  const c=config();
  if(!c)return json(res,503,{error:'AOFI™ request storage is not configured.'});
  try{
    const b=bodyOf(req);
    const name=clean(b.name||`${b.firstName||b.first_name||''} ${b.lastName||b.last_name||''}`);
    const email=lower(b.email);
    const agencyName=clean(b.agencyName||b.agency_name||b.company||b.companyName);
    const agencyUrl=clean(b.agencyUrl||b.agency_url||b.website);
    const phone=clean(b.phone||b.phoneNumber);
    if(!name||!/^\S+@\S+\.\S+$/.test(email))return json(res,422,{error:'Name and a valid email address are required.'});

    const now=new Date().toISOString();
    const record={
      name,email,email_normalized:email,agency_name:agencyName,agency_url:agencyUrl,phone,
      source:clean(b.source)||'aofreedomindex.com',status:'requested',
      metadata:{utm_source:clean(b.utm_source),utm_medium:clean(b.utm_medium),utm_campaign:clean(b.utm_campaign)},
      updated_at:now
    };
    const existing=await db(c,`aofi_score_requests?select=id&email_normalized=eq.${encodeURIComponent(email)}&limit=1`);
    let rows;
    if(Array.isArray(existing)&&existing[0]){
      rows=await db(c,`aofi_score_requests?id=eq.${encodeURIComponent(existing[0].id)}&select=*`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(record)});
    }else{
      rows=await db(c,'aofi_score_requests?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({...record,created_at:now})});
    }
    const saved=Array.isArray(rows)?rows[0]:rows;
    const redirectUrl=`https://app.creativecreatures.org/signup/lookup/?destination=aofi_free&email=${encodeURIComponent(email)}`;

    const notifications=await Promise.allSettled([sendSlackNotice(record),sendRequesterEmail(record,redirectUrl)]);
    const slackSent=notifications[0].status==='fulfilled'&&notifications[0].value===true;
    const emailSent=notifications[1].status==='fulfilled';
    if(notifications[0].status==='rejected')console.error('AOFI request Slack notification failed',notifications[0].reason?.message);
    if(notifications[1].status==='rejected')console.error('AOFI request email failed',notifications[1].reason?.message);

    return json(res,200,{success:true,requestId:saved?.id||null,emailSent,slackSent,redirectUrl});
  }catch(error){
    console.error('AOFI free request error',error);
    return json(res,[400,409,422].includes(error.status)?error.status:500,{error:'Your free AOFI™ score request could not be saved.'});
  }
}
