import { z } from 'zod';
import { BookingError, cancelBooking, rescheduleBooking } from '@/lib/bookings';
import { verify } from '@/lib/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('cancel'), id: z.string(), t: z.string(), reason: z.string().max(1000).default('') }),
  z.object({ action: z.literal('reschedule'), id: z.string(), t: z.string(), start: z.string().datetime() }),
]);

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); } catch { return Response.json({ error: 'Ongeldige aanvraag' }, { status: 400 }); }
  if (!verify(body.id, body.t)) return Response.json({ error: 'Deze link is niet geldig.' }, { status: 403 });
  try {
    if (body.action === 'cancel') { await cancelBooking(body.id, body.reason); return Response.json({ ok: true }); }
    return Response.json({ ok: true, ...(await rescheduleBooking(body.id, body.start)) });
  } catch (e) {
    if (e instanceof BookingError) return Response.json({ error: e.message }, { status: 409 });
    console.error('manage', e);
    return Response.json({ error: 'Er ging iets mis. Probeer het opnieuw of mail ons.' }, { status: 500 });
  }
}
