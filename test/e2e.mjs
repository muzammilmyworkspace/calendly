/**
 * End-to-end against a running server and the real Google Calendar (use a TEST calendar!).
 *   npx next start -p 3005   then   node test/e2e.mjs
 * Books, double-books, opens the manage page, moves, cancels, and runs the reminder job.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { calendar } from '@googleapis/calendar';
import { OAuth2Client } from 'google-auth-library';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const BASE = 'http://localhost:3005';
const GUEST = 'muzammilasrar132@gmail.com';
const sign = (id) => crypto.createHmac('sha256', env.BOOKING_SECRET).update(id).digest('base64url').slice(0, 24);
const auth = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET); auth.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });
const cal = calendar({ version: 'v3', auth });
const CAL = env.HOST_CALENDAR_ID;

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✅' : '❌'} ${name}${extra ? '  — ' + extra : ''}`); };
const json = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (p, b) => fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(json);
const ams = (iso) => new Date(iso).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }

// 1. pages
check('overzichtspagina laadt', (await fetch(BASE + '/')).ok);
const bp = await fetch(BASE + '/strategie-call'); const bpHtml = await bp.text();
check('boekingspagina laadt', bp.ok && bpHtml.includes('Strategie-call'));
check('onbekende afspraak geeft 404', (await fetch(BASE + '/bestaat-niet')).status === 404);

// 2. availability
const day = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const s = await fetch(`${BASE}/api/slots?slug=strategie-call&from=${day(1)}&to=${day(14)}`).then(json);
check('vrije tijden opgehaald', s.status === 200 && s.body.slots?.length > 0, `${s.body.slots?.length} tijden in 2 weken`);
const weekendHit = (s.body.slots ?? []).filter((x) => ['za', 'zo'].includes(new Date(x).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short' }).slice(0, 2)));
check('geen tijden in het weekend', weekendHit.length === 0);
// real busy time from the primary calendar must not be offered
const fb = await cal.freebusy.query({ requestBody: { timeMin: new Date(`${day(1)}T00:00:00Z`).toISOString(), timeMax: new Date(`${day(14)}T23:59:59Z`).toISOString(), items: [{ id: 'primary' }] } });
const realBusy = fb.data.calendars.primary.busy ?? [];
const clash = (s.body.slots ?? []).filter((x) => { const a = Date.parse(x), b = a + 15 * 60000; return realBusy.some((r) => a < Date.parse(r.end) && Date.parse(r.start) < b); });
check('bezette tijden uit Onyema\'s agenda worden NIET aangeboden', clash.length === 0, `${realBusy.length} bezette blokken gecontroleerd`);

// 3. validation
check('ongeldig e-mailadres geweigerd', (await post('/api/book', { slug: 'strategie-call', start: s.body.slots[0], name: 'Test', email: 'geen-email', answers: {} })).status === 400);
check('verplichte vraag leeg geweigerd', (await post('/api/book', { slug: 'strategie-call', start: s.body.slots[0], name: 'Test', email: GUEST, answers: {} })).status === 400);
check('bot (honeypot) geweigerd', (await post('/api/book', { slug: 'strategie-call', start: s.body.slots[0], name: 'Test', email: GUEST, company: 'spam', answers: {} })).status === 400);
check('tijd buiten de werkuren geweigerd', (await post('/api/book', { slug: 'strategie-call', start: `${day(3)}T02:00:00.000Z`, name: 'Test', email: GUEST, answers: Object.fromEntries(['bedrijf', 'kanalen', 'droom', 'belemmeringen', 'hulp', 'samenwerken', 'investeren'].map((k) => [k, 'x'])) })).status === 409);

// 4. book
const answers = { bedrijf: 'TEST — Muzammil', kanalen: '-', droom: 'Test van de eigen boekingstool', belemmeringen: '-', hulp: '-', samenwerken: '-', investeren: '-' };
const slot = s.body.slots[2];
const b = await post('/api/book', { slug: 'strategie-call', start: slot, name: 'TEST Muzammil', email: GUEST, answers });
check('afspraak geboekt', b.status === 200 && b.body.ok, `${ams(slot)} · ${b.body.error ?? ''}`);
const id = b.body.id;
const ev = id ? (await cal.events.get({ calendarId: CAL, eventId: id })).data : null;
check('staat in de agenda', !!ev && ev.status !== 'cancelled');
check('gast is uitgenodigd', ev?.attendees?.some((a) => a.email === GUEST));
check('videolink aangemaakt', !!(ev?.hangoutLink || ev?.location), ev?.hangoutLink || ev?.location);
check('antwoorden staan in de afspraak', ev?.description?.includes('Test van de eigen boekingstool'));

// 5. double booking
check('dezelfde tijd 2× boeken wordt geweigerd', (await post('/api/book', { slug: 'strategie-call', start: slot, name: 'Tweede', email: GUEST, answers })).status === 409);
const s2 = await fetch(`${BASE}/api/slots?slug=strategie-call&from=${slot.slice(0, 10)}&to=${slot.slice(0, 10)}`).then(json);
check('geboekte tijd verdwijnt uit de lijst', !s2.body.slots.includes(slot));

// 6. manage page + bad token
const mp = await fetch(`${BASE}/b/${id}?t=${sign(id)}`); const mpHtml = await mp.text();
check('beheerpagina opent met juiste link', mp.ok && mpHtml.includes('Verzetten'));
check('beheerpagina weigert verkeerde link', (await fetch(`${BASE}/b/${id}?t=fout`).then((r) => r.text())).includes('niet gevonden'));
check('annuleren met verkeerde link geweigerd', (await post('/api/manage', { action: 'cancel', id, t: 'fout' })).status === 403);

// 7. reschedule
const s3 = await fetch(`${BASE}/api/slots?slug=strategie-call&from=${day(1)}&to=${day(14)}&id=${id}&t=${sign(id)}`).then(json);
const newSlot = s3.body.slots.find((x) => x !== slot && x > slot);
const rs = await post('/api/manage', { action: 'reschedule', id, t: sign(id), start: newSlot });
const ev2 = (await cal.events.get({ calendarId: CAL, eventId: id })).data;
check('afspraak verzet', rs.status === 200 && Date.parse(ev2.start.dateTime) === Date.parse(newSlot), `${ams(slot)} → ${ams(newSlot)}`);

// 8. reminders: pretend it was booked 2 days ago and starts in under 24 h
const soon = s.body.slots.find((x) => Date.parse(x) - Date.now() < 23 * 3600000 && Date.parse(x) - Date.now() > 2 * 3600000);
if (soon) {
  await cal.events.patch({ calendarId: CAL, eventId: id, sendUpdates: 'none', requestBody: { start: { dateTime: soon }, end: { dateTime: new Date(Date.parse(soon) + 900000).toISOString() }, extendedProperties: { private: { ...ev2.extendedProperties.private, bookedAt: new Date(Date.now() - 2 * 86400000).toISOString(), r24: '0', r1: '0' } } } });
  check('herinneringsjob zonder sleutel geweigerd', (await fetch(BASE + '/api/cron/reminders')).status === 401);
  const r1 = await fetch(BASE + '/api/cron/reminders', { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } }).then(json);
  check('herinnering verstuurd', r1.body.sent === 1, JSON.stringify(r1.body));
  const r2 = await fetch(BASE + '/api/cron/reminders', { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } }).then(json);
  check('herinnering niet dubbel', r2.body.sent === 0);
} else console.log('⏭  herinnering overgeslagen: geen vrije tijd binnen 2–23 uur');

// 9. cancel
const c = await post('/api/manage', { action: 'cancel', id, t: sign(id), reason: 'Einde test' });
const ev3 = await cal.events.get({ calendarId: CAL, eventId: id }).then((r) => r.data).catch(() => null);
check('afspraak geannuleerd', c.status === 200 && (!ev3 || ev3.status === 'cancelled'));
check('geannuleerde afspraak opent niet meer', (await fetch(`${BASE}/b/${id}?t=${sign(id)}`).then((r) => r.text())).includes('niet gevonden'));

// 10. cancelled = kept, in the archive calendar, not deleted
const ARCH = env.ARCHIVE_CALENDAR_ID;
const arch = await cal.events.get({ calendarId: ARCH, eventId: id }).then((r) => r.data).catch(() => null);
check('geannuleerde afspraak bewaard in het archief', arch?.extendedProperties?.private?.state === 'cancelled');
check('archief blokkeert geen tijd en gast is eraf', arch?.transparency === 'transparent' && !(arch?.attendees ?? []).length);
check('reden en wie annuleerde zijn bewaard', arch?.extendedProperties?.private?.cancelReason === 'Einde test' && arch?.extendedProperties?.private?.cancelledBy === 'gast');

// 11. overview (/beheer)
const noFollow = { redirect: 'manual' };
const gate = await fetch(BASE + '/beheer', noFollow);
check('beheer zonder login stuurt naar inloggen', [302, 303, 307, 308].includes(gate.status) && (gate.headers.get('location') ?? '').includes('/beheer/login'));
const login = (pw) => fetch(BASE + '/api/admin/login', { method: 'POST', body: new URLSearchParams({ password: pw }), ...noFollow });
const bad = await login('fout-wachtwoord');
check('fout wachtwoord geweigerd', (bad.headers.get('location') ?? '').includes('fout=1') && !bad.headers.get('set-cookie'));
const good = await login(env.ADMIN_PASSWORD);
const cookie = (good.headers.get('set-cookie') ?? '').split(';')[0];
check('juist wachtwoord logt in', cookie.startsWith('mc_beheer='));
check('export zonder login geweigerd', (await fetch(BASE + '/api/admin/export')).status === 401);
const page = (tab) => fetch(`${BASE}/beheer?tab=${tab}`, { headers: { cookie } }).then((r) => r.text());

// a second booking, cancelled by the team from the overview
const s4 = await fetch(`${BASE}/api/slots?slug=strategie-call&from=${day(2)}&to=${day(14)}`).then(json);
const b2 = await post('/api/book', { slug: 'strategie-call', start: s4.body.slots[1], name: 'TEST Overzicht', email: GUEST, answers });
const id2 = b2.body.id;
const up = await page('aankomend');
check('nieuwe afspraak staat in "Aankomend"', up.includes('TEST Overzicht') && up.includes('Test van de eigen boekingstool'));
const csv = await fetch(BASE + '/api/admin/export', { headers: { cookie } }).then((r) => r.text());
check('Excel-export bevat de afspraak met antwoorden', csv.includes('TEST Overzicht') && csv.includes('Test van de eigen boekingstool') && csv.includes('Wat is op dit moment je grootste droom'));
const tc = await fetch(BASE + '/api/manage', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ action: 'cancel', id: id2, t: sign(id2), reason: 'Team-test' }) }).then(json);
const arch2 = await cal.events.get({ calendarId: ARCH, eventId: id2 }).then((r) => r.data).catch(() => null);
check('team kan annuleren — staat als "door team"', tc.status === 200 && arch2?.extendedProperties?.private?.cancelledBy === 'team', `boeking ${b2.status} ${b2.body.error ?? ''} · annuleren ${tc.status} ${tc.body.error ?? ''} · archief: ${arch2 ? (arch2.extendedProperties?.private?.cancelledBy ?? 'GEEN props') : 'NIET GEVONDEN'}`);
const gone = await page('geannuleerd');
check('beide annuleringen staan in "Geannuleerd"', gone.includes('TEST Overzicht') && gone.includes('TEST Muzammil') && gone.includes('door team') && gone.includes('door gast'));

console.log(`\n${pass} geslaagd, ${fail} mislukt`);
process.exit(fail ? 1 : 0);
