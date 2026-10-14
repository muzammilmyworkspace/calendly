/**
 * Which start times can be booked — pure, no Google, no clock: everything comes in as arguments,
 * so it can be tested (test/slots.test.ts) including the clock change in March and October.
 * No relative imports on purpose: the tests load this file directly with Node.
 */
import { DateTime } from 'luxon';

export type Rules = {
  timezone: string;
  hours: Record<number, [string, string][]>;
  stepMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  maxPerDay: number;
};
export type Busy = { start: string; end: string };

const overlaps = (aStart: number, aEnd: number, b: { s: number; e: number }) => aStart < b.e && b.s < aEnd;

/**
 * @returns start times as UTC ISO strings, ascending
 */
export function computeSlots(opts: {
  rules: Rules;
  minutes: number;
  /** first and last day to look at, as YYYY-MM-DD in the host timezone */
  fromDay: string;
  toDay: string;
  now: Date;
  busy: Busy[];
  /** booked calls per YYYY-MM-DD (host timezone), for maxPerDay */
  bookedPerDay?: Record<string, number>;
}): string[] {
  const { rules, minutes } = opts;
  const zone = rules.timezone;
  const now = DateTime.fromJSDate(opts.now, { zone });
  const earliest = now.plus({ hours: rules.minNoticeHours }).toMillis();
  const lastDay = DateTime.min(
    DateTime.fromISO(opts.toDay, { zone }).endOf('day'),
    now.plus({ days: rules.maxDaysAhead }).endOf('day'),
  );
  const busy = opts.busy.map((b) => ({ s: Date.parse(b.start), e: Date.parse(b.end) }));
  const pad = rules.bufferMinutes * 60_000;
  const out: string[] = [];

  for (let day = DateTime.fromISO(opts.fromDay, { zone }).startOf('day'); day <= lastDay; day = day.plus({ days: 1 })) {
    const key = day.toISODate()!;
    if (rules.maxPerDay > 0 && (opts.bookedPerDay?.[key] ?? 0) >= rules.maxPerDay) continue;
    for (const [from, to] of rules.hours[day.weekday] ?? []) {
      const [fh, fm] = from.split(':').map(Number);
      const [th, tm] = to.split(':').map(Number);
      // set the wall-clock time in the host zone, so 09:00 stays 09:00 across the clock change
      const windowEnd = day.set({ hour: th, minute: tm }).toMillis();
      for (let t = day.set({ hour: fh, minute: fm }); t.plus({ minutes }).toMillis() <= windowEnd; t = t.plus({ minutes: rules.stepMinutes })) {
        const s = t.toMillis(), e = t.plus({ minutes }).toMillis();
        if (s < earliest) continue;
        if (busy.some((b) => overlaps(s - pad, e + pad, b))) continue;
        out.push(t.toUTC().toISO()!);
      }
    }
  }
  return out;
}

/** a slot is still bookable at the moment of booking — guards against two people taking the same time */
export function isSlotFree(startIso: string, minutes: number, bufferMinutes: number, busy: Busy[]): boolean {
  const s = Date.parse(startIso), e = s + minutes * 60_000, pad = bufferMinutes * 60_000;
  return !busy.some((b) => overlaps(s - pad, e + pad, { s: Date.parse(b.start), e: Date.parse(b.end) }));
}
