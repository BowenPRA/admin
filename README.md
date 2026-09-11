# PRA Admin — invoices and receipts

A small web app for Palm River Academy's office: pick students, choose a payment
plan, tick meals / transport / fees, and get a print-ready bilingual fee
announcement (invoice). Every invoice is saved with its line items, payments are
recorded against it, cash receipts (Phiếu thu) print from the same record, and
everything exports to one Excel workbook.

Live at https://bowenpra.github.io/admin/

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # production build → dist/
npm run deploy     # build + publish dist/ to the gh-pages branch
```

## Storage

The app talks to Supabase when `.env` has these two values (copy `.env.example`):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Without them it runs in **offline mode** and keeps everything in that browser's
storage — handy for trying it out, not for real records.

### One-time Supabase setup

1. Open the project's SQL editor and run [`supabase/schema.sql`](supabase/schema.sql).
   It creates the `adm_*` tables and locks them to staff accounts.
2. For each staff member: Authentication → Users → Add user (email + password),
   then edit the user's **App metadata** to `{"role": "admin"}`.
   Existing Dashboard teacher accounts (`role: teacher`) already qualify, and the
   login page accepts the same short name + code they use there.
3. The `.env` values are baked into the build. That is fine: the key is the public
   one and the row-level-security policies are what actually protect the data.

## How an invoice is made

1. **Students** — pick a family (all its children come along) or individual students.
   Each student carries their level, program, legacy flag and new-student flag.
2. **Plan + period** — Early Bird / Standard full year, pay by quarter (tick the
   quarters being billed now), custom installments (e.g. 60/40 with due dates),
   weekly (Global / Vocational / summer), trial day only, or staff child.
   The period drives the meal-day and transport-month counts from the school calendar.
3. **Per student** — override tuition, extra discount, meals (days × rate), transport
   (zone × months), new-student fee, trial days, Acellus / pathway for Upper Secondary.
   The 5% sibling discount lands on the cheaper child automatically.
4. **Deductions and notes** — amounts already paid or deposited, cash-only, extra lines.

The engine (`src/lib/pricing.js`) turns those choices into a document of editable
tables. The editor shows the document beside a live A4 preview; every cell,
heading and column label can be changed by hand, rows and whole sections can be
added, and *Rebuild from options* reopens the wizard for the same invoice.

**Print / Save PDF** opens the invoice alone in a new tab; use the browser's print
dialog and choose *Save as PDF*.

## Data model

| Table | What it holds |
|---|---|
| `adm_families` | parent contact, preferred invoice language |
| `adm_students` | name, nickname, level, program, legacy / new flags |
| `adm_invoices` | number, status, dates, totals, the builder inputs and the rendered document (JSON) |
| `adm_payments` | amount, date, method, receipt number and receipt text |
| `adm_settings` | fee schedule and school calendar (editable in Settings) |

Invoice numbers look like `PRA-2627-0001`, receipts `PT-2627-0001`.

## Yearly maintenance

Settings → Fee schedule: update the amounts, deadlines and the school-day counts
per month, then save. Defaults for 2026-2027 live in `src/lib/fees.js`.
