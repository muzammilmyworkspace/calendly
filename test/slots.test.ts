// node --test test/  (Node 22.6+ runs .ts directly)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSlots, isSlotFree } from '../src/lib/slots.ts';

const rules = {
  timezone: 'Europe/Amsterdam',
  hours: { 1: [['09:00', '17:30']], 2: [['09:00', '17:30']], 3: [['09:00', '17:30']], 4: [['09:00', '17:30']], 5: [['09:00', '17:30']] } as Record<number, [string, string][]>,
  stepMinutes: 15, bufferMinutes: 0, minNoticeHours: 0, maxDaysAhead: 60, maxPerDay: 0,
};
// a Sunday evening well before the days we look at
const now = new Date('2026-10-18T20:00:00Z');
const day = (d: string, extra: Partial<typeof rules> = {}, busy: { start: string; end: string }[] = [], at = now) =>
  computeSlots({ rules: { ...rules, ...extra }, minutes: 15, fromDay: d, toDay: d, now: at, busy });

test('a free weekday has every quarter from 09:00 to 17:15', () => {
  const s = day('2026-10-19');                       // Monday
  assert.equal(s.length, 34);                        // 8.5 hours × 4
  assert.equal(s[0], '2026-10-19T07:00:00.000Z');    // 09:00 summer time = 07:00 UTC
  assert.equal(s.at(-1), '2026-10-19T15:15:00.000Z'); // 17:15 — ends exactly at 17:30
});

test('weekends have nothing', () => {
  assert.equal(day('2026-10-24').length, 0);
  assert.equal(day('2026-10-25').length, 0);
});

test('a busy hour removes exactly the four quarters inside it', () => {
  const s = day('2026-10-19', {}, [{ start: '2026-10-19T08:00:00Z', end: '2026-10-19T09:00:00Z' }]); // 10:00–11:00 local
  assert.equal(s.length, 30);
  assert.ok(s.includes('2026-10-19T07:45:00.000Z'));  // 09:45 ends at 10:00 — still fine
  assert.ok(!s.includes('2026-10-19T08:00:00.000Z'));
  assert.ok(s.includes('2026-10-19T09:00:00.000Z'));  // 11:00 free again
});

test('buffer keeps a quarter free on both sides', () => {
  const s = day('2026-10-19', { bufferMinutes: 15 }, [{ start: '2026-10-19T08:00:00Z', end: '2026-10-19T09:00:00Z' }]);
  assert.ok(!s.includes('2026-10-19T07:45:00.000Z'));
  assert.ok(!s.includes('2026-10-19T09:00:00.000Z'));
  assert.ok(s.includes('2026-10-19T09:15:00.000Z'));
});

test('minimum notice hides slots that start too soon', () => {
  const s = day('2026-10-19', { minNoticeHours: 12 }, [], new Date('2026-10-19T00:00:00Z'));
  assert.equal(s[0], '2026-10-19T12:00:00.000Z');    // first slot 14:00 local, 12 h after 02:00 local
});

test('clock change: 09:00 stays 09:00 on both sides of 25 October', () => {
  assert.equal(day('2026-10-23')[0], '2026-10-23T07:00:00.000Z'); // Friday, summer time UTC+2
  assert.equal(day('2026-10-26')[0], '2026-10-26T08:00:00.000Z'); // Monday, winter time UTC+1
  assert.equal(day('2026-10-26').length, 34);
});

test('max per day closes a full day', () => {
  const s = computeSlots({ rules: { ...rules, maxPerDay: 3 }, minutes: 15, fromDay: '2026-10-19', toDay: '2026-10-20', now, busy: [], bookedPerDay: { '2026-10-19': 3 } });
  assert.ok(s.every((x) => x.startsWith('2026-10-20')));
});

test('isSlotFree sees a clash that appeared after the page was loaded', () => {
  const busy = [{ start: '2026-10-19T08:00:00Z', end: '2026-10-19T08:15:00Z' }];
  assert.equal(isSlotFree('2026-10-19T08:00:00Z', 15, 0, busy), false);
  assert.equal(isSlotFree('2026-10-19T08:15:00Z', 15, 0, busy), true);
});
