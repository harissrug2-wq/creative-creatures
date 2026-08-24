import crypto from 'node:crypto';
import {
  accountSessionSecret,
  signSession,
  verifySession
} from './session-utils.js';

const clean = value => String(value ?? '').trim();

const AUTHORIZE_URL = 'https://auth.monday.com/oauth2/authorize';
const NEW_TOKEN_URL = 'https://auth.monday.com/oauth_ms/oauth/token';
const LEGACY_TOKEN_URL = 'https://auth.monday.com/oauth2/token';
const REVOKE_URL = 'https://auth.monday.com/oauth_ms/oauth/revoke';
const API_URL = 'https://api.monday.com/v2';
const API_VERSION = '2026-07';

export function mondayConfig() {
  const clientId = clean(process.env.MONDAY_CLIENT_ID);
  const clientSecret = clean(process.env.MONDAY_CLIENT_SECRET);
  const redirectUri = clean(process.env.MONDAY_REDIRECT_URI);

  const encryptionSecret =
    clean(process.env.MONDAY_TOKEN_ENCRYPTION_KEY) ||
    accountSessionSecret();

  if (
    !clientId ||
    !clientSecret ||
    !redirectUri ||
    !encryptionSecret
  ) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    encryptionSecret
  };
}

function key(secret) {
  return crypto
    .createHash('sha256')
    .update(String(secret))
    .digest();
}

export function encryptMondayToken(value, secret) {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    key(secret),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url')
  ].join('.');
}

export function decryptMondayToken(value, secret) {
  const [
    version,
    ivRaw,
    tagRaw,
    dataRaw
  ] = String(value || '').split('.');

  if (
    version !== 'v1' ||
    !ivRaw ||
    !tagRaw ||
    !dataRaw
  ) {
    throw new Error(
      'Stored monday.com token is invalid.'
    );
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key(secret),
    Buffer.from(ivRaw, 'base64url')
  );

  decipher.setAuthTag(
    Buffer.from(tagRaw, 'base64url')
  );

  return Buffer.concat([
    decipher.update(
      Buffer.from(dataRaw, 'base64url')
    ),
    decipher.final()
  ]).toString('utf8');
}

function pkceVerifier() {
  return crypto
    .randomBytes(48)
    .toString('base64url');
}

