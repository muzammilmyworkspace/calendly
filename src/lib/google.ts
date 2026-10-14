/**
 * Google access. Two ways, the first is for production:
 *
 * 1. Service account with domain-wide delegation (GOOGLE_SERVICE_ACCOUNT_JSON + HOST_EMAIL).
 *    Never expires. A Workspace admin allows it once in the Admin console — see README.
 * 2. OAuth refresh token (GOOGLE_CLIENT_ID / _SECRET / _REFRESH_TOKEN) — fine for testing, but a token
 *    from an app in "Testing" mode stops working after 7 days.
 */
import { calendar } from '@googleapis/calendar';
import { gmail } from '@googleapis/gmail';
import { JWT, OAuth2Client } from 'google-auth-library';
import { env } from './env';

const SCOPES = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/gmail.send'];

function makeAuth() {
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (sa) {
    const key = JSON.parse(sa);
    return new JWT({ email: key.client_email, key: key.private_key, scopes: SCOPES, subject: env.hostEmail });
  }
  const id = process.env.GOOGLE_CLIENT_ID, secret = process.env.GOOGLE_CLIENT_SECRET, refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!id || !secret || !refresh) throw new Error('Geen Google-toegang ingesteld: GOOGLE_SERVICE_ACCOUNT_JSON of GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN');
  const o = new OAuth2Client(id, secret);
  o.setCredentials({ refresh_token: refresh });
  return o;
}

/**
 * Google answers a burst of calendar writes with "Rate Limit Exceeded" (a 403, not only a 429). Without a
 * retry, a cancellation could stop halfway: guest removed, event moved, but its details not yet written.
 * So every call waits and tries again — 1, 2, 4, 8 seconds — before it gives up.
 */
const retry = {
  retry: true,
  retryConfig: {
    retry: 4, retryDelay: 1000, retryDelayMultiplier: 2,
    statusCodesToRetry: [[403, 403], [429, 429], [500, 599]],
    httpMethodsToRetry: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE'],
  },
};

let clients: { cal: ReturnType<typeof calendar>; mail: ReturnType<typeof gmail> } | null = null;
export function google() {
  if (!clients) {
    const auth = makeAuth();
    clients = { cal: calendar({ version: 'v3', auth, ...retry }), mail: gmail({ version: 'v1', auth, ...retry }) };
  }
  return clients;
}
