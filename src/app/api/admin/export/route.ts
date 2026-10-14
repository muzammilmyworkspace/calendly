import { isAdmin } from '@/lib/admin';
import { listBookings, type Row } from '@/lib/bookings';
import { HOST } from '@/config/event-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fmt = (iso: string | undefined, opts: Intl.DateTimeFormatOptions) => iso ? new Intl.DateTimeFormat('nl-NL', { timeZone: HOST.timezone, ...opts }).format(new Date(iso)) : '';
// Dutch Excel opens ";"-separated files directly; quote everything so commas and line breaks in answers survive
const cell = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;

/** All bookings (coming, past, cancelled) as one spreadsheet — one column per question across all types. */
export async function GET() {
  if (!(await isAdmin())) return new Response('Niet ingelogd', { status: 401 });
  const rows: Row[] = [
    ...(await listBookings('aankomend')), ...(await listBookings('afgelopen')), ...(await listBookings('geannuleerd')),
  ];
  const questions = [...new Set(rows.flatMap((r) => r.answers.map((a) => a.label)))];
  const head = ['Status', 'Afspraak', 'Datum', 'Begin', 'Eind', 'Naam', 'E-mail', 'Geboekt op', 'Geannuleerd op', 'Geannuleerd door', 'Reden', 'Videolink', ...questions];
  const status = { aankomend: 'Gepland', afgelopen: 'Afgelopen', geannuleerd: 'Geannuleerd' } as const;
  const lines = rows.map((r) => [
    status[r.tab], r.typeName, fmt(r.start, { day: '2-digit', month: '2-digit', year: 'numeric' }), fmt(r.start, { hour: '2-digit', minute: '2-digit' }), fmt(r.end, { hour: '2-digit', minute: '2-digit' }),
    r.guestName, r.guestEmail, fmt(r.bookedAt, { dateStyle: 'short', timeStyle: 'short' }), fmt(r.cancelledAt, { dateStyle: 'short', timeStyle: 'short' }),
    r.cancelledBy ?? '', r.cancelReason ?? '', r.videoUrl ?? '',
    ...questions.map((q) => r.answers.find((a) => a.label === q)?.value ?? ''),
  ].map(cell).join(';'));
  const csv = '﻿' + [head.map(cell).join(';'), ...lines].join('\r\n');
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="afspraken-${day}.csv"` } });
}
