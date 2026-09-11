const clean = value => String(value ?? '').trim();
const MEET_API = 'https://meet.googleapis.com/v2';

function serviceError(message, status = 502, code = 'GOOGLE_MEET_API_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function resourceName(value, pattern, label) {
  const name = clean(value);
  if (!pattern.test(name)) throw serviceError(`Google Meet returned an invalid ${label}.`);
  return name;
}

async function meetRequest({ accessToken, path, query }) {
  if (!clean(accessToken)) throw serviceError('Google Meet access token is missing.', 401);
  const suffix = query ? `?${new URLSearchParams(query).toString()}` : '';
  const response = await fetch(`${MEET_API}${path}${suffix}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = serviceError(
      payload?.error?.message || `Google Meet request failed with status ${response.status}.`,
      response.status || 502,
      payload?.error?.status || 'GOOGLE_MEET_API_ERROR'
    );
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function listAll({ accessToken, path, key, query = {}, maxPages = 20 }) {
  const output = [];
  let pageToken = '';
  for (let page = 0; page < maxPages; page += 1) {
    const payload = await meetRequest({
      accessToken,
      path,
      query: { ...query, pageSize: '100', ...(pageToken ? { pageToken } : {}) }
    });
    output.push(...(Array.isArray(payload?.[key]) ? payload[key] : []));
    pageToken = clean(payload?.nextPageToken);
    if (!pageToken) break;
  }
  return output;
}

export function normalizeGoogleMeetCode(value) {
  const raw = clean(value).toLowerCase();
  const match = raw.match(/(?:meet\.google\.com\/)?([a-z]{3}-[a-z]{4}-[a-z]{3})(?:\b|\/|\?|#)/i)
    || raw.match(/^([a-z]{3}-[a-z]{4}-[a-z]{3})$/i);
  return match ? match[1].toLowerCase() : '';
}

export async function listGoogleMeetConferenceRecords({ accessToken, meetingCode }) {
  const code = normalizeGoogleMeetCode(meetingCode);
  if (!code) throw serviceError('A valid Google Meet code is required.', 422, 'GOOGLE_MEET_CODE_REQUIRED');
  return listAll({
    accessToken,
    path: '/conferenceRecords',
    key: 'conferenceRecords',
    query: { filter: `space.meeting_code = "${code}"` }
  });
}

export async function listGoogleMeetTranscripts({ accessToken, conferenceRecordName }) {
  const parent = resourceName(
    conferenceRecordName,
    /^conferenceRecords\/[A-Za-z0-9_-]+$/,
    'conference record name'
  );
  return listAll({ accessToken, path: `/${parent}/transcripts`, key: 'transcripts' });
}

export async function listGoogleMeetTranscriptEntries({ accessToken, transcriptName }) {
  const parent = resourceName(
    transcriptName,
    /^conferenceRecords\/[A-Za-z0-9_-]+\/transcripts\/[A-Za-z0-9_-]+$/,
    'transcript name'
  );
  return listAll({ accessToken, path: `/${parent}/entries`, key: 'transcriptEntries' });
}

export async function listGoogleMeetParticipants({ accessToken, conferenceRecordName }) {
  const parent = resourceName(
    conferenceRecordName,
    /^conferenceRecords\/[A-Za-z0-9_-]+$/,
    'conference record name'
  );
  return listAll({ accessToken, path: `/${parent}/participants`, key: 'participants' });
}

function participantName(participant) {
  return clean(
    participant?.signedinUser?.displayName
    || participant?.anonymousUser?.displayName
    || participant?.phoneUser?.displayName
  ) || 'Unknown speaker';
}

export async function fetchGoogleMeetTranscript({ accessToken, meetingCode }) {
  const code = normalizeGoogleMeetCode(meetingCode);
  const records = await listGoogleMeetConferenceRecords({ accessToken, meetingCode: code });
  const record = [...records]
    .filter(item => item?.endTime)
    .sort((a, b) => Date.parse(b.endTime || 0) - Date.parse(a.endTime || 0))[0];
  if (!record) throw serviceError('No completed Google Meet conference was found.', 404, 'GOOGLE_MEET_CONFERENCE_NOT_FOUND');

  const transcripts = await listGoogleMeetTranscripts({
    accessToken,
    conferenceRecordName: record.name
  });
  const transcript = [...transcripts]
    .filter(item => item?.state === 'FILE_GENERATED')
    .sort((a, b) => Date.parse(b.endTime || 0) - Date.parse(a.endTime || 0))[0];
  if (!transcript) throw serviceError('The Google Meet transcript is not ready yet.', 409, 'GOOGLE_MEET_TRANSCRIPT_NOT_READY');

  const [entries, participants] = await Promise.all([
    listGoogleMeetTranscriptEntries({ accessToken, transcriptName: transcript.name }),
    listGoogleMeetParticipants({ accessToken, conferenceRecordName: record.name })
  ]);
  const names = new Map(participants.map(item => [item.name, participantName(item)]));
  const segments = entries.map(item => ({
    speaker: names.get(item.participant) || 'Unknown speaker',
    text: clean(item.text),
    languageCode: clean(item.languageCode),
    startTime: item.startTime || null,
    endTime: item.endTime || null
  })).filter(item => item.text);
  if (!segments.length) throw serviceError('The Google Meet transcript contains no entries.', 409, 'GOOGLE_MEET_TRANSCRIPT_EMPTY');

  return {
    provider: 'google_meet',
    providerMeetingId: clean(record.name) || code,
    providerTranscriptId: clean(transcript.name),
    sourceUrl: '',
    originalFileName: '',
    mimeType: 'text/plain',
    languageCode: segments.find(item => item.languageCode)?.languageCode || '',
    rawText: segments.map(item => `${item.speaker}: ${item.text}`).join('\n'),
    segments,
    providerCreatedAt: transcript.endTime || record.endTime || null,
    conferenceRecordName: clean(record.name)
  };
}
