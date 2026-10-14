import Image from 'next/image';
import { HOST } from '@/config/event-types';
import { listedTypes } from '@/lib/bookings';
import { Hero } from '@/components/Frame';
import { Arrow, Clock, Video } from '@/components/Icons';

export default function Home() {
  return (
    <>
      <Hero tall>
        <div className="welcome">
          <div className="welcome-text">
            <p className="eyebrow">Afspraak maken</p>
            <h1>Plan een gesprek<br /><em>met {HOST.name.split(' ')[0]}</em></h1>
            <p className="lede">Kies het gesprek dat bij je past. Je ziet direct wanneer er plek is — en je krijgt meteen een bevestiging.</p>
          </div>
          <div className="arch arch-hero"><Image src="/onyema-portrait.webp" alt={HOST.name} width={300} height={380} sizes="300px" priority /></div>
        </div>
      </Hero>
      <main className="sheet">
        <div className="types">
          {listedTypes().map((t, i) => (
            <a key={t.slug} href={`/${t.slug}`} className="type">
              <span className="type-no">0{i + 1}</span>
              <span className="type-body">
                <span className="type-name">{t.name}</span>
                <span className="type-desc">{t.description}</span>
                <span className="chips"><span className="chip"><Clock /> {t.minutes} min</span><span className="chip"><Video /> {t.video === 'zoom' ? 'Zoom' : 'Google Meet'}</span></span>
              </span>
              <span className="type-go"><Arrow /></span>
            </a>
          ))}
        </div>
        <p className="foot">MAIN CHARACTER · Vragen? Mail naar <a href="mailto:info@maincharacter.nl">info@maincharacter.nl</a></p>
      </main>
    </>
  );
}
