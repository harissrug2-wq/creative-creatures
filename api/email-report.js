import { emailStatus, escapeHtml, sendEmail, validEmail } from '../lib/email-service.js';
const json=(res,status,payload)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(payload))};
const clean=value=>String(value??'').trim();
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return json(res,204,{});
  if(req.method==='GET' && (String(req.query?.mode||'')==='status' || req.url?.includes('mode=status'))) return json(res,200,emailStatus());
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});const to=clean(body.to);if(!validEmail(to))return json(res,422,{error:'Enter a valid email address.'});
    const title=clean(body.title)||'Creative Creatures Report';const summary=clean(body.summary);const filename=clean(body.filename)||'creative-creatures-report.pdf';const attachments=body.pdfBase64?[{filename,content:clean(body.pdfBase64)}]:undefined;
    const result=await sendEmail({to,subject:`Creative Creatures - ${title}`,text:`Your Creative Creatures report is attached.\n\n${summary}`,html:`<div style="font-family:Inter,Arial,sans-serif;color:#111218;line-height:1.55"><h1 style="font-size:24px">${escapeHtml(title)}</h1><p>Your Creative Creatures report is attached.</p><pre style="white-space:pre-wrap;background:#f7f7f5;border:1px solid #e5e5e2;border-radius:12px;padding:18px;font-family:Inter,Arial,sans-serif;font-size:13px">${escapeHtml(summary)}</pre></div>`,attachments});
    return json(res,200,{sent:true,id:result.id});
  }catch(error){
    console.error('report email error',{code:error?.code,status:error?.status,message:error?.message});
    const status=error?.code==='EMAIL_NOT_CONFIGURED'?503:(error?.status===422?422:502);
    return json(res,status,{error:error?.code==='EMAIL_NOT_CONFIGURED'?'Report email is not configured.':'The report could not be emailed.',code:error?.code||'REPORT_EMAIL_ERROR'});
  }
}
