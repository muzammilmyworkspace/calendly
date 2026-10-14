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

let clients: { cal: ReturnType<typeof calendar>; mail: ReturnType<typeof gmail> } | null = null;
export function google() {
  if (!clients) {
    const auth = makeAuth();
    clients = { cal: calendar({ version: 'v3', auth }), mail: gmail({ version: 'v1', auth }) };
  }
  return clients;
}
