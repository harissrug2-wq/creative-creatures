import crypto from 'node:crypto';
import { sendEmail, escapeHtml } from '../lib/email-service.js';
import { accountSessionSecret, clearSessionCookie, hashPassword, parseCookies, setSessionCookie, signSession, verifyPassword, verifySession } from '../lib/session-utils.js';
const json=(res,status,payload)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(payload))};
const clean=v=>String(v??'').trim();const lower=v=>clean(v).toLowerCase();
function cfg(){const url=clean(process.env.SUPABASE_URL).replace(/\/+$/,'');const key=clean(process.env.SUPABASE_SERVICE_ROLE_KEY);return url&&key?{url,key}:null}
async function db(c,path,options={}){const r=await fetch(`${c.url}/rest/v1/${path}`,{...options,headers:{apikey:c.key,'Content-Type':'application/json',...(options.headers||{})}});const t=await r.text();let p=null;try{p=t?JSON.parse(t):null}catch{p=t}if(!r.ok){const e=new Error(p?.message||p?.hint||'Database request failed.');e.status=r.status;throw e}return p}
const SELECT='id,name,email,agency_url,agency_name,journey,source,archetype_result,report_data,diagnostic_state,password_hash,password_reset_token_hash,password_reset_expires_at,created_at,updated_at';
function pub(a){return a?{id:a.id,name:a.name,email:a.email,agency_url:a.agency_url,agency_name:a.agency_name,journey:a.journey,source:a.source,archetype_result:a.archetype_result||{},report_data:a.report_data||{},diagnostic_state:a.diagnostic_state||{},created_at:a.created_at,updated_at:a.updated_at}:null}
async function findById(c,id){const rows=await db(c,`accounts?select=${SELECT}&id=eq.${encodeURIComponent(id)}&limit=1`);return Array.isArray(rows)?rows[0]:null}
const tokenHash=token=>crypto.createHash('sha256').update(String(token)).digest('hex');
function requestOrigin(req){const proto=clean(req.headers?.['x-forwarded-proto'])||'https';const host=clean(req.headers?.['x-forwarded-host']||req.headers?.host)||'app.creativecreatures.org';return `${proto}://${host}`}
async function beginPasswordReset(c,req,email){
  const rows=await db(c,`accounts?select=id,name,email,email_normalized,password_hash&email_normalized=eq.${encodeURIComponent(email)}&limit=1`);const account=Array.isArray(rows)?rows[0]:null;
  // Never reveal whether an email exists.
  if(!account||!account.password_hash)return;
  const token=crypto.randomBytes(32).toString('hex');const hash=tokenHash(token);const expiresAt=new Date(Date.now()+60*60*1000).toISOString();
  await db(c,`accounts?id=eq.${encodeURIComponent(account.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({password_reset_token_hash:hash,password_reset_expires_at:expiresAt,updated_at:new Date().toISOString()})});
  const origin=requestOrigin(req);const link=`${origin}/login/?reset=${encodeURIComponent(token)}&email=${encodeURIComponent(account.email||email)}`;const firstName=clean(account.name).split(/\s+/)[0]||'there';
  await sendEmail({
    to:account.email||email,
    subject:'Reset your Creative Creatures password',
    text:`Hi ${firstName},\n\nUse this secure link to reset your Creative Creatures password. The link expires in 60 minutes:\n${link}\n\nIf you did not request this reset, you can ignore this email.`,
    html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#171820"><h2 style="margin-bottom:12px">Reset your password</h2><p>Hi ${escapeHtml(firstName)},</p><p>Use the button below to choose a new password for your Creative Creatures account.</p><p style="margin:28px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2929ed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9px;font-weight:700">Reset password</a></p><p style="font-size:13px;color:#667085">This link expires in 60 minutes. If you did not request a reset, you can ignore this email.</p></div>`
  });
}
async function completePasswordReset(c,token,password){
  if(password.length<10)throw Object.assign(new Error('Use at least 10 characters for your new password.'),{status:422});
  const hash=tokenHash(token);const now=new Date().toISOString();
  const rows=await db(c,`accounts?select=${SELECT}&password_reset_token_hash=eq.${encodeURIComponent(hash)}&password_reset_expires_at=gt.${encodeURIComponent(now)}&limit=1`);const account=Array.isArray(rows)?rows[0]:null;
  if(!account)throw Object.assign(new Error('This password reset link is invalid or has expired.'),{status:400});
  const updated=await db(c,`accounts?id=eq.${encodeURIComponent(account.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({password_hash:hashPassword(password),password_set_at:now,password_reset_token_hash:null,password_reset_expires_at:null,updated_at:now})});
  return Array.isArray(updated)&&updated[0]?updated[0]:account;
}
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return json(res,204,{});
  const c=cfg();const secret=accountSessionSecret();if(!c||!secret)return json(res,503,{error:'Account authentication is not configured.'});
  try{
    if(req.method==='DELETE'){clearSessionCookie(res,'cc_account_session');return json(res,200,{success:true})}
    if(req.method==='GET'){
      const session=verifySession(parseCookies(req).cc_account_session,secret);
      if(!session?.accountId)return json(res,401,{authenticated:false});
      const account=await findById(c,session.accountId);if(!account)return json(res,401,{authenticated:false});
      return json(res,200,{authenticated:true,account:pub(account)});
    }
    if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
    const b=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});const action=clean(b.action)||'login';
    if(action==='forgot_password'){
      const email=lower(b.email);if(!email||!/^\S+@\S+\.\S+$/.test(email))return json(res,422,{error:'Enter a valid email address.'});
      try{await beginPasswordReset(c,req,email)}catch(error){console.error('password reset email error',error)}
      return json(res,200,{success:true,message:'If an account exists for that email, a password reset link has been sent.'});
    }
    if(action==='reset_password'){
      const token=clean(b.token),password=clean(b.password);if(!token||!password)return json(res,422,{error:'Reset token and new password are required.'});
      const account=await completePasswordReset(c,token,password);const sessionToken=signSession({role:'account',accountId:account.id,email:account.email},secret,30*24*60*60);setSessionCookie(res,'cc_account_session',sessionToken,30*24*60*60);
      return json(res,200,{success:true,authenticated:true,account:pub(account)});
    }
    const email=lower(b.email),password=clean(b.password);
    if(!email||!password)return json(res,422,{error:'Email and password are required.'});
    const rows=await db(c,`accounts?select=${SELECT}&email_normalized=eq.${encodeURIComponent(email)}&limit=1`);const account=Array.isArray(rows)?rows[0]:null;
    if(!account||!account.password_hash||!verifyPassword(password,account.password_hash))return json(res,401,{error:'Invalid email or password.'});
    const token=signSession({role:'account',accountId:account.id,email:account.email},secret,30*24*60*60);setSessionCookie(res,'cc_account_session',token,30*24*60*60);
    return json(res,200,{authenticated:true,account:pub(account)});
  }catch(e){console.error('account auth error',e);return json(res,e.status||500,{error:e.message||'Unable to process this request right now.'})}
}
