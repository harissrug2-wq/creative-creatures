import accountAuthHandler from './account-auth.js';

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/$/, '');

  let action = '';
  if (pathname.endsWith('/connect')) action = 'jira_connect';
  else if (pathname.endsWith('/callback')) action = 'jira_callback';
  else if (pathname.endsWith('/refresh-token')) action = 'jira_refresh_token';
  else if (pathname.endsWith('/projects')) action = 'jira_projects';
  else if (pathname.endsWith('/issues')) action = req.method === 'POST' ? 'jira_create_issue' : 'jira_issues';
  else if (pathname.endsWith('/sync')) action = 'jira_sync';
  else if (pathname.endsWith('/disconnect')) action = 'jira_disconnect';

  if (!action) {
    action = req.query?.action || (typeof req.body === 'object' && req.body?.action) || '';
  }

  if (req.method === 'GET' && action) {
    req.query = { ...req.query, action };
  } else if (req.method === 'POST' || req.method === 'PUT') {
    const existingBody = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    req.body = { ...existingBody, action: action || existingBody.action };
  }

  return accountAuthHandler(req, res);
}
