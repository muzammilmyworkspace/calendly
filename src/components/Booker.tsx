'use client';
import { useEffect, useMemo, useState } from 'react';
import type { EventType } from '@/config/event-types';
import { Arrow, Cal, Check, Clock, Left, Right, Video } from './Icons';

const TZ = 'Europe/Amsterdam';
const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const hhmm = (iso: string) => new Intl.DateTimeFormat('nl-NL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const longDay = (key: string) => new Intl.DateTimeFormat('nl-NL', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${key}T12:00:00Z`));
export const longWhen = (iso: string) => new Intl.DateTimeFormat('nl-NL', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
export const span = (iso: string, minutes: number) => `${hhmm(iso)} – ${hhmm(new Date(Date.parse(iso) + minutes * 60_000).toISOString())}`;
const pad = (n: number) => String(n).padStart(2, '0');
const MONTH = (y: number, m: number) => new Intl.DateTimeFormat('nl-NL', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m, 15)));

export function Steps({ labels, current }: { labels: string[]; current: number }) {
  return (
    <ol className="steps" aria-label="Stappen">
      {labels.map((l, i) => <li key={l} className={i + 1 === current ? 'now' : i + 1 < current ? 'past' : ''}><span>{i + 1}</span>{l}</li>)}
    </ol>
  );
}

type Props = { type: EventType; mode: 'book' | 'reschedule'; manage?: { id: string; t: string }; onRescheduled?: (startIso: string) => void };

