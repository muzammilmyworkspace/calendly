/** Settings come from environment variables (Vercel → Project → Settings → Environment Variables). See .env.example. */
const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Instelling ontbreekt: ${k} (zie .env.example)`);
  return v;
};
const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export const env = {
  /** the mailbox that owns the calendar and sends the mails */
  get hostEmail() { return need('HOST_EMAIL'); },
  /** calendar the appointments are written to */
  get hostCalendarId() { return process.env.HOST_CALENDAR_ID || 'primary'; },
  /** calendars whose busy times block a slot — by default only the host calendar */
  get busyCalendarIds() { const l = list(process.env.BUSY_CALENDAR_IDS); return l.length ? l : [this.hostCalendarId]; },
  /** team addresses that get a copy of every booking, cancellation and change */
  get notifyEmails() { return list(process.env.NOTIFY_EMAILS); },
  /** signs the manage links in the mails; any long random string */
  get bookingSecret() { return need('BOOKING_SECRET'); },
  /** e.g. https://afspraken.maincharacter.nl — used to build links in mails */
  get publicUrl() { return need('PUBLIC_URL').replace(/\/$/, ''); },
  get cronSecret() { return process.env.CRON_SECRET ?? ''; },
  zoom: {
    get enabled() { return !!(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET); },
    get accountId() { return need('ZOOM_ACCOUNT_ID'); },
    get clientId() { return need('ZOOM_CLIENT_ID'); },
    get clientSecret() { return need('ZOOM_CLIENT_SECRET'); },
    /** the licensed Zoom user who hosts the calls */
    get user() { return process.env.ZOOM_USER || 'me'; },
  },
};
