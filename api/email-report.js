import { emailStatus, escapeHtml, sendEmail, validEmail } from '../lib/email-service.js';
import { generatePdfReport } from '../lib/pdf-report-generator.js';
const json=(res,status,payload)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(payload))};
const clean=value=>String(value??'').trim();

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return json(res,204,{});
  if(req.method==='GET' && (String(req.query?.mode||'')==='status' || req.url?.includes('mode=status'))) return json(res,200,emailStatus());
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const to=clean(body.to);
    if(!validEmail(to))return json(res,422,{error:'Enter a valid email address.'});
    
    const isScorecardReport = body.type === 'scorecard' || body.index === 'scorecard' || clean(body.title).toLowerCase().includes('scorecard') || clean(body.title).toLowerCase().includes('diagnostic') || clean(body.title).toLowerCase().includes('freedom');
    const isArchetypeReport = !isScorecardReport && (body.type === 'owner-archetype' || !body.type || clean(body.title).toLowerCase().includes('owner') || clean(body.title).toLowerCase().includes('archetype'));
    const firstName = clean(body.firstName || body.first_name) || 'there';
    const baseUrl = clean(process.env.APP_URL || process.env.STRIPE_APP_URL || process.env.VERCEL_URL).replace(/\/$/, '') || 'https://creativecreatures.ai';
    const aofiUrl = `${baseUrl}/agency-scorecard/`;

    let subject = clean(body.subject);
    let text = clean(body.text);
    let html = clean(body.html);

    if (isScorecardReport && !subject) {
      subject = 'See your AOFI™ score, what is affecting it and where to focus next.';
      text = `Hi ${firstName},\n\n` +
        `Your Agency Diagnostic Report is ready.\n\n` +
        `Inside, you’ll find:\n` +
        `• Your Agency Owner Freedom Index™ (AOFI™) score\n` +
        `• Your Financial Performance, Agency Strength and Owner Independence scores\n` +
        `• The issues and opportunities affecting your agency’s performance and value\n` +
        `• The areas with the greatest potential for improvement\n\n` +
        `Your score is not a grade. It is the baseline for building a stronger, more valuable and less owner-dependent agency.\n\n` +
        `The next step is to review the findings and turn them into clear agency goals, department goals and 90-day priorities.\n\n` +
        `When your leadership team and department heads use the platform weekly to execute those priorities, the process comes with our 100% money-back guarantee to improve the performance and value of your agency.\n\n` +
        `[View My Agency Diagnostic Report]\n${aofiUrl}\n\n` +
        `To your freedom and agency value,\n` +
        `Tony Lael\n` +
        `Founder, Creative Creatures`;

      html = `<div style="font-family:Inter,Arial,sans-serif;color:#111218;line-height:1.6;max-width:600px;margin:0 auto;padding:28px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.04);">` +
        `<div style="margin-bottom:24px;border-bottom:2px solid #f3f4f6;padding-bottom:16px;">` +
        `<span style="font-size:12px;font-weight:700;letter-spacing:1px;color:#2563eb;text-transform:uppercase;">Creative Creatures</span>` +
        `<h2 style="font-size:20px;font-weight:700;color:#111218;margin:4px 0 0 0;">Agency Diagnostic Report</h2>` +
        `</div>` +
        `<p style="font-size:16px;margin-bottom:16px;">Hi ${escapeHtml(firstName)},</p>` +
        `<p style="font-size:15px;margin-bottom:16px;">Your Agency Diagnostic Report is ready.</p>` +
        `<p style="font-size:15px;margin-bottom:12px;">Inside, you’ll find:</p>` +
        `<ul style="font-size:15px;margin:0 0 20px 0;padding-left:24px;line-height:1.8;color:#1f2937;">` +
        `<li>Your Agency Owner Freedom Index™ (AOFI™) score</li>` +
        `<li>Your Financial Performance, Agency Strength and Owner Independence scores</li>` +
        `<li>The issues and opportunities affecting your agency’s performance and value</li>` +
        `<li>The areas with the greatest potential for improvement</li>` +
        `</ul>` +
        `<p style="font-size:15px;margin-bottom:16px;">Your score is not a grade. It is the baseline for building a stronger, more valuable and less owner-dependent agency.</p>` +
        `<p style="font-size:15px;margin-bottom:16px;">The next step is to review the findings and turn them into clear agency goals, department goals and 90-day priorities.</p>` +
        `<p style="font-size:15px;margin-bottom:24px;">When your leadership team and department heads use the platform weekly to execute those priorities, the process comes with our 100% money-back guarantee to improve the performance and value of your agency.</p>` +
        `<div style="margin:28px 0;text-align:left;">` +
        `<a href="${escapeHtml(aofiUrl)}" style="background-color:#2563eb;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;box-shadow:0 4px 12px rgba(37,99,235,0.25);">View My Agency Diagnostic Report</a>` +
        `</div>` +
        `<p style="font-size:15px;margin-top:28px;margin-bottom:4px;">To your freedom and agency value,</p>` +
        `<p style="font-size:15px;margin:0;"><strong>Tony Lael</strong><br><span style="color:#4b5563;">Founder, Creative Creatures</span></p>` +
        `</div>`;
    } else if (isArchetypeReport && !subject) {
      subject = 'Your archetype reveals how you lead. Your AOFI™ score reveals what to improve next.';
      text = `Hi ${firstName},\n\n` +
        `Congratulations on completing your Agency Owner Archetype Report.\n\n` +
        `Your archetype reveals how you lead—and where you may still be limiting your agency.\n\n` +
        `The next step is to establish your Agency Owner Freedom Index™ (AOFI™) score. It measures the three drivers of agency value and owner freedom:\n\n` +
        `Financial Performance\n` +
        `Agency Strength\n` +
        `Owner Independence\n\n` +
        `Your score gives you a baseline, identifies what is holding the agency back and shows where improvement will create the most value.\n\n` +
        `From there, your leadership team and department heads use the Agency Intelligence Platform each week to turn those insights into action.\n\n` +
        `We are so confident in this process that its weekly use comes with a 100% money-back guarantee to improve the performance and value of your agency.\n\n` +
        `[Get My AOFI™ Score]\n${aofiUrl}\n\n` +
        `To your freedom and agency value,\n` +
        `Tony Lael\n` +
        `Founder, Creative Creatures`;

      html = `<div style="font-family:Inter,Arial,sans-serif;color:#111218;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">` +
        `<p style="font-size:16px;margin-bottom:16px;">Hi ${escapeHtml(firstName)},</p>` +
        `<p style="font-size:15px;margin-bottom:16px;">Congratulations on completing your Agency Owner Archetype Report.</p>` +
        `<p style="font-size:15px;margin-bottom:16px;">Your archetype reveals how you lead—and where you may still be limiting your agency.</p>` +
        `<p style="font-size:15px;margin-bottom:12px;">The next step is to establish your Agency Owner Freedom Index™ (AOFI™) score. It measures the three drivers of agency value and owner freedom:</p>` +
        `<ul style="font-size:15px;margin:0 0 16px 0;padding-left:24px;line-height:1.8;color:#1f2937;">` +
        `<li>Financial Performance</li>` +
        `<li>Agency Strength</li>` +
        `<li>Owner Independence</li>` +
        `</ul>` +
        `<p style="font-size:15px;margin-bottom:16px;">Your score gives you a baseline, identifies what is holding the agency back and shows where improvement will create the most value.</p>` +
        `<p style="font-size:15px;margin-bottom:16px;">From there, your leadership team and department heads use the Agency Intelligence Platform each week to turn those insights into action.</p>` +
        `<p style="font-size:15px;margin-bottom:24px;">We are so confident in this process that its weekly use comes with a 100% money-back guarantee to improve the performance and value of your agency.</p>` +
        `<div style="margin:28px 0;text-align:left;">` +
        `<a href="${escapeHtml(aofiUrl)}" style="background-color:#2563eb;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">Get My AOFI™ Score</a>` +
        `</div>` +
        `<p style="font-size:15px;margin-top:24px;margin-bottom:4px;">To your freedom and agency value,</p>` +
        `<p style="font-size:15px;margin:0;"><strong>Tony Lael</strong><br><span style="color:#4b5563;">Founder, Creative Creatures</span></p>` +
        `</div>`;
    }

    const title=clean(body.title)||(isScorecardReport?'Agency Diagnostic Report':'Creative Creatures Report');
    const filename=clean(body.filename)||(isScorecardReport?'agency-diagnostic-report.pdf':'creative-creatures-report.pdf');
    let pdfBase64 = body.pdfBase64;
    if (!pdfBase64 && (body.model || body.scorecard || body.scores || isScorecardReport)) {
      try {
        const model = body.model || body;
        const pdfBytes = await generatePdfReport(model);
        pdfBase64 = Buffer.from(pdfBytes).toString('base64');
      } catch (genErr) {
        console.warn('PDF generation error in api/email-report:', genErr);
      }
    }
    const attachments=pdfBase64?[{filename,content:clean(pdfBase64)}]:undefined;

    const result=await sendEmail({
      to,
      subject: subject || `Creative Creatures - ${title}`,
      text,
      html,
      attachments
    });
    return json(res,200,{sent:true,id:result.id});
  }catch(error){
    console.error('report email error',{code:error?.code,status:error?.status,message:error?.message});
    const status=error?.code==='EMAIL_NOT_CONFIGURED'?503:(error?.status===422?422:502);
    return json(res,status,{error:error?.code==='EMAIL_NOT_CONFIGURED'?'Report email is not configured.':'The report could not be emailed.',code:error?.code||'REPORT_EMAIL_ERROR'});
  }
}

