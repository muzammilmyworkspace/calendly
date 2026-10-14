import { ADMIN_COOKIE, newSession, passwordOk } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const pw = String((await req.formData()).get('password') ?? '');
  const to = (path: string) => new URL(path, req.url).toString();
  if (!passwordOk(pw)) {
    await new Promise((r) => setTimeout(r, 700));   // makes guessing slow
    return new Response(null, { status: 303, headers: { Location: to('/beheer/login?fout=1') } });
  }
  const s = newSession();
  const secure = req.url.startsWith('https') ? '; Secure' : '';
  return new Response(null, {
    status: 303,
    headers: { Location: to('/beheer'), 'Set-Cookie': `${ADMIN_COOKIE}=${s.value}; Path=/; Max-Age=${s.maxAge}; HttpOnly; SameSite=Lax${secure}` },
  });
}
