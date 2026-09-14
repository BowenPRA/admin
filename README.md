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

## Progress reports

The **Progress reports** tab writes, reviews and prints student learning
progress reports (Lower Secondary first). Full details are in the code under
`src/pages/reports/`; the short version:

1. Run [`supabase/reports.sql`](supabase/reports.sql) once (after `schema.sql`).
   It adds the report tables, extra student columns and the permission rules.
2. Students → **Load 2026-2027 roster** fills in the student list from the office
   workbook (`scripts/build_roster.py` regenerates `src/data/roster.js`).
3. Teachers (head only) → add each teacher with their sign-in email and tick the
   learning areas they may edit and/or the year groups they are homeroom for.
   **Create login** makes a Supabase account with a temporary password.
4. Progress reports → **Create reports** for a period and year groups, then each
   teacher fills in their parts (auto-saved). **Update class references** averages
   the year group's review scores; **Print all** prints a whole year group.

Who can do what: office accounts (Supabase `app_metadata.role` teacher/admin)
keep invoices and settings; `admin` accounts are head teachers for reports;
teachers listed on the Teachers page can edit only their own learning areas.
These rules are enforced in the database, not just hidden in the interface.
Report wording, periods, the four progress levels, learning areas, templates and
learner skills are edited under Progress reports → Report settings.

## Families, Quarter 4 and emailing invoices (added 2026-09-14)

Run [`supabase/updates-2026-09-14.sql`](supabase/updates-2026-09-14.sql) once in
the SQL editor. It adds `q4_full` to students and the sent-email columns to invoices.

- **Families.** Students → **Group into families** looks at the parents' emails and
  phone numbers on the student records and proposes one family per set of siblings
  (language guessed from the children's names; rename or fix anything afterwards).
  Every student row also has a family dropdown, with "+ New family for this
  student" at the bottom, and each family has an add-student button.
- **Quarter 4.** Students enrolled when the 2026-2027 schedule came out pay the
  reduced Quarter 4 from the fee table. Students added by hand from now on have
  **Full-price Quarter 4** ticked, so their Q4 equals a normal quarter. Untick it
  on the student if a newcomer was promised the old terms.
- **Deleting invoices.** Trash icon on each row of the Invoices list, or tick several
  and use **Delete selected**. Payments on a deleted invoice go with it.
- **Send to parents.** On an invoice, **Send to parents** builds the PDF, fills in
  the parents' addresses from the family / student records and a bilingual
  message, and emails it from `admin@palmriveracademy.edu.vn`. The invoice is
  marked sent with the date and recipients. **Download PDF** saves the same file.

### One-time Google setup for direct sending

Without this, the Send button still saves the PDF and opens a Gmail compose
window with the message filled in; you attach the file by hand.

1. https://console.cloud.google.com → create a project (e.g. "PRA Admin"), signed in
   as admin@palmriveracademy.edu.vn.
2. APIs & Services → Library → enable **Gmail API**.
3. APIs & Services → OAuth consent screen → External, app name "PRA Admin", your
   email as support/developer contact. Add `admin@palmriveracademy.edu.vn` (and any
   other office account) under **Test users**. Scopes: add `.../auth/gmail.send`.
4. APIs & Services → Credentials → Create credentials → **OAuth client ID** →
   Web application. Authorized JavaScript origins:
   `http://localhost:5179` and `https://bowenpra.github.io`.
5. Copy the client ID into `.env` as `VITE_GOOGLE_CLIENT_ID=...`, then
   `npm run dev` locally or `npm run deploy` to publish.

The first send in a browser session pops up Google's sign-in for the admin@ account
and asks permission to send mail on its behalf; after that sending is one click.