function pkceChallenge(verifier) {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

/**
 * Starts the monday.com OAuth flow.
 *
 * force_install_if_needed=true is important:
 * if Creative Creatures has not yet been installed
 * in the selected monday account, monday should route
 * the user through installation and then continue OAuth.
 */
export function createMondayAuthorizationUrl(accountId) {
  const config = mondayConfig();

  if (!config) {
    throw new Error(
      'monday.com is not configured.'
    );
  }

  const verifier = pkceVerifier();

  const state = signSession(
    {
      purpose: 'monday-oauth',
      accountId,
      codeVerifier: verifier
    },
    accountSessionSecret(),
    10 * 60
  );

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',

    // Seamless install + OAuth flow.
    force_install_if_needed: 'true',

    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: 'S256'
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export function verifyMondayOAuthState(
  state,
  accountId
) {
  const payload = verifySession(
    state,
    accountSessionSecret()
  );

  if (
    !payload ||
    payload.purpose !== 'monday-oauth' ||
    payload.accountId !== accountId
  ) {
    return null;
  }

  if (!clean(payload.codeVerifier)) {
    return null;
  }

  return payload;
}

async function tokenRequest(url, body) {
  const response = await fetch(url, {
    method: 'POST',

    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },

    body: JSON.stringify(body)
  });

  const payload = await response
    .json()
    .catch(() => ({}));

  return {
    response,
    payload
  };
}

/**
 * Exchanges monday's authorization code.
 *
 * First tries monday's newer OAuth 2.1 token flow.
 * If the current app version still uses the legacy
 * flow, it falls back to the older endpoint.
 */
export async function exchangeMondayCode(
  code,
  codeVerifier
) {
  const config = mondayConfig();

  if (!config) {
    throw new Error(
      'monday.com is not configured.'
    );
  }

  const modern = await tokenRequest(
    NEW_TOKEN_URL,
    {
      grant_type: 'authorization_code',

      client_id: config.clientId,
      client_secret: config.clientSecret,

      code: clean(code),

      redirect_uri: config.redirectUri,

      code_verifier: clean(codeVerifier)
    }
  );

  if (
    modern.response.ok &&
    modern.payload?.access_token
  ) {
    return {
      ...modern.payload,
      oauth_mode: 'oauth2.1'
    };
  }

  /*
   * Compatibility fallback for monday app versions
   * that still use the legacy OAuth flow.
   */
  const legacy = await tokenRequest(
    LEGACY_TOKEN_URL,
    {
      client_id: config.clientId,
      client_secret: config.clientSecret,

      code: clean(code),

      redirect_uri: config.redirectUri
    }
  );

  if (
    legacy.response.ok &&
    legacy.payload?.access_token
  ) {
    return {
      ...legacy.payload,
      oauth_mode: 'legacy'
    };
  }

  const message =
    modern.payload?.error_description ||
    modern.payload?.message ||
    modern.payload?.error ||
    legacy.payload?.error_description ||
    legacy.payload?.message ||
    legacy.payload?.error ||
    'monday.com token exchange failed.';

  const error = new Error(message);

  error.status =
    modern.response.status ||
    legacy.response.status ||
    400;

  error.payload = {
    modern: modern.payload,
    legacy: legacy.payload
  };

  throw error;
}

/**
 * Refreshes monday OAuth 2.1 tokens.
 *
 * monday refresh tokens rotate, so account-auth.js
 * must always save the new refresh token returned here.
 */
export async function refreshMondayTokens(
  refreshToken
) {
  const config = mondayConfig();

  if (!config) {
    throw new Error(
      'monday.com is not configured.'
    );
  }

  const {
    response,
    payload
  } = await tokenRequest(
    NEW_TOKEN_URL,
    {
      grant_type: 'refresh_token',

      client_id: config.clientId,
      client_secret: config.clientSecret,

      refresh_token: clean(refreshToken)
    }
  );

  if (
    !response.ok ||
    !payload?.access_token ||
    !payload?.refresh_token
  ) {
    const error = new Error(
      payload?.error_description ||
      payload?.message ||
      payload?.error ||
      'monday.com token refresh failed.'
    );

    error.status = response.status || 400;
    error.payload = payload;

    throw error;
  }

  return payload;
}

export async function revokeMondayToken(
  token,
  tokenType = 'refresh_token'
) {
  const config = mondayConfig();

  if (
    !config ||
    !clean(token)
  ) {
    return false;
  }

  const {
    response
  } = await tokenRequest(
    REVOKE_URL,
    {
      token: clean(token),

      client_id: config.clientId,
      client_secret: config.clientSecret,

      token_type_hint: tokenType
    }
  );

  return response.ok;
}

/**
 * Calculates access-token expiry.
 *
 * Uses expires_in when monday returns it.
 * Otherwise attempts to read exp from JWT tokens.
 */
export function mondayAccessExpiry(
  accessToken,
  tokens = {}
) {
  if (Number(tokens.expires_in) > 0) {
    return new Date(
      Date.now() +
      Number(tokens.expires_in) * 1000
    ).toISOString();
  }

  try {
    const parts = String(
      accessToken || ''
    ).split('.');

    if (parts.length === 3) {
      const payload = JSON.parse(
        Buffer
          .from(
            parts[1],
            'base64url'
          )
          .toString('utf8')
      );

      if (Number(payload?.exp) > 0) {
        return new Date(
          Number(payload.exp) * 1000
        ).toISOString();
      }
    }
  } catch {
    // Legacy monday tokens may not be JWTs.
  }

  return null;
}

async function graph(
  accessToken,
  query,
  variables = {}
) {
  const response = await fetch(
    API_URL,
    {
      method: 'POST',

      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',

        Authorization: accessToken,

        'API-Version': API_VERSION
      },

      body: JSON.stringify({
        query,
        variables
      })
    }
  );

  const payload = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      payload?.error_message ||
      payload?.message ||
      'monday.com API request failed.'
    );

    error.status =
      response.status ||
      400;

    error.payload = payload;

    throw error;
  }

  if (
    Array.isArray(payload?.errors) &&
    payload.errors.length
  ) {
    const message =
      payload.errors
        .map(item => item?.message)
        .filter(Boolean)
        .join(' | ') ||
      'monday.com GraphQL request failed.';

    const error = new Error(message);

    error.status = 400;
    error.payload = payload;

    throw error;
  }

  return payload?.data || {};
}

/**
 * Returns the monday user/account that authorized
 * Creative Creatures.
 */
