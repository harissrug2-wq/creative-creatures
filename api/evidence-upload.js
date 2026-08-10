const json=(res,status,payload)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(payload))};
const clean=value=>String(value??'').trim();
const safeName=value=>clean(value).replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'evidence-file';
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return json(res,204,{});if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
  const url=clean(process.env.SUPABASE_URL).replace(/\/+$/,'');const key=clean(process.env.SUPABASE_SERVICE_ROLE_KEY);if(!url||!key)return json(res,503,{error:'Evidence storage is not configured.',code:'BACKEND_NOT_CONFIGURED'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});const accountId=safeName(body.accountId||'unlinked');const evidenceType=safeName(body.evidenceType||'evidence');const fileName=safeName(body.fileName);const mimeType=clean(body.mimeType)||'application/octet-stream';const base64=clean(body.base64);
    if(!base64)return json(res,422,{error:'No file data was supplied.'});const bytes=Buffer.from(base64,'base64');if(bytes.length>4*1024*1024)return json(res,413,{error:'File exceeds the 4 MB upload limit.'});
    const path=`${accountId}/${evidenceType}/${Date.now()}-${fileName}`;const response=await fetch(`${url}/storage/v1/object/diagnostic-evidence/${encodeURI(path)}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':mimeType,'x-upsert':'true'},body:bytes});const text=await response.text();if(!response.ok)throw new Error(text||'Storage upload failed.');
    return json(res,200,{file:{path,name:fileName,type:evidenceType,mimeType,size:bytes.length,uploadedAt:new Date().toISOString()}});
  }catch(error){console.error('evidence upload error',error);return json(res,500,{error:'The evidence file could not be stored.',code:'EVIDENCE_UPLOAD_ERROR'});}
}
