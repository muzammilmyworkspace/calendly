import { sendDueReminders } from '@/lib/bookings';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Called every 15 minutes by an outside scheduler (cron-job.org, free). Not by Vercel Cron: on the Hobby plan
 * Vercel only allows one cron run a day, and a deployment that asks for more is refused outright.
 * The secret may come as "Authorization: Bearer <CRON_SECRET>" or as ?key=<CRON_SECRET>, for schedulers
 * that cannot set headers.
 */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key');
  const ok = !!env.cronSecret && (req.headers.get('authorization') === `Bearer ${env.cronSecret}` || key === env.cronSecret);
  if (!ok) return new Response('Unauthorized', { status: 401 });
  try { return Response.json({ sent: await sendDueReminders() }); }
  catch (e) { console.error('reminders', e); return Response.json({ error: String(e) }, { status: 500 }); }
}
