# MC Afspraken — MAIN CHARACTER's own booking tool

Replaces Calendly. Clients pick a time on `afspraken.maincharacter.nl`, answer the intake questions, and get a
calendar invite with a Zoom (or Google Meet) link. Everything lives in Onyema's Google Calendar — no database,
no monthly fee.

## What it does

| | |
|---|---|
| Booking pages | one per appointment type: `/strategie-call`, `/matchcall`, `/podium-integratie-strategiesessie`, … |
| Availability | Mon–Fri 09:00–17:30 in quarter hours, minus everything busy in the calendar |
| Intake questions | exactly the questions Calendly asked — see `src/config/event-types.ts` |
| On booking | event in the calendar · guest invited · Zoom/Meet link · confirmation mail · copy to the team |
| Reminders | the day before and one hour before (skipped when the booking itself was that recent) |
| Reschedule / cancel | link in every mail; signed, so nobody can touch someone else's booking |
| Safety | double-booking check at the moment of booking · bot trap · input validation |

## Change something

Everything a non-developer would want to change is in **`src/config/event-types.ts`**:
names, durations, questions, working hours, buffer, notice, how far ahead. Change, commit, Vercel redeploys.

Before going live, confirm the values marked **CHECK** with Onyema (some Calendly durations were never in the mails).

## Run locally

```bash
npm install
cp .env.example .env.local     # fill in — use a TEST calendar, not the real one
npm run build && npx next start -p 3005
npm test                       # slot logic, incl. the clock change
node test/e2e.mjs              # full flow against the real Google Calendar (TEST calendar!)
```

## Go live (once)

**1. Google access that never expires** (Workspace admin, ±10 min)
1. console.cloud.google.com → project → *APIs & Services* → enable **Google Calendar API** and **Gmail API**
2. *IAM & Admin → Service accounts* → create one → *Keys → Add key → JSON* → download
3. admin.google.com → *Security → Access and data control → API controls → Domain-wide delegation → Add new*
   - Client ID: the service account's numeric client ID
   - Scopes: `https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/gmail.send`
4. Put the whole JSON in `GOOGLE_SERVICE_ACCOUNT_JSON`, and `HOST_EMAIL=info@maincharacter.nl`

**2. Zoom** (optional — without it calls get Google Meet links)
marketplace.zoom.us → *Develop → Build App → Server-to-Server OAuth* → scopes
`meeting:write:meeting:admin`, `meeting:update:meeting:admin`, `meeting:delete:meeting:admin` → activate →
copy Account ID / Client ID / Client Secret into the `ZOOM_*` settings, `ZOOM_USER` = Onyema's Zoom email.

**3. Vercel** — Main Character already pays for Vercel Pro (team *MAIN CHARACTER projects*), so this costs nothing extra
1. Import this folder as a new project in that team
2. Add every setting from `.env.example` (*Settings → Environment Variables*)
3. *Settings → Domains* → `afspraken.maincharacter.nl` → add the CNAME it shows at Vimexx (DNS)
4. The reminder job runs by itself (`vercel.json`, every 15 minutes)

**4. Switch over**
Run next to Calendly for two weeks, replace the Calendly links (website, Instagram bio, ManyChat, mail
signatures), then cancel Calendly.

## Not in this version

- Payment at booking (Calendly data showed none) — can be added with Mollie/Stripe
- A settings screen — settings live in `src/config/event-types.ts`
- More than one host / round robin
