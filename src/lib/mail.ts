/** Mails go out through Gmail as the host mailbox, so replies land in the normal inbox. */
import { google } from './google';
import { env } from './env';
import { HOST } from '@/config/event-types';

export type MailBooking = {
  typeName: string;
  startIso: string;
  minutes: number;
  guestName: string;
  guestEmail: string;
  videoUrl?: string;
  manageUrl: string;
  answers: { label: string; value: string }[];
};

export const when = (iso: string) => new Intl.DateTimeFormat('nl-NL', {
  timeZone: HOST.timezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(iso));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

async function send(to: string[], subject: string, html: string, text: string) {
  if (!to.length) return;
  const boundary = 'mc' + Date.now().toString(36);
  const raw = [
    `From: "${HOST.company}" <${env.hostEmail}>`,
    `To: ${to.join(', ')}`,
    `Reply-To: ${env.hostEmail}`,
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(text),
    `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(html),
    `--${boundary}--`,
  ].join('\r\n');
  await google().mail.users.messages.send({ userId: 'me', requestBody: { raw: Buffer.from(raw).toString('base64url') } });
}

// same colours as the booking pages: ink header with the gold wordmark, cream page, gold accents
function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#FAF6EF;font-family:Inter,'Segoe UI',Arial,sans-serif;color:#1C1A16">
<div style="max-width:580px;margin:0 auto;padding:28px 16px">
<div style="background:#0A0A0B;border-radius:18px 18px 0 0;padding:22px 30px;font-weight:600;letter-spacing:6px;font-size:11px;color:#D7B679">MAIN&nbsp;CHARACTER</div>
<div style="background:#ffffff;border:1px solid #E8DFD0;border-top:0;border-radius:0 0 18px 18px;padding:32px 30px;line-height:1.6;font-size:15px">
<h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:28px;line-height:1.15;margin:0 0 20px">${esc(title)}</h1>${body}</div>
<div style="font-size:12px;color:#6B6152;margin-top:16px;text-align:center">Vragen? Antwoord gewoon op deze mail.</div></div></body></html>`;
}
const button = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#1C1A16;color:#FAF6EF;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:600;font-size:14px">${esc(label)}</a>`;
function details(b: MailBooking) {
  return `<div style="background:#FAF6EF;border-left:3px solid #B8925A;border-radius:10px;padding:16px 18px;margin:0 0 22px">
<p style="margin:0 0 6px;font-weight:600">${esc(b.typeName)}</p>
<p style="margin:0 0 4px;color:#1C1A16">${esc(when(b.startIso))} · ${b.minutes} minuten</p>
${b.videoUrl ? `<p style="margin:6px 0 0"><a href="${esc(b.videoUrl)}" style="color:#82623A;font-weight:600">Deelnemen aan het gesprek →</a></p>` : ''}</div>`;
}
const detailsText = (b: MailBooking) => `${b.typeName}\n${when(b.startIso)} (${b.minutes} min)\n${b.videoUrl ? `Link: ${b.videoUrl}\n` : ''}`;
function answersHtml(b: MailBooking) {
  if (!b.answers.length) return '';
  return `<hr style="border:0;border-top:1px solid #eee;margin:18px 0"><p style="margin:0 0 8px;font-weight:bold">Antwoorden</p>` +
    b.answers.map((a) => `<p style="margin:0 0 10px"><span style="color:#777;font-size:13px">${esc(a.label)}</span><br>${esc(a.value || '—').replace(/\n/g, '<br>')}</p>`).join('');
}
const answersText = (b: MailBooking) => b.answers.map((a) => `\n${a.label}\n${a.value || '—'}`).join('\n');

export async function mailConfirmed(b: MailBooking) {
  await send([b.guestEmail], `Bevestigd: ${b.typeName} — ${when(b.startIso)}`,
    layout(`Je afspraak staat, ${b.guestName.split(' ')[0]}!`, `${details(b)}<p>Je ontvangt ook een agenda-uitnodiging.</p><p>${button(b.manageUrl, 'Verzetten of annuleren')}</p>${answersHtml(b)}`),
    `Je afspraak staat!\n\n${detailsText(b)}\nVerzetten of annuleren: ${b.manageUrl}\n${answersText(b)}`);
}
export async function mailRescheduled(b: MailBooking) {
  await send([b.guestEmail], `Verzet: ${b.typeName} — ${when(b.startIso)}`,
    layout('Je afspraak is verzet', `<p>Nieuwe tijd:</p>${details(b)}<p>${button(b.manageUrl, 'Opnieuw verzetten of annuleren')}</p>`),
    `Je afspraak is verzet.\n\n${detailsText(b)}\nVerzetten of annuleren: ${b.manageUrl}`);
}
export async function mailCancelled(b: MailBooking, rebookUrl: string) {
  await send([b.guestEmail], `Geannuleerd: ${b.typeName} — ${when(b.startIso)}`,
    layout('Je afspraak is geannuleerd', `${details({ ...b, videoUrl: undefined })}<p>Toch een nieuwe tijd plannen?</p><p>${button(rebookUrl, 'Nieuwe afspraak maken')}</p>`),
    `Je afspraak is geannuleerd.\n\n${detailsText({ ...b, videoUrl: undefined })}\nNieuwe afspraak: ${rebookUrl}`);
}
export async function mailReminder(b: MailBooking, label: string) {
  await send([b.guestEmail], `Herinnering: ${b.typeName} ${label}`,
    layout(`Tot ${label}!`, `${details(b)}<p>${button(b.manageUrl, 'Verzetten of annuleren')}</p>`),
    `Herinnering — ${label}\n\n${detailsText(b)}\nVerzetten of annuleren: ${b.manageUrl}`);
}
/** a copy for the team, the way Calendly sent "New Event" to info@ */
export async function mailTeam(kind: 'Nieuw' | 'Verzet' | 'Geannuleerd', b: MailBooking, extra = '') {
  await send(env.notifyEmails, `${kind}: ${b.typeName} — ${b.guestName} — ${when(b.startIso)}`,
    layout(`${kind}: ${b.guestName}`, `${details(b)}<p>${esc(b.guestName)} · <a href="mailto:${esc(b.guestEmail)}">${esc(b.guestEmail)}</a></p>${extra ? `<p>${esc(extra)}</p>` : ''}${answersHtml(b)}`),
    `${kind}: ${b.guestName} <${b.guestEmail}>\n\n${detailsText(b)}${extra ? `\n${extra}\n` : ''}${answersText(b)}`);
}
