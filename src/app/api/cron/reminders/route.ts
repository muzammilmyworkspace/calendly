import { sendDueReminders } from '@/lib/bookings';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Vercel Cron calls this every 15 minutes (vercel.json) with "Authorization: Bearer <CRON_SECRET>". */
export async function GET(req: Request) {
  if (!env.cronSecret || req.headers.get('authorization') !== `Bearer ${env.cronSecret}`) return new Response('Unauthorized', { status: 401 });
  try { return Response.json({ sent: await sendDueReminders() }); }
  catch (e) { console.error('reminders', e); return Response.json({ error: String(e) }, { status: 500 }); }
}
