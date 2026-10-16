# The weekly newsletter

Two newsletters go to families every Friday: **The Palm River Post** (all families) and the **Early Years Weekly Newsletter** (Nursery and Kindergarten). They are written in The Current (Outreach > Newsletter; teachers write their class corner under Teaching > Newsletter). Publish turns an issue into:

- **two pages on pra.edu.vn:** `/newsletter/<slug>/` in English and `/vi/newsletter/<slug>/` in Vietnamese, with an archive at `/newsletter/`;
- **two PDFs:** English and Vietnamese, A4;
- **a Gmail draft in admin@:** the groups in BCC and both PDFs attached. The office sends it.

Everything after the editor reads one object, the **payload**. It is built by `buildPayload()` in `payload.js`. The website gets the public payloads from the database: `adm_newsletters_public()`, which returns the `published` column of each published issue. The PDF and the email are made in the browser from the families payload (the same object, plus the families-only parts).

## Files

| File | What it does |
|---|---|
| `constants.js` | Editions, part types and their soft length limits, colours (the website's), story icons, fixed words in both languages |
| `dates.js` | Quarter and week of an issue, dates and times in both languages, slugs, Google Calendar links |
| `text.js` | The safe HTML kept in the editor, plain text, first sentence, reading time, wording checks, word diff |
| `payload.js` | Translation state, checks, status, the subject suggestion, `buildPayload()` |
| `data.js` | Reading and saving issues and parts (Supabase, or this browser's storage offline) |
| `photos.js` | Uploading, resizing and signing photos; copying album photos in |
| `pdf.js`, `pdfLayout.js` | The PDF (pdfmake), in Be Vietnam Pro (`public/fonts`, OFL licence in `public/fonts/OFL.txt`); emoji are taken out, the font has none |
| `email.js` | The email (HTML and plain text), and `chatMessage()`: the short message for Zalo and WhatsApp groups, Vietnamese first |
| `newIssue.js`, `calendarFeed.js` | Starting next Friday's issue; the academic calendar and The Palm Press posts from pra.edu.vn/data/ |
| `publish.js` | Publish and take off the website |

The database is `supabase/updates-2026-10-16-newsletter.sql`. The function that starts a website build is `supabase/functions/newsletter-build`.

## The payload (version 1)

Text in two languages is always `{ en, vi }`. `vi` may be `''` while the Vietnamese is not written yet. Readers then show the English, and may mark it "English" (`pick()` in `payload.js`). Fields called `body` hold small HTML. It contains only `<p> <b> <i> <ul> <li> <br>`, and `<a href>` to http(s), mailto: or tel:. `cleanHtml()` has already cleaned it, and every reader may insert it as it is.

```js
{
  v: 1,
  audience: 'public' | 'families',     // 'public' leaves out families-only parts (the website)
  slug: '2026-27-q1-week-10',          // Early Years: '2026-27-q1-week-10-early-years'
  edition: 'post' | 'ey',
  edition_name: { en: 'The Palm River Post', vi: 'The Palm River Post' },
  tone: 'blue' | 'green',              // the edition's colour (constants.js TONES)
  date: '2026-10-09',                  // the Friday it goes out
  school_year: '2026-2027', quarter: 1, week: 10,
  label: { en: 'Quarter 1 · Week 10', vi: 'Quý 1 · Tuần 10' },
  day: { en: 'Friday 9 October 2026', vi: 'Thứ Sáu, ngày 9 tháng 10 năm 2026' },
  subject: 'The Palm River Post: Showcase moved to Thursday 15 Oct · no classes 9–14 Oct',   // the email subject, English
  preheader: { en, vi },               // the inbox preview line (the opening sentence)
  url: { en: 'https://pra.edu.vn/newsletter/<slug>/', vi: 'https://pra.edu.vn/vi/newsletter/<slug>/' },
  cover: Photo | null,                 // the photo at the top, and the link-preview image
  opening: { lead: { en, vi }, body: { en: html, vi: html } },
  need: {                              // "Need to know": always near the top, whatever the order of the parts
    dates: [{
      id, iso: '2026-10-09', end: '2026-10-14' | null,
      date: { en: 'Fri 9 to Wed 14 Oct', vi: 'T6, 9/10 đến T4, 14/10' },
      time: { en: '3:30–4:15 PM', vi: '15:30–16:15' } | null,
      what: { en, vi },
      tag: 'off' | 'fees' | 'event' | '',   // off = no classes, fees = money due
      gcal: 'https://calendar.google.com/calendar/render?…',   // "Add to calendar"
    }],
    reminders: [{ en, vi }],
  },
  parts: [ Part ],                     // in the order Seth set
  pdf: { en: url | null, vi: url | null },
  vi_complete: true,                   // false: some parts are English only for now
  reading_minutes: 3,
  published_at: '2026-10-09T08:00:00Z' | null,
}

Photo = { src, small, w, h, alt: { en, vi }, focus: '50% 30%' | null }
   // src about 1600 px wide, small about 800 px; alt is also the caption;
   // focus is the point a crop keeps (the cover's is set by clicking it in the editor)

Part (by type):
  { type: 'story', id, icon, tone, heading, when, body, photos: [Photo] (0–3),
    button: { label: { en, vi }, url } | null }
  { type: 'class', id, class: 'Nursery', class_key: 'nursery', tone,
    teacher: { name: 'Ms. Tham N', photo: url | null } | null,
    body, photos: [Photo] (0–4), words: [{ en: 'wash hands', vi: 'rửa tay' }], ask: { en, vi } | null }
  { type: 'photos', id, icon, tone, heading, photos: [Photo] (2–8) }
  { type: 'quote', id, text: { en, vi }, who: { en: 'Amada, Year 7', vi }, photo: Photo | null }
  { type: 'press', id, title, author, url, blurb: { en, vi } }
  { type: 'welcome', id, heading, body, names: [{ name, class }] }   // families payload only
  { type: 'closing', id, body }   // the sign-off ("Warm regards, …") is added by the reader
```

`id` is the part's short id. The page gives each part `id="s-<id>"`, and the email's "Read more" links to `<url>?from=email#s-<id>`.

`icon` is a lucide icon name (`constants.js` STORY_ICONS). `tone` is a key of `constants.js` TONES, the website's colours: blue, green, sun, coral, violet, teal, navy.

## Counting readers

Each newsletter page calls the database function `adm_newsletter_seen(p_slug, p_lang, p_source, p_anchor)` once per visit, with the publishable key (`site.json` forms.key):
- `p_source` comes from `?from=` in the address: `email`, `chat`, `facebook`, `site`, `pdf`, or `direct` when there is none.
- `p_anchor` is the part the visitor arrived at (`s-xxxx` from the address), or `''`.

Nothing about the visitor is stored. The Current shows the counts on each issue.

## Where photos live

- **While an issue is written:** in the private bucket `adm-newsletter`, as `<issue id>/<photo id>.jpg`. The longest side is at most 2000 px, and location data is removed.
- **At Publish:** the issue's photos are copied to the public bucket `newsletter`, as `<slug>/<photo id>-1600.jpg` and `-800.jpg`, and so are the PDFs. The payload's addresses point there.
- **Take off the website:** removes that folder.
