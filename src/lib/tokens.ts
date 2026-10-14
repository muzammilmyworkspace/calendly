/**
 * Manage links ("verzetten of annuleren") carry a signature, so nobody can cancel someone else's call by
 * guessing an id. Nothing is stored: the signature is recomputed from the booking id.
 */
import crypto from 'node:crypto';
import { env } from './env';

/** Google Calendar accepts our own event ids if they use the characters a–v and 0–9 */
export function newBookingId() {
  const alphabet = '0123456789abcdefghijklmnopqrstuv';
  return 'mc' + Array.from(crypto.randomBytes(24), (b) => alphabet[b & 31]).join('');
}
export function sign(id: string) {
  return crypto.createHmac('sha256', env.bookingSecret).update(id).digest('base64url').slice(0, 24);
}
export function verify(id: string, t: string) {
  const a = Buffer.from(sign(id)), b = Buffer.from(t || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export const manageUrl = (id: string) => `${env.publicUrl}/b/${id}?t=${sign(id)}`;
