const clean = value => String(value ?? '').trim();

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

export const validEmail = value => /^\S+@\S+\.\S+$/.test(clean(value));

function emailConfig() {
  const apiKey = clean(process.env.RESEND_API_KEY);
  const from = clean(process.env.RESEND_FROM_EMAIL || process.env.REPORT_FROM_EMAIL);
  const replyTo = clean(process.env.EMAIL_REPLY_TO);
  return { apiKey, from, replyTo, configured: Boolean(apiKey && from) };
}

export function emailStatus() {
  const config = emailConfig();
  return {
    provider: 'resend',
    configured: config.configured,
    apiKeyConfigured: Boolean(config.apiKey),
    fromConfigured: Boolean(config.from),
    replyToConfigured: Boolean(config.replyTo)
  };
}

export async function sendEmail({ to, subject, html, text, attachments, replyTo }) {
  const config = emailConfig();
  if (!config.configured) {
    const error = new Error('Email delivery is not configured.');
    error.code = 'EMAIL_NOT_CONFIGURED'; error.status = 503; throw error;
  }
  const recipients = (Array.isArray(to) ? to : [to]).map(clean).filter(Boolean);
  if (!recipients.length || recipients.some(address => !validEmail(address))) {
    const error = new Error('Enter a valid email address.');
    error.code = 'INVALID_EMAIL'; error.status = 422; throw error;
  }
  const payload = {
    from: config.from,
    to: recipients,
    subject: clean(subject),
    html: String(html || ''),
    text: text ? String(text) : undefined,
    attachments: Array.isArray(attachments) && attachments.length ? attachments : undefined,
    reply_to: clean(replyTo || config.replyTo) || undefined
  };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'CreativeCreatures/1.1 (transactional-email)'
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result?.message || result?.error || 'Email provider rejected the message.');
    error.code = 'EMAIL_PROVIDER_ERROR';
    error.status = response.status >= 400 && response.status < 600 ? response.status : 502;
    throw error;
  }
  return { id: result.id || null };
}
