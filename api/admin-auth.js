import { adminSessionSecret, clearSessionCookie, parseCookies, setSessionCookie, signSession, verifySession } from './session-utils.js';
import crypto from 'node:crypto';
const json=(res,status,payload)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(payload))};
const clean=v=>String(v??'').trim();
const safe=(a,b)=>{const x=Buffer.from(String(a));const y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)};
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return json(res,204,{});
  const username=clean(process.env.ADMIN_USERNAME);
  const password=clean(process.env.ADMIN_PASSWORD);
  const secret=adminSessionSecret();
  if(!username||!password||!secret)return json(res,503,{error:'Admin authentication is not configured.',code:'ADMIN_AUTH_NOT_CONFIGURED'});
  if(req.method==='GET'){
    const session=verifySession(parseCookies(req).cc_admin_session,secret);
    if(!session||session.role!=='admin')return json(res,401,{authenticated:false});
    return json(res,200,{authenticated:true,username:session.username});
  }
  if(req.method==='DELETE'){
    clearSessionCookie(res,'cc_admin_session');
    return json(res,200,{success:true});
  }
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  if(!safe(clean(body.username).toLowerCase(),username.toLowerCase())||!safe(clean(body.password),password)){
    return json(res,401,{error:'Invalid username or password.'});
  }
  const token=signSession({role:'admin',username},secret,8*60*60);
  setSessionCookie(res,'cc_admin_session',token,8*60*60);
  return json(res,200,{authenticated:true,username});
}