export async function getMondayIdentity(
  accessToken
) {
  const data = await graph(
    accessToken,
    `
      query {
        me {
          id
          name
          email
          title
          is_admin
          is_guest

          account {
            id
            name
            slug
            active_members_count
          }
        }
      }
    `
  );

  const me = data?.me || {};

  return {
    userId: clean(me.id),

    userName:
      me.name ||
      '',

    userEmail:
      me.email ||
      '',

    userTitle:
      me.title ||
      '',

    isAdmin:
      Boolean(me.is_admin),

    isGuest:
      Boolean(me.is_guest),

    accountId:
      clean(me.account?.id),

    accountName:
      me.account?.name ||
      '',

    accountSlug:
      me.account?.slug ||
      '',

    activeMembers:
      Number(
        me.account?.active_members_count ||
        0
      )
  };
}

/**
 * Read-only list of monday workspaces.
 */
export async function listMondayWorkspaces(
  accessToken
) {
  const data = await graph(
    accessToken,
    `
      query {
        workspaces {
          id
          name
          kind
          description
          state
        }
      }
    `
  );

  return (
    data?.workspaces ||
    []
  )
    .map(workspace => ({
      id:
        clean(workspace.id),

      name:
        workspace.name ||
        'Workspace',

      kind:
        workspace.kind ||
        '',

      description:
        workspace.description ||
        '',

      state:
        workspace.state ||
        ''
    }))
    .filter(workspace => workspace.id)
    .slice(0, 250);
}

/**
 * Read-only list of monday boards.
 */
export async function listMondayBoards(
  accessToken
) {
  const data = await graph(
    accessToken,
    `
      query {
        boards(limit: 100) {
          id
          name
          state
          board_kind

          workspace {
            id
            name
          }

          owners {
            id
            name
          }
        }
      }
    `
  );

  return (
    data?.boards ||
    []
  )
    .map(board => ({
      id:
        clean(board.id),

      name:
        board.name ||
        'Board',

      state:
        board.state ||
        '',

      kind:
        board.board_kind ||
        '',

      workspaceId:
        clean(
          board.workspace?.id
        ),

      workspaceName:
        board.workspace?.name ||
        '',

      owners:
        Array.isArray(
          board.owners
        )
          ? board.owners.map(
            owner => ({
              id:
                clean(
                  owner.id
                ),

              name:
                owner.name ||
                'User'
            })
          )
          : []
    }))
    .filter(board => board.id);
}

/**
 * Read-only monday account users.
 */
export async function listMondayUsers(
  accessToken
) {
  const data = await graph(
    accessToken,
    `
      query {
        users(limit: 100) {
          id
          name
          email
          title
          is_admin
          is_guest
          enabled
        }
      }
    `
  );

  return (
    data?.users ||
    []
  )
    .map(user => ({
      id:
        clean(user.id),

      name:
        user.name ||
        user.email ||
        'User',

      email:
        user.email ||
        '',

      title:
        user.title ||
        '',

      isAdmin:
        Boolean(
          user.is_admin
        ),

      isGuest:
        Boolean(
          user.is_guest
        ),

      enabled:
        user.enabled !== false
    }))
    .filter(user => user.id);
}

/**
 * Loads items for one monday board.
 *
 * account-auth.js can call this for each loaded board
 * when building the Manage / Sync Now dashboard.
 */
export async function listMondayBoardItems(
  accessToken,
  boardId,
  boardName = ''
) {
  const data = await graph(
    accessToken,
    `
      query GetBoardItems(
        $boardIds: [ID!]
      ) {
        boards(
          ids: $boardIds
        ) {
          id
          name

          items_page(
            limit: 100
          ) {
            items {
              id
              name
              created_at
              updated_at

              group {
                id
                title
              }

              column_values {
                id
                text
                type

                column {
                  title
                }
              }
            }
          }
        }
      }
    `,
    {
      boardIds: [
        String(boardId)
      ]
    }
  );

  const board =
    (
      data?.boards ||
      []
    )[0] ||
    {};

  return (
    board?.items_page?.items ||
    []
  )
    .map(item => ({
      id:
        clean(item.id),

      name:
        item.name ||
        'Item',

      boardId:
        clean(
          board.id ||
          boardId
        ),

      boardName:
        board.name ||
        boardName ||
        'Board',

      groupId:
        clean(
          item.group?.id
        ),

      groupName:
        item.group?.title ||
        '',

      createdAt:
        item.created_at ||
        null,

      updatedAt:
        item.updated_at ||
        null,

      columns:
        Array.isArray(
          item.column_values
        )
          ? item.column_values
            .map(column => ({
              id:
                clean(
                  column.id
                ),

              title:
                column.column?.title ||
                column.id ||
                'Column',

              type:
                column.type ||
                '',

              text:
                column.text ||
                ''
            }))
            .filter(
              column =>
                column.text ||
                column.title
            )
          : []
    }))
    .filter(item => item.id);
}