export default function Booker({ type, mode, manage, onRescheduled }: Props) {
  const today = dayKey(new Date().toISOString());
  // primitives, not the object: a new {id, t} from the parent must not trigger a reload
  const manageId = manage?.id, manageT = manage?.t;
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [step, setStep] = useState<'pick' | 'form' | 'done'>('pick');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState<Record<string, string>>({});
  const labels = mode === 'book' ? ['Datum & tijd', 'Jouw gegevens', 'Bevestigd'] : ['Nieuwe tijd', 'Bevestigen', 'Verzet'];

  const lastDay = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const first = `${ym.y}-${pad(ym.m + 1)}-01`, last = `${ym.y}-${pad(ym.m + 1)}-${pad(lastDay)}`;

  useEffect(() => {
    const from = first < today ? today : first;
    if (last < from) { setSlots([]); setLoading(false); return; }
    setLoading(true); setError('');
    const q = new URLSearchParams({ slug: type.slug, from, to: last, ...(manageId && manageT ? { id: manageId, t: manageT } : {}) });
    fetch(`/api/slots?${q}`).then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setSlots(j.slots);
    }).catch((e) => setError(e.message || 'Beschikbaarheid kon niet worden geladen.')).finally(() => setLoading(false));
  }, [first, last, today, type.slug, manageId, manageT, reload]);

  const byDay = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const s of slots) (m[dayKey(s)] ??= []).push(s);
    return m;
  }, [slots]);

  // open the first day with room, so nobody lands on an empty screen
  useEffect(() => { if (!loading && (!day || !byDay[day])) setDay(Object.keys(byDay).sort()[0] ?? null); }, [loading, byDay, day]);

  const lead = (new Date(Date.UTC(ym.y, ym.m, 1)).getUTCDay() + 6) % 7;   // Monday first
  const cells = [...Array(lead).fill(null), ...Array.from({ length: lastDay }, (_, i) => `${ym.y}-${pad(ym.m + 1)}-${pad(i + 1)}`)];
  const thisMonth = ym.y === Number(today.slice(0, 4)) && ym.m === Number(today.slice(5, 7)) - 1;
  const move = (d: number) => { const n = new Date(Date.UTC(ym.y, ym.m + d, 1)); setYm({ y: n.getUTCFullYear(), m: n.getUTCMonth() }); setDay(null); setSlot(null); };

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!slot) return;
    setBusy(true); setError('');
    try {
      const r = mode === 'book'
        ? await fetch('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            slug: type.slug, start: slot, name: form.__name ?? '', email: form.__email ?? '', company: form.__company ?? '',
            answers: Object.fromEntries(type.questions.map((q) => [q.id, form[q.id] ?? ''])) }) })
        : await fetch('/api/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reschedule', id: manageId, t: manageT, start: slot }) });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || 'Er ging iets mis.');
        if (r.status === 409) { setStep('pick'); setSlot(null); setReload((n) => n + 1); }
        return;
      }
      if (mode === 'reschedule') onRescheduled?.(slot);
      if (j.videoUrl) setForm((f) => ({ ...f, __video: j.videoUrl }));
      setStep('done');
    } catch { setError('Geen verbinding. Probeer het opnieuw.'); }
    finally { setBusy(false); }
  }

  if (step === 'done' && slot) return (
    <div className="booker enter">
      <Steps labels={labels} current={3} />
      <div className="done">
        <div className="seal"><Check /></div>
        <h2 className="title">{mode === 'book' ? `Je afspraak staat${form.__name ? `, ${form.__name.trim().split(' ')[0]}` : ''}!` : 'Je afspraak is verzet'}</h2>
        <div className="summary">
          <p><Cal /> <span className="cap">{longWhen(slot)}</span></p>
          <p><Clock /> {span(slot, type.minutes)} · {type.minutes} minuten</p>
          {/* name the platform from the link that was really made — without Zoom settings it falls back to Meet */}
          <p><Video /> {(form.__video ?? '').includes('meet.google') ? 'Google Meet' : type.video === 'zoom' ? 'Zoom' : 'Google Meet'} — de link staat in je mail</p>
        </div>
        <p className="soft">Je ontvangt een bevestiging per e-mail en een agenda-uitnodiging.<br />Daarin staat ook de link om te verzetten of te annuleren.</p>
      </div>
    </div>
  );

  return (
    <div className="booker">
      {error && <div className="alert" role="alert">{error}</div>}

      {step === 'pick' && (
        <div className="enter">
          <Steps labels={labels} current={1} />
          <h2 className="title">{mode === 'book' ? 'Kies een datum en tijd' : 'Kies een nieuwe tijd'}</h2>
          <div className="pick">
            <div className="cal">
              <div className="cal-head">
                <button type="button" className="nav" onClick={() => move(-1)} disabled={thisMonth} aria-label="Vorige maand"><Left /></button>
                <span className="cap">{MONTH(ym.y, ym.m)}</span>
                <button type="button" className="nav" onClick={() => move(1)} aria-label="Volgende maand"><Right /></button>
              </div>
              <div className="grid">
                {['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map((d) => <div key={d} className="wd">{d}</div>)}
                {cells.map((k, i) => k === null ? <div key={`b${i}`} /> : (
                  <button type="button" key={k} disabled={!byDay[k]} aria-pressed={k === day}
                    className={`d${k === day ? ' sel' : ''}${byDay[k] ? ' open' : ''}${k === today ? ' today' : ''}`}
                    onClick={() => { setDay(k); setSlot(null); }}>
                    {Number(k.slice(8))}
                  </button>
                ))}
              </div>
              {loading && <div className="cal-loading"><span className="spinner" /></div>}
            </div>

            <div className="times">
              {loading ? <div className="skeleton">{Array.from({ length: 6 }, (_, i) => <span key={i} />)}</div>
                : !day ? <p className="soft empty">Deze maand is vol. <button type="button" className="linkish" onClick={() => move(1)}>Bekijk de volgende maand →</button></p>
                : <>
                    <p className="times-day cap">{longDay(day)}</p>
                    <div className="slots">
                      {byDay[day].map((s) => s === slot ? (
                        <div className="slot-pair" key={s}>
                          <span className="slot chosen">{hhmm(s)}</span>
                          <button type="button" className="slot-next" onClick={() => { setStep('form'); setError(''); }}>Volgende</button>
                        </div>
                      ) : (
                        <button type="button" key={s} className="slot" onClick={() => setSlot(s)}>{hhmm(s)}</button>
                      ))}
                    </div>
                  </>}
            </div>
          </div>
        </div>
      )}

      {step === 'form' && slot && (
        <form onSubmit={submit} className="enter">
          <Steps labels={labels} current={2} />
          <button type="button" className="back" onClick={() => setStep('pick')}><Left /> Andere tijd</button>
          <div className="picked">
            <Cal /> <span><b className="cap">{longWhen(slot)}</b><br />{span(slot, type.minutes)}</span>
          </div>

          {mode === 'book' ? (
            <div className="fields">
              <h2 className="title">Jouw gegevens</h2>
              <div className="two">
                <label className="field"><span>Naam<span className="req">*</span></span><input required value={form.__name ?? ''} onChange={(e) => setForm({ ...form, __name: e.target.value })} autoComplete="name" /></label>
                <label className="field"><span>E-mail<span className="req">*</span></span><input required type="email" value={form.__email ?? ''} onChange={(e) => setForm({ ...form, __email: e.target.value })} autoComplete="email" /></label>
              </div>
              <input className="hp" tabIndex={-1} autoComplete="off" value={form.__company ?? ''} onChange={(e) => setForm({ ...form, __company: e.target.value })} aria-hidden="true" />
              {type.questions.length > 0 && <p className="section-label">Een paar vragen vooraf</p>}
              {type.questions.map((q, i) => q.type === 'choice' ? (
                // a fieldset with real radios: buttons inside a <label> would all act as the first one
                <fieldset key={q.id} className="field q">
                  <legend className="qhead"><span className="qno">{pad(i + 1)}</span><span className="qlabel">{q.label}{q.required && <span className="req">*</span>}</span></legend>
                  {q.hint && <span className="hint">{q.hint}</span>}
                  <span className="choices">{q.options?.map((o) => (
                    <label key={o} className={`choice${form[q.id] === o ? ' on' : ''}`}>
                      <input type="radio" name={q.id} value={o} required={q.required} checked={form[q.id] === o} onChange={() => setForm({ ...form, [q.id]: o })} />{o}
                    </label>
                  ))}</span>
                </fieldset>
              ) : (
                <label key={q.id} className="field q">
                  <span className="qhead"><span className="qno">{pad(i + 1)}</span><span className="qlabel">{q.label}{q.required && <span className="req">*</span>}</span></span>
                  {q.hint && <span className="hint">{q.hint}</span>}
                  {q.type === 'textarea'
                    ? <textarea required={q.required} rows={3} value={form[q.id] ?? ''} onChange={(e) => setForm({ ...form, [q.id]: e.target.value })} />
                    : <input required={q.required} type={q.type === 'tel' ? 'tel' : 'text'} value={form[q.id] ?? ''} onChange={(e) => setForm({ ...form, [q.id]: e.target.value })} />}
                </label>
              ))}
              <button className="btn wide" disabled={busy}>{busy ? <><span className="spinner light" /> Bezig…</> : <>Afspraak bevestigen <Arrow /></>}</button>
              <p className="fine">Je gegevens worden alleen gebruikt om dit gesprek voor te bereiden.</p>
            </div>
          ) : (
            <button className="btn wide" disabled={busy}>{busy ? <><span className="spinner light" /> Bezig…</> : <>Nieuwe tijd bevestigen <Arrow /></>}</button>
          )}
        </form>
      )}
    </div>
  );
}
