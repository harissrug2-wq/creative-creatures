import crypto from 'node:crypto';
import { accountSessionSecret, signSession, verifySession } from './session-utils.js';

const clean=value=>String(value??'').trim();
const AUTH_URL='https://marketplace.gohighlevel.com/oauth/chooselocation';
const TOKEN_URL='https://services.leadconnectorhq.com/oauth/token';
const LOCATION_TOKEN_URL='https://services.leadconnectorhq.com/oauth/location-token';
const API_URL='https://services.leadconnectorhq.com';
const SCOPES=['locations.readonly','contacts.readonly','contacts.write','opportunities.readonly','opportunities.write','pipelines.readonly','users.readonly'];
export const GHL_WEBHOOK_PUBLIC_KEY=`-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

export function ghlConfig(){
  const clientId=clean(process.env.GHL_CLIENT_ID);
  const clientSecret=clean(process.env.GHL_CLIENT_SECRET);
  const redirectUri=clean(process.env.GHL_REDIRECT_URI);
  const encryptionSecret=clean(process.env.GHL_TOKEN_ENCRYPTION_KEY)||accountSessionSecret();
  return clientId&&clientSecret&&redirectUri&&encryptionSecret?{clientId,clientSecret,redirectUri,encryptionSecret,scopes:SCOPES}:null;
}
const cipherKey=secret=>crypto.createHash('sha256').update(String(secret)).digest();
export function encryptGhlToken(value,secret){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',cipherKey(secret),iv),encrypted=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]),tag=cipher.getAuthTag();return`v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`}
export function decryptGhlToken(value,secret){const[v,iv,tag,data]=String(value||'').split('.');if(v!=='v1'||!iv||!tag||!data)throw new Error('Stored CRM token is invalid.');const decipher=crypto.createDecipheriv('aes-256-gcm',cipherKey(secret),Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8')}
export function verifyGhlWebhookSignature(payload,signature){try{return Boolean(signature)&&crypto.verify(null,Buffer.from(String(payload),'utf8'),GHL_WEBHOOK_PUBLIC_KEY,Buffer.from(String(signature),'base64'))}catch{return false}}

export function createGhlAuthorizationUrl(accountId){
  const c=ghlConfig();
  if(!c)throw new Error('GHL CRM is not configured.');
  const state=signSession({purpose:'ghl-oauth',accountId},accountSessionSecret(),10*60);
  const customUrl = clean(process.env.GHL_AUTHORIZATION_URL || process.env.GHL_INSTALL_URL);
  if (customUrl) {
    try {
      const u = new URL(customUrl);
      // Draft Marketplace Test Links are version-specific install URLs, not OAuth
      // authorization endpoints. Preserve them exactly; HighLevel will redirect
      // back with a one-time authorization code after installation.
      if (u.hostname === 'app.gohighlevel.com' && /\/integration\/[^/]+\/versions\/[^/]+/.test(u.pathname)) {
        return u.toString();
      }
      u.searchParams.set('response_type', 'code');
      if (!u.searchParams.has('client_id')) u.searchParams.set('client_id', c.clientId);
      if (!u.searchParams.has('redirect_uri')) u.searchParams.set('redirect_uri', c.redirectUri);
      if (!u.searchParams.has('scope')) u.searchParams.set('scope', c.scopes.join(' '));
      u.searchParams.set('state', state);
      return u.toString();
    } catch {}
  }
  return`${AUTH_URL}?${new URLSearchParams({response_type:'code',client_id:c.clientId,redirect_uri:c.redirectUri,scope:c.scopes.join(' '),state})}`;
}
export function verifyGhlOAuthState(state,accountId){const p=verifySession(state,accountSessionSecret());return Boolean(p?.purpose==='ghl-oauth'&&p?.accountId===accountId)}
export function ghlInstallLocationId(){
  const raw=clean(process.env.GHL_INSTALL_URL);
  if(!raw)return'';
  try{
    const u=new URL(raw);
    const m=u.pathname.match(/\/v2\/location\/([^/]+)\/integration\//);
    return clean(m?.[1]);
  }catch{return''}
}
function normalizeTokenShape(payload={}){
  return{
    ...payload,
    access_token:clean(payload.access_token||payload.accessToken),
    refresh_token:clean(payload.refresh_token||payload.refreshToken),
    expires_in:Number(payload.expires_in||payload.expiresIn)||86399,
    token_type:clean(payload.token_type||payload.tokenType||'Bearer'),
    userType:clean(payload.userType||payload.user_type),
    companyId:clean(payload.companyId||payload.company_id),
    locationId:clean(payload.locationId||payload.location_id),
    userId:clean(payload.userId||payload.user_id),
    approvedLocations:Array.isArray(payload.approvedLocations)?payload.approvedLocations.map(clean).filter(Boolean):[]
  };
}
async function tokenRequest(values){const c=ghlConfig();if(!c)throw new Error('GHL CRM is not configured.');const response=await fetch(TOKEN_URL,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded',Version:'v3'},body:new URLSearchParams({client_id:c.clientId,client_secret:c.clientSecret,...values})}),raw=await response.json().catch(()=>({})),payload=normalizeTokenShape(raw);if(!response.ok||!payload.access_token){const e=new Error(raw.error_description||raw.message||raw.error||'CRM token request failed.');e.status=response.status||400;e.payload=raw;throw e}return payload}
export const exchangeGhlCode=code=>{const c=ghlConfig();return tokenRequest({grant_type:'authorization_code',code:clean(code),user_type:'Location',redirect_uri:c.redirectUri})};
export const refreshGhlTokens=refreshToken=>{const c=ghlConfig();return tokenRequest({grant_type:'refresh_token',refresh_token:clean(refreshToken),user_type:'Location',redirect_uri:c.redirectUri})};
export async function ensureGhlLocationTokens(tokens,preferredLocationId=''){
  const current=normalizeTokenShape(tokens);
  if(current.locationId&&current.refresh_token)return current;
  const preferred=clean(preferredLocationId);
  const approved=current.approvedLocations;
  const target=preferred&&(approved.length===0||approved.includes(preferred))
    ? preferred
    : approved.length===1?approved[0]:'';
  if(!current.access_token||!current.companyId||!target){
    const e=new Error(current.userType==='Company'
      ? 'GoHighLevel returned an agency-level token, but no single sub-account could be selected. Install Creative Creatures for one sub-account and try again.'
      : 'GoHighLevel did not return a location and refresh token.');
    e.status=409;e.payload={userType:current.userType,companyId:Boolean(current.companyId),approvedLocations:approved.length,hasRefreshToken:Boolean(current.refresh_token)};throw e;
  }
  const response=await fetch(LOCATION_TOKEN_URL,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded',Authorization:`Bearer ${current.access_token}`,Version:'v3'},body:new URLSearchParams({companyId:current.companyId,locationId:target})});
  const raw=await response.json().catch(()=>({})),locationTokens=normalizeTokenShape({...raw,companyId:raw.companyId||current.companyId});
  if(!response.ok||!locationTokens.access_token||!locationTokens.locationId||!locationTokens.refresh_token){
    const e=new Error(raw.error_description||raw.message||raw.error||'GoHighLevel could not create a sub-account access token.');
    e.status=response.status||409;e.payload=raw;throw e;
  }
  return locationTokens;
}
export const ghlTokenExpiry=tokens=>new Date(Date.now()+(Number(tokens.expires_in||tokens.expiresIn)||86399)*1000).toISOString();

async function request(accessToken,path,{method='GET',query,body}={}){const suffix=query?`?${new URLSearchParams(Object.entries(query).filter(([,v])=>v!==undefined&&v!==null&&v!=='')).toString()}`:'';const response=await fetch(`${API_URL}${path}${suffix}`,{method,headers:{Accept:'application/json',Authorization:`Bearer ${accessToken}`,Version:'2021-07-28',...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)}),text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{}if(!response.ok){const e=new Error(payload.message||payload.error||'CRM API request failed.');e.status=response.status||400;e.payload=payload;throw e}return payload}
const validId=(value,label='record')=>{const id=clean(value);if(!/^[A-Za-z0-9_-]{5,100}$/.test(id))throw Object.assign(new Error(`CRM ${label} ID is invalid.`),{status:422});return id};
export async function getGhlLocation(accessToken,locationId){const p=await request(accessToken,`/locations/${validId(locationId,'location')}`);return p.location||p}
export async function listGhlContacts(accessToken,locationId){const p=await request(accessToken,'/contacts/',{query:{locationId,limit:100}});return Array.isArray(p.contacts)?p.contacts:[]}
export async function saveGhlContact(accessToken,locationId,input={}){const id=clean(input.id),body={locationId,firstName:clean(input.firstName).slice(0,120),lastName:clean(input.lastName).slice(0,120),email:clean(input.email).slice(0,320),phone:clean(input.phone).slice(0,80),companyName:clean(input.companyName).slice(0,200),source:'Creative Creatures'};Object.keys(body).forEach(k=>body[k]===''&&delete body[k]);const p=await request(accessToken,id?`/contacts/${validId(id,'contact')}`:'/contacts/',{method:id?'PUT':'POST',body});return p.contact||p}
export async function archiveGhlContact(accessToken,id){await request(accessToken,`/contacts/${validId(id,'contact')}`,{method:'DELETE'});return true}
export async function listGhlPipelines(accessToken,locationId){const p=await request(accessToken,'/opportunities/pipelines',{query:{locationId}});return Array.isArray(p.pipelines)?p.pipelines:[]}
export async function listGhlOpportunities(accessToken,locationId,pipelineId=''){const p=await request(accessToken,'/opportunities/search',{query:{location_id:locationId,pipeline_id:pipelineId,limit:100}});return Array.isArray(p.opportunities)?p.opportunities:[]}
export async function saveGhlOpportunity(accessToken,locationId,input={}){const id=clean(input.id),body={locationId,pipelineId:validId(input.pipelineId,'pipeline'),pipelineStageId:validId(input.pipelineStageId,'pipeline stage'),name:clean(input.name).slice(0,240),status:['open','won','lost','abandoned','all'].includes(clean(input.status).toLowerCase())?clean(input.status).toLowerCase():'open',contactId:validId(input.contactId,'contact'),monetaryValue:Number(input.monetaryValue)||0};const p=await request(accessToken,id?`/opportunities/${validId(id,'opportunity')}`:'/opportunities',{method:id?'PUT':'POST',body});return p.opportunity||p}
export async function archiveGhlOpportunity(accessToken,id){await request(accessToken,`/opportunities/${validId(id,'opportunity')}`,{method:'DELETE'});return true}
