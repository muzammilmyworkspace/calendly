/**
 * Zoom meetings through a Server-to-Server OAuth app (Zoom Marketplace → Develop → Build app →
 * Server-to-Server OAuth, scopes meeting:write:meeting:admin + meeting:update/delete). Free on the Pro plan.
 */
import { env } from './env';

let token: { value: string; until: number } | null = null;

async function accessToken() {
  if (token && token.until > Date.now() + 60_000) return token.value;
  const basic = Buffer.from(`${env.zoom.clientId}:${env.zoom.clientSecret}`).toString('base64');
  const r = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(env.zoom.accountId)}`, {
    method: 'POST', headers: { Authorization: `Basic ${basic}` },
  });
  if (!r.ok) throw new Error(`Zoom login mislukt: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, until: Date.now() + j.expires_in * 1000 };
  return token.value;
}

async function call(method: string, path: string, body?: unknown) {
  const r = await fetch(`https://api.zoom.us/v2${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok && r.status !== 404) throw new Error(`Zoom ${method} ${path}: ${r.status} ${await r.text()}`);
  return r.status === 204 || r.status === 404 ? null : r.json();
}

export async function createZoomMeeting(topic: string, startIso: string, minutes: number, timezone: string) {
  const m = (await call('POST', `/users/${encodeURIComponent(env.zoom.user)}/meetings`, {
    topic, type: 2, start_time: new Date(startIso).toISOString().replace(/\.\d{3}Z$/, 'Z'), duration: minutes, timezone,
    settings: { join_before_host: false, waiting_room: true, approval_type: 2 },
  })) as { id: number; join_url: string };
  return { id: String(m.id), url: m.join_url };
}
export const moveZoomMeeting = (id: string, startIso: string, minutes: number) =>
  call('PATCH', `/meetings/${id}`, { start_time: new Date(startIso).toISOString().replace(/\.\d{3}Z$/, 'Z'), duration: minutes });
export const deleteZoomMeeting = (id: string) => call('DELETE', `/meetings/${id}?schedule_for_reminder=false`);
