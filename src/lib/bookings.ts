/**
 * Bookings live in the host's Google Calendar — there is no separate database. Each booking is an event
 * with our own id and a private "mcBooking" marker, so the calendar Onyema already looks at is the single
 * source of truth: move it there, delete it there, and the tool sees that.
 */
import type { calendar_v3 } from '@googleapis/calendar';
import { DateTime } from 'luxon';
import { AVAILABILITY, EVENT_TYPES, HOST, eventTypeBySlug, type EventType } from '@/config/event-types';
import { computeSlots, type Busy } from './slots';
import { google } from './google';
import { env } from './env';
import { newBookingId, manageUrl } from './tokens';
import { createZoomMeeting, deleteZoomMeeting, moveZoomMeeting } from './zoom';
import { mailCancelled, mailConfirmed, mailReminder, mailRescheduled, mailTeam, type MailBooking } from './mail';

export class BookingError extends Error {}
type Ev = calendar_v3.Schema$Event;

const rules = { ...AVAILABILITY, timezone: HOST.timezone };
export const hostDay = (iso: string) => DateTime.fromISO(iso, { zone: HOST.timezone }).toISODate()!;
const mailSafe = async (what: string, f: () => Promise<unknown>) => { try { await f(); } catch (e) { console.error(`mail ${what} mislukt:`, e); } };

async function busy(timeMin: string, timeMax: string): Promise<Busy[]> {
  const r = await google().cal.freebusy.query({ requestBody: { timeMin, timeMax, timeZone: HOST.timezone, items: env.busyCalendarIds.map((id) => ({ id })) } });
  return Object.values(r.data.calendars ?? {}).flatMap((c) => (c.busy ?? []).map((b) => ({ start: b.start!, end: b.end! })));
}

