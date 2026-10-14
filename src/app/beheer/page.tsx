import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin';
import { listBookings, type Row, type Tab } from '@/lib/bookings';
import { EVENT_TYPES, HOST } from '@/config/event-types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Afspraken — Beheer — MAIN CHARACTER', robots: { index: false } };

const TABS: { id: Tab; label: string }[] = [{ id: 'aankomend', label: 'Aankomend' }, { id: 'afgelopen', label: 'Afgelopen' }, { id: 'geannuleerd', label: 'Geannuleerd' }];
const f = (iso: string | undefined, o: Intl.DateTimeFormatOptions) => iso ? new Intl.DateTimeFormat('nl-NL', { timeZone: HOST.timezone, ...o }).format(new Date(iso)) : '';
const dayOf = (iso: string) => f(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const hhmm = (iso: string) => f(iso, { hour: '2-digit', minute: '2-digit' });
// a quiet colour per appointment type, the way Calendly colours its event types
const TONE: Record<string, string> = Object.fromEntries(EVENT_TYPES.map((t, i) => [t.slug, ['#B8925A', '#1C1A16', '#82623A', '#6B6152', '#D7B679'][i % 5]]));

function Item({ r }: { r: Row }) {
  const phone = r.answers.find((a) => /telefoon/i.test(a.label))?.value;
  return (
    <details className="ev">
      <summary>
        <span className="tone" style={{ background: TONE[r.slug] ?? '#B8925A' }} />
        <span className="ev-time">{hhmm(r.start)} – {hhmm(r.end)}</span>
        <span className="ev-who"><b>{r.guestName}</b><small>{r.guestEmail}</small></span>
        <span className="ev-type">{r.typeName}</span>
        {r.tab === 'geannuleerd' && <span className="tag">{`door ${r.cancelledBy === 'team' ? 'team' : 'gast'}`}</span>}
        <span className="ev-chev" aria-hidden>›</span>
      </summary>
      <div className="ev-body">
        <div className="ev-facts">
          <p><span>E-mail</span><a href={`mailto:${r.guestEmail}`}>{r.guestEmail}</a></p>
          {phone && <p><span>Telefoon</span><a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a></p>}
          {r.videoUrl && r.tab === 'aankomend' && <p><span>Video</span><a href={r.videoUrl} target="_blank">Deelnemen</a></p>}
          <p><span>Geboekt op</span>{f(r.bookedAt, { dateStyle: 'medium', timeStyle: 'short' }) || '—'}</p>
          {r.tab === 'geannuleerd' && <>
            <p><span>Geannuleerd</span>{`${f(r.cancelledAt, { dateStyle: 'medium', timeStyle: 'short' })} door ${r.cancelledBy === 'team' ? 'het team' : 'de gast'}`}</p>
            <p><span>Reden</span>{r.cancelReason || '—'}</p>
          </>}
          {r.tab === 'aankomend' && <p className="ev-actions"><a className="btn small" href={r.manageUrl} target="_blank">Verzetten of annuleren</a></p>}
        </div>
        <div className="ev-answers">
          {r.answers.length === 0 ? <p className="soft">Geen vragen bij deze afspraak.</p>
            : r.answers.map((a, i) => <div key={i} className="qa"><p className="q">{a.label}</p><p className="a">{a.value || '—'}</p></div>)}
        </div>
      </div>
    </details>
  );
}

export default async function Beheer({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; type?: string }> }) {
  if (!(await isAdmin())) redirect('/beheer/login');
  const sp = await searchParams;
  const tab = (TABS.some((t) => t.id === sp.tab) ? sp.tab : 'aankomend') as Tab;
  const q = (sp.q ?? '').trim().toLowerCase(), type = sp.type ?? '';
  const all = Object.fromEntries(await Promise.all(TABS.map(async (t) => [t.id, await listBookings(t.id)] as const))) as Record<Tab, Row[]>;
  const rows = all[tab].filter((r) => (!type || r.slug === type) && (!q || `${r.guestName} ${r.guestEmail}`.toLowerCase().includes(q)));
  const days: [string, Row[]][] = [];
  for (const r of rows) { const d = dayOf(r.start); const last = days.at(-1); if (last && last[0] === d) last[1].push(r); else days.push([d, [r]]); }
  const link = (t: Tab) => `/beheer?${new URLSearchParams({ tab: t, ...(q ? { q } : {}), ...(type ? { type } : {}) })}`;

  return (
    <div className="admin">
      <header className="admin-top">
        <a href="/" className="wordmark">MAIN&nbsp;CHARACTER</a>
        <nav><a href="/api/admin/export" className="top-link">Exporteren naar Excel</a><a href="/api/admin/logout" className="top-link muted">Uitloggen</a></nav>
      </header>
      <main className="admin-main">
        <h1 className="admin-title">Afspraken</h1>
        <p className="soft">Alle boekingen uit de boekingstool. Klik op een afspraak voor de antwoorden.</p>

        <nav className="tabs">
          {TABS.map((t) => <a key={t.id} href={link(t.id)} className={t.id === tab ? 'on' : ''}>{t.label}<span>{all[t.id].length}</span></a>)}
        </nav>

        <form className="filters" method="get">
          <input type="hidden" name="tab" value={tab} />
          <input name="q" defaultValue={sp.q ?? ''} placeholder="Zoek op naam of e-mail" aria-label="Zoeken" />
          <select name="type" defaultValue={type} aria-label="Soort afspraak">
            <option value="">Alle soorten afspraken</option>
            {EVENT_TYPES.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
          </select>
          <button className="btn ghost">Filteren</button>
          {(q || type) && <a href={`/beheer?tab=${tab}`} className="linkish">Wissen</a>}
        </form>

        {days.length === 0
          ? <div className="empty-state"><p className="title">Niets te zien</p><p className="soft">{q || type ? 'Geen afspraken die passen bij je zoekopdracht.' : tab === 'aankomend' ? 'Er staan nog geen afspraken gepland.' : tab === 'afgelopen' ? 'Nog geen afgelopen afspraken in het afgelopen jaar.' : 'Er is niets geannuleerd.'}</p></div>
          : days.map(([d, list]) => (
              <section key={d} className="day">
                <h2 className="day-head cap">{d}</h2>
                <div className="day-list">{list.map((r) => <Item key={r.id} r={r} />)}</div>
              </section>
            ))}
      </main>
    </div>
  );
}
