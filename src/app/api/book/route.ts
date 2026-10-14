import { z } from 'zod';
import { eventTypeBySlug } from '@/config/event-types';
import { BookingError, createBooking } from '@/lib/bookings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  slug: z.string().min(1).max(100),
  start: z.string().datetime(),
  name: z.string().trim().min(2, 'Vul je naam in').max(120),
  email: z.string().trim().email('Vul een geldig e-mailadres in').max(200),
  answers: z.record(z.string(), z.string().max(3000)).default({}),
  /** honeypot: invisible to people, bots fill it in */
  company: z.string().max(0).optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : 'Ongeldige aanvraag';
    return Response.json({ error: msg }, { status: 400 });
  }
  const type = eventTypeBySlug(body.slug);
  if (!type) return Response.json({ error: 'Onbekend type afspraak.' }, { status: 404 });
  const missing = type.questions.find((q) => q.required && !(body.answers[q.id] ?? '').trim());
  if (missing) return Response.json({ error: `Beantwoord ook: ${missing.label}` }, { status: 400 });
  try {
    return Response.json({ ok: true, ...(await createBooking(body)) });
  } catch (e) {
    if (e instanceof BookingError) return Response.json({ error: e.message }, { status: 409 });
    console.error('book', e);
    return Response.json({ error: 'Er ging iets mis bij het boeken. Probeer het opnieuw of mail ons.' }, { status: 500 });
  }
}
