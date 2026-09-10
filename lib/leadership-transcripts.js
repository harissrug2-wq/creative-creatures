const clean = value => String(value ?? '').trim();

const providers = new Set([
  'google_meet',
  'zoom',
  'microsoft_teams',
  'fathom',
  'fireflies',
  'manual',
  'other'
]);

const transcriptSelect = [
  'id',
  'account_id',
  'meeting_id',
  'provider',
  'provider_meeting_id',
  'provider_transcript_id',
  'source_url',
  'original_file_name',
  'mime_type',
  'language_code',
  'raw_text',
  'segments',
  'status',
  'ai_draft',
  'error_message',
  'provider_created_at',
  'received_at',
  'processed_at',
  'applied_at',
  'created_at',
  'updated_at'
].join(',');

function validationError(message) {
  const error = new Error(message);
  error.status = 422;
  return error;
}

function parseHttpUrl(value) {
  const raw = clean(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported');
    return parsed.toString().slice(0, 2000);
  } catch {
    throw validationError('Transcript source URL must use http or https.');
  }
}

function parseTimestamp(value) {
  const raw = clean(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw validationError('Provider transcript time is invalid.');
  return date.toISOString();
}

function stripCaptionMarkup(value) {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/^WEBVTT[^\r\n]*\r?\n/i, '')
    .replace(/^NOTE(?:[ \t].*)?(?:\r?\n(?!\r?\n).*)*/gim, '')
    .replace(/^\d+\s*$/gm, '')
    .replace(/^\s*(?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}.*$/gm, '')
    .replace(/<v\s+([^>]+)>/gi, '$1: ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter((line, index, lines) => index === 0 || line !== lines[index - 1])
    .join('\n');
}

export function normalizeTranscriptText(value, mimeType = 'text/plain') {
  const input = String(value ?? '').replace(/\0/g, '').trim();
  const normalizedMime = clean(mimeType).toLowerCase();
  const text = /(?:vtt|srt|subrip)/i.test(normalizedMime) ? stripCaptionMarkup(input) : input;
  if (!text) throw validationError('Transcript text is required.');
  if (text.length > 500000) throw validationError('Transcript text exceeds the 500,000 character limit.');
  return text;
}

export function publicTranscript(row, includeRawText = false) {
  if (!row) return null;
  const output = {
    id: row.id,
    meetingId: row.meeting_id,
    provider: row.provider,
    providerMeetingId: row.provider_meeting_id || '',
    providerTranscriptId: row.provider_transcript_id || '',
    sourceUrl: row.source_url || '',
    originalFileName: row.original_file_name || '',
    mimeType: row.mime_type || 'text/plain',
    languageCode: row.language_code || '',
    status: row.status,
    aiDraft: row.ai_draft || {},
    errorMessage: row.error_message || '',
    providerCreatedAt: row.provider_created_at,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
    appliedAt: row.applied_at,
    updatedAt: row.updated_at
  };
  if (includeRawText) output.rawText = row.raw_text || '';
  return output;
}

export async function getMeetingTranscript({ config, request, accountId, meetingId, includeRawText = true }) {
  const params = new URLSearchParams({
    select: transcriptSelect,
    account_id: `eq.${accountId}`,
    meeting_id: `eq.${meetingId}`,
    limit: '1'
  });
  const rows = await request(config, `leadership_meeting_transcripts?${params.toString()}`);
  return publicTranscript(Array.isArray(rows) ? rows[0] : null, includeRawText);
}

export async function attachMeetingTranscript({ config, request, accountId, meetingId, body }) {
  const provider = providers.has(clean(body.provider)) ? clean(body.provider) : 'manual';
  const mimeType = clean(body.mimeType ?? body.mime_type).slice(0, 160) || 'text/plain';
  const rawText = normalizeTranscriptText(body.rawText ?? body.raw_text ?? body.transcriptText, mimeType);
  const now = new Date().toISOString();
  const record = {
    account_id: accountId,
    meeting_id: meetingId,
    provider,
    provider_meeting_id: clean(body.providerMeetingId ?? body.provider_meeting_id).slice(0, 500),
    provider_transcript_id: clean(body.providerTranscriptId ?? body.provider_transcript_id).slice(0, 500),
    source_url: parseHttpUrl(body.sourceUrl ?? body.source_url),
    original_file_name: clean(body.originalFileName ?? body.original_file_name).slice(0, 255),
    mime_type: mimeType,
    language_code: clean(body.languageCode ?? body.language_code).slice(0, 40),
    raw_text: rawText,
    segments: Array.isArray(body.segments) ? body.segments.slice(0, 10000) : [],
    status: 'ready',
    ai_draft: {},
    error_message: '',
    provider_created_at: parseTimestamp(body.providerCreatedAt ?? body.provider_created_at),
    received_at: now,
    processed_at: null,
    applied_at: null,
    updated_at: now
  };
  const rows = await request(config, 'leadership_meeting_transcripts?on_conflict=meeting_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(record)
  });
  await request(config, `leadership_meetings?${new URLSearchParams({
    id: `eq.${meetingId}`,
    account_id: `eq.${accountId}`
  }).toString()}`, {
    method: 'PATCH',
    body: JSON.stringify({
      transcript_provider: provider,
      transcript_external_id: record.provider_transcript_id,
      transcript_status: 'pending',
      transcript_error: '',
      transcript_received_at: now,
      updated_at: now
    })
  });
  return publicTranscript(Array.isArray(rows) ? rows[0] : null, true);
}

export async function deleteMeetingTranscript({ config, request, accountId, meetingId }) {
  const params = new URLSearchParams({
    account_id: `eq.${accountId}`,
    meeting_id: `eq.${meetingId}`
  });
  await request(config, `leadership_meeting_transcripts?${params.toString()}`, { method: 'DELETE' });
  await request(config, `leadership_meetings?${new URLSearchParams({
    id: `eq.${meetingId}`,
    account_id: `eq.${accountId}`
  }).toString()}`, {
    method: 'PATCH',
    body: JSON.stringify({
      transcript_provider: 'none',
      transcript_external_id: '',
      transcript_status: 'none',
      transcript_error: '',
      transcript_received_at: null,
      transcript_processed_at: null,
      updated_at: new Date().toISOString()
    })
  });
}
