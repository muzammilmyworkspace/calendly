import { NextRequest } from 'next/server';
import { eventTypeBySlug } from '@/config/event-types';
import { availableSlots, getBooking } from '@/lib/bookings';
import { verify } from '@/lib/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const type = eventTypeBySlug(p.get('slug') ?? '');
  const from = p.get('from') ?? '', to = p.get('to') ?? '';
  if (!type || !DAY.test(from) || !DAY.test(to)) return Response.json({ error: 'Ongeldige aanvraag' }, { status: 400 });
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > 45) return Response.json({ error: 'Periode te lang' }, { status: 400 });
  try {
    // when moving a booking, its own time slot must not count as busy
    let ignore: { start: string; end: string } | undefined;
    const id = p.get('id'), t = p.get('t');
    if (id && t && verify(id, t)) {
      const b = await getBooking(id);
      if (b) ignore = { start: b.ev.start!.dateTime!, end: b.ev.end!.dateTime! };
    }
    return Response.json({ slots: await availableSlots(type, from, to, ignore) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('slots', e);
    return Response.json({ error: 'Beschikbaarheid kon niet worden geladen. Probeer het zo opnieuw.' }, { status: 500 });
  }
}
