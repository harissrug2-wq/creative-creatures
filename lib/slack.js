import crypto from 'node:crypto';
import { accountSessionSecret, signSession, verifySession } from './session-utils.js';

const clean = value => String(value ?? '').trim();
const AUTH_URL = 'https://slack.com/oauth/v2/authorize';
const TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const API_BASE = 'https://slack.com/api';
const SCOPES = ['channels:read','groups:read','users:read','chat:write'];

export function slackConfig(){
  const clientId=clean(process.env.SLACK_CLIENT_ID);
  const clientSecret=clean(process.env.SLACK_CLIENT_SECRET);
  const redirectUri=clean(process.env.SLACK_REDIRECT_URI);
  const signingSecret=clean(process.env.SLACK_SIGNING_SECRET);
  const encryptionSecret=clean(process.env.SLACK_TOKEN_ENCRYPTION_KEY)||accountSessionSecret();
  if(!clientId||!clientSecret||!redirectUri||!encryptionSecret)return null;
  return{clientId,clientSecret,redirectUri,signingSecret,encryptionSecret,scopes:SCOPES};
}
function cipherKey(secret){return crypto.createHash('sha256').update(String(secret)).digest()}
export function encryptSlackToken(value,secret){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',cipherKey(secret),iv),encrypted=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]),tag=cipher.getAuthTag();return`v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`}
export function decryptSlackToken(value,secret){const[version,ivRaw,tagRaw,dataRaw]=String(value||'').split('.');if(version!=='v1'||!ivRaw||!tagRaw||!dataRaw)throw new Error('Stored Slack token is invalid.');const decipher=crypto.createDecipheriv('aes-256-gcm',cipherKey(secret),Buffer.from(ivRaw,'base64url'));decipher.setAuthTag(Buffer.from(tagRaw,'base64url'));return Buffer.concat([decipher.update(Buffer.from(dataRaw,'base64url')),decipher.final()]).toString('utf8')}
export function createSlackAuthorizationUrl(accountId){const config=slackConfig();if(!config)throw new Error('Slack is not configured.');const state=signSession({purpose:'slack-oauth',accountId},accountSessionSecret(),10*60);const params=new URLSearchParams({client_id:config.clientId,scope:config.scopes.join(','),redirect_uri:config.redirectUri,state});return`${AUTH_URL}?${params.toString()}`}
export function verifySlackOAuthState(state,accountId){const payload=verifySession(state,accountSessionSecret());return Boolean(payload?.purpose==='slack-oauth'&&payload?.accountId===accountId)}
async function slackJson(method,{accessToken,query,body}={}){const url=new URL(`${API_BASE}/${method}`);if(query)Object.entries(query).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,String(v))});const response=await fetch(url,{method:body?'POST':'GET',headers:{Accept:'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`}:{'Content-Type':'application/x-www-form-urlencoded'})},body:body?new URLSearchParams(body).toString():undefined});const payload=await response.json().catch(()=>({}));if(!response.ok||payload?.ok===false){const error=new Error(payload?.error||'Slack API request failed.');error.status=response.status||400;error.code=payload?.error||'SLACK_API_ERROR';error.payload=payload;throw error}return payload}
export function exchangeSlackCode(code){const c=slackConfig();if(!c)throw new Error('Slack is not configured.');return slackJson('oauth.v2.access',{body:{client_id:c.clientId,client_secret:c.clientSecret,code:clean(code),redirect_uri:c.redirectUri}})}
export function slackAuthTest(accessToken){return slackJson('auth.test',{accessToken})}
export async function listSlackUsers({accessToken,limit=100}){let cursor='',users=[];do{const p=await slackJson('users.list',{accessToken,query:{limit:Math.min(Math.max(Number(limit)||100,1),200),cursor}});users.push(...(p.members||[]).map(u=>({id:u.id,name:u.name||'',realName:u.real_name||u.profile?.real_name||'',displayName:u.profile?.display_name||'',email:u.profile?.email||'',isBot:Boolean(u.is_bot),deleted:Boolean(u.deleted),isAdmin:Boolean(u.is_admin),isOwner:Boolean(u.is_owner),tz:u.tz||'',image:u.profile?.image_48||''})));cursor=p.response_metadata?.next_cursor||''}while(cursor&&users.length<500);return users.slice(0,500)}
export async function listSlackChannels({accessToken,limit=100}){let cursor='',channels=[];do{const p=await slackJson('conversations.list',{accessToken,query:{types:'public_channel,private_channel',exclude_archived:'true',limit:Math.min(Math.max(Number(limit)||100,1),200),cursor}});channels.push(...(p.channels||[]).map(ch=>({id:ch.id,name:ch.name||'',isPrivate:Boolean(ch.is_private),isMember:Boolean(ch.is_member),numMembers:Number(ch.num_members||0),topic:ch.topic?.value||'',purpose:ch.purpose?.value||'',created:ch.created||null})));cursor=p.response_metadata?.next_cursor||''}while(cursor&&channels.length<500);return channels.slice(0,500)}
export async function revokeSlackToken(accessToken){if(!clean(accessToken))return false;try{await slackJson('auth.revoke',{accessToken});return true}catch{return false}}