async function ourEvents(timeMin: string, timeMax: string): Promise<Ev[]> {
  const out: Ev[] = []; let pageToken: string | undefined;
  do {
    const r = await google().cal.events.list({ calendarId: env.hostCalendarId, timeMin, timeMax, singleEvents: true, privateExtendedProperty: ['mcBooking=1'], maxResults: 250, pageToken });
    out.push(...(r.data.items ?? [])); pageToken = r.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

/** free start times for a type between two days (YYYY-MM-DD, host time); `ignore` leaves one booking out — used when moving it */
export async function availableSlots(type: EventType, fromDay: string, toDay: string, ignore?: { start: string; end: string }) {
  const timeMin = DateTime.fromISO(fromDay, { zone: HOST.timezone }).startOf('day').toUTC().toISO()!;
  const timeMax = DateTime.fromISO(toDay, { zone: HOST.timezone }).endOf('day').toUTC().toISO()!;
  let b = await busy(timeMin, timeMax);
  if (ignore) b = b.filter((x) => !(Date.parse(x.start) === Date.parse(ignore.start) && Date.parse(x.end) === Date.parse(ignore.end)));
  let bookedPerDay: Record<string, number> | undefined;
  if (AVAILABILITY.maxPerDay > 0) {
    bookedPerDay = {};
    for (const e of await ourEvents(timeMin, timeMax)) if (e.start?.dateTime) bookedPerDay[hostDay(e.start.dateTime)] = (bookedPerDay[hostDay(e.start.dateTime)] ?? 0) + 1;
  }
  return computeSlots({ rules, minutes: type.minutes, fromDay, toDay, now: new Date(), busy: b, bookedPerDay });
}

const answersText = (type: EventType, answers: Record<string, string>) =>
  type.questions.map((q) => ({ label: q.label, value: (answers[q.id] ?? '').trim() }));

function toMail(ev: Ev, type: EventType): MailBooking {
  const p = ev.extendedProperties?.private ?? {};
  return {
    typeName: type.name, startIso: ev.start!.dateTime!, minutes: type.minutes,
    guestName: p.guestName ?? '', guestEmail: p.guestEmail ?? '',
    videoUrl: p.videoUrl || ev.hangoutLink || undefined, manageUrl: manageUrl(ev.id!), answers: [],
  };
}

export async function createBooking(input: { slug: string; start: string; name: string; email: string; answers: Record<string, string> }) {
  const type = eventTypeBySlug(input.slug);
  if (!type) throw new BookingError('Onbekend type afspraak.');
  const start = new Date(input.start).toISOString();
  // check again now: the page may have been open while someone else took this time
  const day = hostDay(start);
  if (!(await availableSlots(type, day, day)).includes(start)) throw new BookingError('Deze tijd is net bezet of niet meer beschikbaar. Kies een andere tijd.');

  const end = new Date(Date.parse(start) + type.minutes * 60_000).toISOString();
  const id = newBookingId();
  const answers = answersText(type, input.answers);
  let zoom: { id: string; url: string } | null = null;
  if (type.video === 'zoom' && env.zoom.enabled) zoom = await createZoomMeeting(`${type.name} — ${input.name}`, start, type.minutes, HOST.timezone);

  const description = [
    `Geboekt via MAIN CHARACTER afspraken.`,
    `Gast: ${input.name} <${input.email}>`,
    zoom ? `Zoom: ${zoom.url}` : '',
    `Verzetten of annuleren: ${manageUrl(id)}`,
    ...answers.map((a) => `\n${a.label}\n${a.value || '—'}`),
  ].filter(Boolean).join('\n');

  let ev: Ev;
  try {
    ev = (await google().cal.events.insert({
      calendarId: env.hostCalendarId, sendUpdates: 'all', conferenceDataVersion: zoom ? 0 : 1,
      requestBody: {
        id, summary: `${type.name} — ${input.name}`, description,
        start: { dateTime: start, timeZone: HOST.timezone }, end: { dateTime: end, timeZone: HOST.timezone },
        attendees: [{ email: input.email, displayName: input.name }],
        location: zoom?.url,
        conferenceData: zoom ? undefined : { createRequest: { requestId: id, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
        extendedProperties: { private: {
          mcBooking: '1', slug: type.slug, guestName: input.name.slice(0, 200), guestEmail: input.email,
          videoUrl: zoom?.url ?? '', zoomId: zoom?.id ?? '', bookedAt: new Date().toISOString(), r24: '0', r1: '0',
        } },
      },
    })).data;
  } catch (e) {
    if (zoom) await deleteZoomMeeting(zoom.id).catch(() => {});   // no orphan Zoom meeting when the calendar refuses
    throw e;
  }
  const mb = { ...toMail(ev, type), answers };
  await mailSafe('bevestiging', () => mailConfirmed(mb));
  await mailSafe('team', () => mailTeam('Nieuw', mb));
  return { id, start, end, videoUrl: mb.videoUrl, typeName: type.name };
}

export async function getBooking(id: string) {
  try {
    const ev = (await google().cal.events.get({ calendarId: env.hostCalendarId, eventId: id })).data;
    if (ev.extendedProperties?.private?.mcBooking !== '1' || ev.status === 'cancelled') return null;
    const type = eventTypeBySlug(ev.extendedProperties.private.slug ?? '');
    return type ? { ev, type } : null;
  } catch { return null; }
}

export async function cancelBooking(id: string, reason: string) {
  const b = await getBooking(id);
  if (!b) throw new BookingError('Deze afspraak bestaat niet (meer).');
  const mb = toMail(b.ev, b.type);
  const zoomId = b.ev.extendedProperties?.private?.zoomId;
  await google().cal.events.delete({ calendarId: env.hostCalendarId, eventId: id, sendUpdates: 'all' });
  if (zoomId) await deleteZoomMeeting(zoomId).catch((e) => console.error('zoom verwijderen mislukt', e));
  await mailSafe('annulering', () => mailCancelled(mb, `${env.publicUrl}/${b.type.slug}`));
  await mailSafe('team', () => mailTeam('Geannuleerd', mb, reason ? `Reden: ${reason}` : ''));
}

export async function rescheduleBooking(id: string, newStartIso: string) {
  const b = await getBooking(id);
  if (!b) throw new BookingError('Deze afspraak bestaat niet (meer).');
  const start = new Date(newStartIso).toISOString();
  const day = hostDay(start);
  const own = { start: b.ev.start!.dateTime!, end: b.ev.end!.dateTime! };
  if (!(await availableSlots(b.type, day, day, own)).includes(start)) throw new BookingError('Deze tijd is net bezet of niet meer beschikbaar. Kies een andere tijd.');
  const end = new Date(Date.parse(start) + b.type.minutes * 60_000).toISOString();
  const p = b.ev.extendedProperties!.private!;
  const ev = (await google().cal.events.patch({
    calendarId: env.hostCalendarId, eventId: id, sendUpdates: 'all',
    requestBody: {
      start: { dateTime: start, timeZone: HOST.timezone }, end: { dateTime: end, timeZone: HOST.timezone },
      extendedProperties: { private: { ...p, r24: '0', r1: '0', bookedAt: new Date().toISOString() } },
    },
  })).data;
  if (p.zoomId) await moveZoomMeeting(p.zoomId, start, b.type.minutes).catch((e) => console.error('zoom verzetten mislukt', e));
  const mb = toMail(ev, b.type);
  await mailSafe('verzet', () => mailRescheduled(mb));
  await mailSafe('team', () => mailTeam('Verzet', mb, `Was: ${new Date(own.start).toLocaleString('nl-NL', { timeZone: HOST.timezone })}`));
  return { start, end };
}

/**
 * Called every 15 minutes. A reminder the day before and one an hour before — but not when the call was
 * booked so late that the confirmation mail itself is the reminder.
 */
export async function sendDueReminders(now = new Date()) {
  const events = await ourEvents(now.toISOString(), new Date(now.getTime() + 25 * 3600_000).toISOString());
  let sent = 0;
  for (const ev of events) {
    const p = ev.extendedProperties?.private ?? {};
    const type = eventTypeBySlug(p.slug ?? ''); if (!type || !ev.start?.dateTime) continue;
    const startMs = Date.parse(ev.start.dateTime), mins = (startMs - now.getTime()) / 60_000;
    const leadMins = (startMs - Date.parse(p.bookedAt || ev.created || now.toISOString())) / 60_000;
    let label = '', patch: Record<string, string> | null = null;
    if (mins <= 75 && p.r1 !== '1') { if (leadMins > 120) label = 'straks'; patch = { r1: '1', r24: '1' }; }
    else if (mins <= 24 * 60 && p.r24 !== '1') { if (leadMins > 26 * 60) label = hostDay(ev.start.dateTime) === hostDay(new Date(now.getTime() + 86_400_000).toISOString()) ? 'morgen' : 'binnenkort'; patch = { r24: '1' }; }
    if (!patch) continue;
    if (label) { await mailSafe('herinnering', () => mailReminder(toMail(ev, type), label)); sent++; }
    await google().cal.events.patch({ calendarId: env.hostCalendarId, eventId: ev.id!, sendUpdates: 'none', requestBody: { extendedProperties: { private: { ...p, ...patch } } } });
  }
  return sent;
}

export const listedTypes = () => EVENT_TYPES.filter((t) => t.listed);
