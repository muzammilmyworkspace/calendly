'use client';
import { useState } from 'react';
import type { EventType } from '@/config/event-types';
import Booker, { longWhen, span } from './Booker';
import { Cal, Check, Clock, Video } from './Icons';

type Props = { type: EventType; id: string; t: string; startIso: string; videoUrl?: string; guestName: string };

export default function Manage({ type, id, t, startIso, videoUrl, guestName }: Props) {
  const [view, setView] = useState<'overview' | 'cancel' | 'reschedule' | 'cancelled'>('overview');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function cancel() {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel', id, t, reason }) });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Er ging iets mis.'); return; }
      setView('cancelled');
    } catch { setError('Geen verbinding. Probeer het opnieuw.'); }
    finally { setBusy(false); }
  }

  if (view === 'reschedule') return <Booker type={type} mode="reschedule" manage={{ id, t }} />;
  if (view === 'cancelled') return (
    <div className="booker enter"><div className="done">
      <div className="seal muted-seal"><Check /></div>
      <h2 className="title">Je afspraak is geannuleerd</h2>
      <p className="soft">Je ontvangt een bevestiging per e-mail.</p>
      <p><a className="btn" href={`/${type.slug}`}>Nieuwe afspraak maken</a></p>
    </div></div>
  );
  return (
    <div className="booker enter">
      {error && <div className="alert" role="alert">{error}</div>}
      <p className="eyebrow dark">Je afspraak{guestName ? `, ${guestName.split(' ')[0]}` : ''}</p>
      <h2 className="title">Alles staat klaar</h2>
      <div className="summary">
        <p><Cal /> <span className="cap">{longWhen(startIso)}</span></p>
        <p><Clock /> {span(startIso, type.minutes)} · {type.minutes} minuten</p>
        {videoUrl && <p><Video /> <a href={videoUrl}>Deelnemen aan het gesprek</a></p>}
      </div>
      {view === 'overview' ? (
        <div className="row">
          <button className="btn" onClick={() => setView('reschedule')}>Verzetten</button>
          <button className="btn ghost" onClick={() => setView('cancel')}>Annuleren</button>
        </div>
      ) : (
        <div className="cancel-box">
          <label className="field">Wil je laten weten waarom? <span className="hint">Niet verplicht</span>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="row">
            <button className="btn danger" disabled={busy} onClick={cancel}>{busy ? 'Bezig…' : 'Ja, annuleren'}</button>
            <button className="btn ghost" onClick={() => setView('overview')}>Nee, toch niet</button>
          </div>
        </div>
      )}
    </div>
  );
}
