import { getBooking } from '@/lib/bookings';
import { verify } from '@/lib/tokens';
import Manage from '@/components/Manage';
import { BookingFrame, Hero } from '@/components/Frame';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Je afspraak — MAIN CHARACTER', robots: { index: false } };

export default async function ManagePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t = '' } = await searchParams;
  const b = verify(id, t) ? await getBooking(id) : null;
  if (!b) return (
    <>
      <Hero />
      <main className="sheet">
        <div className="panel solo">
          <section className="work center">
            <h2 className="title">Afspraak niet gevonden</h2>
            <p className="soft">Deze afspraak is al geannuleerd, of de link is niet volledig.<br />Mail gerust naar <a href="mailto:info@maincharacter.nl">info@maincharacter.nl</a> als je hulp nodig hebt.</p>
            <p><a className="btn" href="/">Nieuwe afspraak maken</a></p>
          </section>
        </div>
      </main>
    </>
  );
  const p = b.ev.extendedProperties?.private ?? {};
  return (
    <BookingFrame type={b.type}>
      <Manage type={b.type} id={id} t={t} startIso={b.ev.start!.dateTime!} videoUrl={p.videoUrl || b.ev.hangoutLink || undefined} guestName={p.guestName ?? ''} />
    </BookingFrame>
  );
}
