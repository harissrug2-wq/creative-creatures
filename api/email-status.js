import { emailStatus } from './email-service.js';
export default function handler(req,res){res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({error:'Method not allowed.'}))}res.statusCode=200;return res.end(JSON.stringify(emailStatus()))}
