import { ADMIN_COOKIE } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return new Response(null, {
    status: 303,
    headers: { Location: new URL('/beheer/login', req.url).toString(), 'Set-Cookie': `${ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax` },
  });
}
