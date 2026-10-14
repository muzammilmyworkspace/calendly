/**
 * The overview at /beheer is behind one shared password (ADMIN_PASSWORD) — enough for Onyema and Kim,
 * no accounts to manage. After logging in, a signed cookie keeps you in for 7 days.
 */
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { env } from './env';

export const ADMIN_COOKIE = 'mc_beheer';
const WEEK = 7 * 86_400_000;
const sig = (exp: string) => crypto.createHmac('sha256', env.bookingSecret).update(`beheer|${exp}`).digest('base64url');
const same = (a: string, b: string) => {
  const x = crypto.createHash('sha256').update(a).digest(), y = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(x, y);
};

export function newSession() {
  const exp = String(Date.now() + WEEK);
  return { value: `${exp}.${sig(exp)}`, maxAge: WEEK / 1000 };
}
export async function isAdmin() {
  const v = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!v || !env.adminPassword) return false;
  const [exp, s] = v.split('.');
  return Number(exp) > Date.now() && !!s && same(s, sig(exp));
}
export const passwordOk = (pw: string) => !!env.adminPassword && same(pw, env.adminPassword);
