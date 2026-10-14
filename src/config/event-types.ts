/**
 * The appointment types — taken from what Main Character's Calendly actually did.
 *
 * Source: the Calendly "New Event" notifications in info@maincharacter.nl (Jun 2025 – Oct 2026) for the
 * names and the exact intake questions, and the booked events in Onyema's calendar for the durations
 * (Strategie-call: 92 bookings, all 15 minutes). Where Calendly never showed a duration it is marked
 * CHECK — confirm with Onyema before going live.
 *
 * To change a question, a duration or the hours: edit this file and redeploy. Nothing else needs touching.
 */

export type Question = {
  id: string;
  label: string;
  /** a short helper line under the label */
  hint?: string;
  type: 'text' | 'textarea' | 'tel' | 'url' | 'choice';
  required: boolean;
  options?: string[];
};

export type EventType = {
  slug: string;
  name: string;
  description: string;
  minutes: number;
  /** zoom needs ZOOM_* settings; without them the booking falls back to Google Meet */
  video: 'zoom' | 'meet';
  /** false = bookable through its link, but not shown on the overview page */
  listed: boolean;
  questions: Question[];
};

export const HOST = {
  name: 'Onyema Onwuka',
  company: 'MAIN CHARACTER',
  timezone: 'Europe/Amsterdam',
};

/** When people may book. Every booking in the calendar fell Mon–Fri between 09:15 and 17:00. */
export const AVAILABILITY = {
  /** ISO weekday 1 = Monday … 7 = Sunday, times in HOST.timezone */
  hours: {
    1: [['09:00', '17:30']],
    2: [['09:00', '17:30']],
    3: [['09:00', '17:30']],
    4: [['09:00', '17:30']],
    5: [['09:00', '17:30']],
  } as Record<number, [string, string][]>,
  /** start times every N minutes — Calendly used quarter hours */
  stepMinutes: 15,
  /** free time kept around every appointment, before and after */
  bufferMinutes: 0,
  /** nobody can book a call that starts sooner than this */
  minNoticeHours: 12,
  /** how far ahead the calendar opens */
  maxDaysAhead: 60,
  /** at most this many booked calls per day (all types together); 0 = no limit */
  maxPerDay: 0,
};

export const EVENT_TYPES: EventType[] = [
  {
    slug: 'strategie-call',
    name: 'Strategie-call — Haal álles uit je talks & events!',
    description: 'Een korte strategie-call van 15 minuten met Onyema.',
    minutes: 15, // 92 bookings in the calendar, all 15 minutes
    video: 'zoom',
    listed: true,
    questions: [
      { id: 'bedrijf', label: 'Wat is de naam van je bedrijf en met welke titel identificeer jij je het meest?', type: 'text', required: true },
      { id: 'kanalen', label: 'Wat zijn je sociale kanalen (zakelijk, privé, alles: website, LinkedIn- en/of Instagram-profiel)?', type: 'textarea', required: true },
      { id: 'droom', label: 'Wat is op dit moment je grootste droom of verlangen?', type: 'textarea', required: true },
      { id: 'belemmeringen', label: 'Wat zijn de 3 grootste belemmeringen / uitdagingen in het realiseren van dit verlangen waar je tegenaan loopt?', type: 'textarea', required: true },
      { id: 'hulp', label: 'Hoe denk je dat ik je kan helpen en waarom denk jij dat ik hier de aangewezen persoon voor ben?', type: 'textarea', required: true },
      { id: 'samenwerken', label: 'Welke vorm van samenwerken heeft jouw voorkeur?', type: 'textarea', required: true },
      { id: 'investeren', label: 'Wat ben je op dit moment bereid te investeren in de oplossing van je probleem / begeleiding?', type: 'textarea', required: true },
    ],
  },
  {
    slug: 'matchcall',
    name: 'MAIN CHARACTER Matchcall',
    description: 'Ontdek in een matchcall of MAIN CHARACTER bij jou past.',
    minutes: 30, // CHECK — Calendly's mails never stated the length of the Matchcall
    video: 'zoom',
    listed: true,
    questions: [
      { id: 'telefoon', label: 'Wat is jouw telefoonnummer?', type: 'tel', required: true },
      { id: 'social', label: 'Wat is jouw Instagram of LinkedIn?', type: 'text', required: true },
      { id: 'website', label: 'Wat is jouw website?', type: 'text', required: false },
      { id: 'wat-doe-je', label: 'Wat doe je, en voor wie?', hint: 'Niet je functietitel, maar wat je echt doet en voor wie je het doet.', type: 'textarea', required: true },
      { id: 'aanleiding', label: 'Wat is er aan de hand waardoor je nu contact opneemt?', hint: 'Er is altijd iets. Een event dat eraan komt, een sprekersklus, iets wat vastzit, een stap die je wilt zetten. Wat is dat voor jou?', type: 'textarea', required: true },
      { id: 'geprobeerd', label: 'Wat heb je al geprobeerd om dit (je antwoord op vraag 2) aan te pakken en waarom werkte dat niet?', hint: 'Of waarom was het niet genoeg.', type: 'textarea', required: true },
      { id: 'opleveren', label: 'Wat moet dit gesprek je opleveren om het de moeite waard te vinden?', hint: 'Wees concreet. "Gewoon even kennismaken" is geen antwoord.', type: 'textarea', required: true },
      { id: 'investering', label: 'Wat is voor jou een reële investering voor een traject dat dit echt aanpakt?', type: 'textarea', required: true },
    ],
  },
  {
    slug: 'podium-integratie-strategiesessie',
    name: 'Podium integratie- en strategiesessie',
    description: 'Integratie- en strategiesessie voor deelnemers.',
    minutes: 15, // 4 bookings in the calendar, all 15 minutes
    video: 'zoom',
    listed: false,
    questions: [],
  },
  {
    slug: 'podium-strategiesessie',
    name: 'Podium strategiesessie',
    description: 'Strategiesessie voor deelnemers.',
    minutes: 15, // CHECK — assumed equal to the integratiesessie
    video: 'zoom',
    listed: false,
    questions: [],
  },
  {
    slug: 'podium-integratie-strategiesessie-dnls',
    name: 'Podium integratie- en strategiesessie DNLS',
    description: 'Integratie- en strategiesessie voor deelnemers van De Nieuwe Leider Spreekt.',
    minutes: 15, // CHECK — assumed equal to the integratiesessie
    video: 'zoom',
    listed: false,
    questions: [
      { id: 'telefoon', label: 'Wat is je telefoonnummer?', type: 'tel', required: true },
      { id: 'eindmeting', label: 'Heb je de eindmeting al ingevuld?', type: 'choice', required: true, options: ['Ja', 'Nee'] },
    ],
  },
];

export const eventTypeBySlug = (slug: string) => EVENT_TYPES.find((e) => e.slug === slug) ?? null;
