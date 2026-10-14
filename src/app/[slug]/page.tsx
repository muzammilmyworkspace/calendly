import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { eventTypeBySlug } from '@/config/event-types';
import Booker from '@/components/Booker';
import { BookingFrame } from '@/components/Frame';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const t = eventTypeBySlug((await params).slug);
  return { title: t ? `${t.name} — MAIN CHARACTER` : 'MAIN CHARACTER' };
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const type = eventTypeBySlug((await params).slug);
  if (!type) notFound();
  return <BookingFrame type={type}><Booker type={type} mode="book" /></BookingFrame>;
}
