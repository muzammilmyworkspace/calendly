/** The page shell: the dark hall photo up top, the white card lifting off it, the host on the left. */
import Image from 'next/image';
import { HOST, type EventType } from '@/config/event-types';
import { Clock, Globe, Video } from './Icons';

export function Hero({ tall = false, children }: { tall?: boolean; children?: React.ReactNode }) {
  return (
    <header className={`hero${tall ? ' tall' : ''}`}>
      <Image src="/hero-hall.webp" alt="" fill priority sizes="100vw" className="hero-bg" />
      <div className="hero-inner">
        <a href="/" className="wordmark">MAIN&nbsp;CHARACTER</a>
        {children}
      </div>
    </header>
  );
}

export function Aside({ type }: { type: EventType }) {
  return (
    <aside className="aside">
      <div className="arch"><Image src="/onyema-portrait.webp" alt={HOST.name} width={240} height={300} sizes="240px" priority /></div>
      <p className="host-name">{HOST.name}</p>
      <p className="host-role">Sprekerscoach &amp; eventregisseur</p>
      <hr />
      <h1 className="event-name">{type.name}</h1>
      <ul className="meta">
        <li><Clock /> {type.minutes} minuten</li>
        <li><Video /> {type.video === 'zoom' ? 'Zoom-videogesprek' : 'Google Meet-videogesprek'}</li>
        <li><Globe /> Nederlandse tijd</li>
      </ul>
      <p className="event-desc">{type.description}</p>
    </aside>
  );
}

export function BookingFrame({ type, children }: { type: EventType; children: React.ReactNode }) {
  return (
    <>
      <Hero />
      <main className="sheet">
        <div className="panel">
          <Aside type={type} />
          <section className="work">{children}</section>
        </div>
        <p className="foot">MAIN CHARACTER · Vragen? Mail naar <a href="mailto:info@maincharacter.nl">info@maincharacter.nl</a></p>
      </main>
    </>
  );
}
