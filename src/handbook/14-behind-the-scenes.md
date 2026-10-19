This chapter is the machinery under The Current, the website and the triage: where the code and the data are kept, how a change goes live, how the database is changed, what is backed up and what is not, and which accounts everything depends on. You do not need to read code to follow it. Open it when Claude says "you need to run this file", when a site goes blank or shows an error, and at the handover, when every login in the table near the end has to change hands.

## Five words first

| Word | What it means here |
|---|---|
| **Code** | The files that make a site work: pages, buttons, rules. Each system's code is one folder on the admin laptop. |
| **Git** | A record of every change ever made to a folder of code, kept inside the folder. Any earlier state can be got back. |
| **Commit** | One saved step in that record, with a short message saying what changed. Until it is committed, a change exists only as edited files on the laptop. |
| **GitHub** | The website (github.com) that keeps a copy of each folder's record online. Sending your commits there is a **push**. |
| **Deploy** | Putting the finished site on the internet, where staff and families see it. |

For the website, a push is the deploy: GitHub builds and publishes the site by itself. For the triage, the cloud runs read the pushed rules at their next run. For The Current, deploying is a separate step from committing and pushing, so a change can be live before it is committed.

## The code folders

| Folder on the admin laptop | On GitHub | What it is | Who can see the code | How it goes live |
|---|---|---|---|---|
| `C:\Users\sbowe\admin` | BowenPRA/admin | The Current: every page, the database files in `supabase`, the scripts, this handbook | Anyone (the repository is public) | `npm run deploy`, run in this folder |
| `C:\Users\sbowe\pra-website` | BowenPRA/website | The website, pra.edu.vn, in English and Vietnamese | Anyone | A push to `main`; GitHub builds and publishes it in a few minutes |
| `C:\Users\sbowe\pra-triage` | BowenPRA/triage | The triage: its rules, skills, the scripts that write to The Current, the Triage Log | PRA only (private, because the log names families and staff) | A push; the cloud runs use it from their next run |
| `C:\Users\sbowe\pra-redirect` | BowenPRA/palmriveracademy-redirect | The redirect from the old address palmriveracademy.edu.vn to pra.edu.vn | Anyone | A deploy to Netlify ([Google Workspace and domains](#/handbook/google)) |

- The GitHub account is BowenPRA, with a mirror account, sbowen209. Bowen holds both.
- `C:\Users\sbowe\pra-redirect-www` is an unused copy of the redirect. It can be deleted when Bowen agrees.
- Other folders on the laptop that matter but are not code projects: `C:\Users\sbowe\Desktop\Admin Email` (where Claude sessions are opened, with Claude's memory notes, its helper agents and the sources of this handbook), `C:\Users\sbowe\PRA Photos` (the photo library, see [Photos and Facebook](#/handbook/photos)), and `C:\GAM7` and `C:\GAMConfig` (the Google Workspace tool, see [Google Workspace and domains](#/handbook/google)).

### What is never in the code

- **The `private` folder** inside the admin folder: the full student roster with birthdays, contacts and addresses, last year's year groups, the student photos, offline copies of event photos, and the source files of the Assessments library. Git is told to ignore it, and it must stay that way. Anything outside it in the admin folder can end up on the public site.
- **The `.env` file** (below).
- **Every password and key.** They are typed in by a person when a script asks.

> **Careful:** the admin repository is public, and its history still holds a copy of the student roster and photos from before 22 September 2026, when they were moved out. Making it private needs a paid GitHub plan, because GitHub Pages serves private repositories only on a paid plan. The decision is open; see [Known problems and open items](#/handbook/open).

## Hosting

- Both sites are hosted free on **GitHub Pages**. The Current is at https://current.pra.edu.vn, the website at https://pra.edu.vn.
- The domain pra.edu.vn is registered at P.A Vietnam, which also holds its address records: the website's addresses at GitHub, `current` pointing at GitHub for The Current, and Google's mail records. Never touch the mail records. [Google Workspace and domains](#/handbook/google) has the detail.
- The old address https://bowenpra.github.io/admin/ sends visitors on to current.pra.edu.vn.

### The two lines that keep The Current on its address

- `public/CNAME` in the admin folder holds the one line `current.pra.edu.vn`. If it goes, the next deploy drops the address.
- `vite.config.js` has `base: '/'`. If that changes while the site is on its own address, the site loads as a blank page.

> **Rule:** keep `public/CNAME` and `base: '/'` together. Only if The Current ever moves back to bowenpra.github.io/admin/ should the base become `/admin/` and the CNAME file be removed.

The website has the same kind of file, `src/CNAME` with `pra.edu.vn`. Leave it alone too.

## Deploying The Current

`npm run deploy` in the admin folder builds The Current from the files in the folder and publishes the result to GitHub Pages. The site changes a minute or two later. A hard refresh (Ctrl+F5) shows it if the old page is still there.

- It publishes **everything in the folder, committed or not**. If another Claude session is halfway through a change in the same folder, that half-change goes live too.
- It does not commit or push the code. That is a separate step.
- The `.env` values are built into the site, so it must run on a laptop that has the `.env` file. Without it the live site would switch to offline mode, which happened on 19 October 2026 on the new laptop (fixed the same morning). Since then the build stops with "No VITE_SUPABASE_URL" instead of going live.
- Anyone who had The Current open while a broken version was live keeps it until they reload the page. After fixing a bad deploy, ask staff to reload.
- It prints nothing for up to three minutes on a slow connection, then "Published".

> **Rule:** two chats must not edit the same folder at once without knowing it. Before any change or deploy, Claude checks `git status` (the list of changed files) and asks about any file it did not change.

Bowen's standing rule for The Current: Claude deploys a change as soon as it is built and checked, without asking; committing and pushing wait for your word. For the website, Claude pushes only when you say so, and never before Vietnamese staff have read new Vietnamese text.

> **Ask Claude:** "Check git status in the admin folder and tell me whether anything is changed that this session did not do."

> **Ask Claude:** "Deploy The Current and tell me when the live site shows the change."

> **Ask Claude:** "Commit and push the changes in the admin folder with a message saying what changed."

For the day Claude is not at hand, these work in PowerShell from any folder. Type one line at a time; PowerShell on this laptop does not accept `&&` between commands.

```
git -C C:\Users\sbowe\admin status
npm --prefix C:\Users\sbowe\admin run deploy
node C:\Users\sbowe\admin\scripts\check-handbook.mjs
```

The last line runs the handbook checker, which looks for banned words, broken links and anything that looks like a key in these chapters (see [Keeping this handbook up to date](#/handbook/updating)).

> **Ask Claude:** "Run the handbook checker and fix every problem it reports, then deploy The Current."

## The database

The Current keeps its data at **Supabase**, a database service on the internet. The project belongs to the account admin@palmriveracademy.edu.vn, and Bowen holds that login. The website has no database of its own; its forms write into this one.

- Every table's name starts with `adm_`. The prefix dates from when The Current shared a database with PRA's other app, the Dashboard. Bowen's notes say The Current has had its own project since 14 September 2026; comments in the code still describe it as shared (not checked since 15 October 2026).
- Logins for The Current are Supabase logins. Each staff account carries its role (Super Admin, Head, Admin, Teacher), and the database itself enforces what each role may read and change. Hiding a button is not the only protection.

### The tables

| Table | What it holds |
|---|---|
| adm_students | Each student: names, legal first name, year group, program, status, dates, meals, flags, checklist ticks |
| adm_families | Each family: name, contacts, preferred invoice language, notes |
| adm_invoices | Each invoice: number, status, dates, totals, the builder's choices and the printed document |
| adm_payments | Each payment: amount, date, method, receipt number and text, proof files |
| adm_settings | The fee schedule, the calendar, the report settings and the edited timetable |
| adm_teachers | Each teacher: email, name, title, the learning areas and homerooms they may write |
| adm_reports | One progress report per student and quarter |
| adm_report_sections | One row per learning area on a report: level, comment, scores |
| adm_course_notes | One course description per year group, quarter and learning area |
| adm_attendance | One register mark per student per day |
| adm_travel | Students' trips, shown as A(T) on the register |
| adm_photo_events, adm_event_photos, adm_event_posts | The Photos tab: events, their photos, draft Facebook posts |
| adm_leads | Families who have asked about joining |
| adm_web_messages | Messages from the website's contact form |
| adm_enrollments | Enrollment forms sent from the website |
| adm_enrollment_private | The private part of each form: ID numbers, documents, signature |
| adm_todos | The To-Do tab's tasks |
| adm_newsletters, adm_newsletter_parts, adm_newsletter_views | The Newsletter tab, live since 16 October 2026: issues, their parts, page-open counts |

### The storage buckets

Files are kept in "buckets". The app opens a private file through a link that lasts one hour.

| Bucket | What it holds | Private? |
|---|---|---|
| adm-receipts | Proof of payment: screenshots and PDFs of transfers | Yes |
| adm-photos | Student portraits for reports and lists | Yes |
| adm-event-photos | Event photos still under review on the Photos tab | Yes |
| adm-enrollment | Documents uploaded with enrollment forms | Yes |
| adm-todo | Files attached to tasks | Yes |
| adm-newsletter | Photos for a newsletter still being written (since 16 October 2026) | Yes |
| newsletter | What a published newsletter shows: photos and PDFs (since 16 October 2026) | No: public, read by the website |

### Who may do what in the database

- **Office accounts** (Super Admin, Head, Admin) may read and change the office tables.
- **Teachers** may read students, and write only their own report parts and the registers of their year groups.
- **The triage account** may read, add and change leads and tasks, and read website messages. It may never delete anything.
- **The website** reads no table. It may only call the two database functions that save a contact message and an enrollment form, and read published newsletters.
- A delete the database refuses is reported by the app, never silently ignored.

### The two keys

| Key | What it can do | Where it is |
|---|---|---|
| The **publishable** key | Lets the app talk to the database at all. Everything it can reach is limited by the rules above. | In the `.env` file and built into the public site. This is by design. |
| The **secret** key | Bypasses every rule. Used by the scripts that make staff logins, upload photos and renew the triage account. | Supabase → **Project Settings** → **API Keys**. Never saved on the laptop, never in the code. |

> **Rule:** the secret key is typed only by the admin, into the script that asks for it. Claude never types it, never sees it, and never asks for it in a chat. If a script needs it, Claude gives you the command and you run it.

## Changing the database

Nothing in the database changes until a person runs a file. This is the routine for every new column, table or rule.

1. Claude writes the change as a new file in `C:\Users\sbowe\admin\supabase\`, named `updates-` plus the date plus a short name, for example `updates-2026-10-16-newsletter.sql`. Its first lines say what it does and which file must run before it. Every file is safe to run twice.
2. Claude tells you the file's full path and that it needs running.
3. You open https://supabase.com/dashboard, sign in with the admin@ account, open the project, then **SQL Editor** → **New query**.
4. Open the file in any text editor, copy all of it, paste it into the query box and press **Run**.
5. Read the result. "Success" means it is done. An error message: copy it to Claude.
6. Tell Claude "ran the sql". Claude deploys The Current if it has not already, and commits on your word.

- The app can usually be deployed before a file has run. It then saves without the new column and shows which file is missing, in the form "Run supabase/updates-… in Supabase, then save again". Until the file runs, that feature is off or shows that message.
- A new database runs the files in the order listed in `supabase/README.md`: `schema.sql`, `reports.sql`, then the update files in date order. That list stops at 2 October 2026; the later files (5, 15 and 16 October 2026) follow in date order.
- The code does not record which files have run on the live database. Files not confirmed as run are listed in [Known problems and open items](#/handbook/open).

> **Rule:** from 30 October 2026 Supabase no longer opens a new table to the app by itself. Every file that creates a table must grant it in the same file. The lines to copy are in `supabase/README.md`. Without them the app shows "permission denied for table" and the table's name.

> **Ask Claude:** "Write this database change as a new file in the admin folder's supabase folder, give me its full path, and wait until I say I have run it before you deploy."

> **Ask Claude:** "I ran the SQL. Deploy The Current, check the live site, and commit."

The files so far, in the order a new database runs them (each date's files in the order shown):

```
schema.sql            the first five tables and the staff-only rules
reports.sql           the report tables and extra student columns
updates-2026-09-14    full-price Quarter 4; sent details on invoices
updates-2026-09-15    roles, teacher links, S numbers, family contacts, attendance;
                      then -legal-names, then -report-tiers
updates-2026-09-16    -pending: the Enrolled / Pending / Past status
updates-2026-09-17    teachers may clear a mark; only the head publishes
updates-2026-09-21    -early-years, -receipt-proof
updates-2026-09-22    -no-excused, -partial-day, -private-photos
updates-2026-09-28    -event-photos, then -event-photos-website
updates-2026-09-29    -facebook
updates-2026-09-30    -leads first, then -website-forms and -enrollments
updates-2026-10-01    -enrollment-fix, then -enrollment-schools-documents;
                      -receipt-numbers; -todos, then -todo-delete; -travel
updates-2026-10-02    -master-minds-movement, -student-dates-onboarding
updates-2026-10-05    -enrollment-documents-office
updates-2026-10-15    -parent-groups
updates-2026-10-16    -newsletter
```

## The .env file

`.env` is a small text file in the admin folder, on Bowen's laptop. It holds four values, by these names:

| Name | What it is |
|---|---|
| VITE_SUPABASE_URL | The database's address |
| VITE_SUPABASE_PUBLISHABLE_KEY | The publishable key (above) |
| VITE_GOOGLE_CLIENT_ID | The Google sign-in client that lets The Current save Gmail drafts |
| VITE_GMAIL_SENDER | The address the drafts are saved in: admin@palmriveracademy.edu.vn |

- An optional fifth, VITE_WEBSITE_URL, defaults to https://pra.edu.vn.
- Bowen holds the values. They are never in the code: git ignores the file. `.env.example` lists the names with no values; `.env.offline` has empty database values for offline mode.
- The values are built into the site at each deploy. A deploy from a laptop without `.env`, or with the database values missing, publishes a site that cannot see the database: every user gets the amber "Offline mode" band. This happened on 14 September 2026, and again on 19 October 2026, the morning after the move to a new laptop, because `.env` had not been copied over. The fix is to put the file back and deploy again.
- Since 19 October 2026, `vite.config.js` checks for the database values before it builds. Without them the build stops with "No VITE_SUPABASE_URL" and nothing is published. Keep that check.
- Without the Google client ID, **Gmail draft…** saves the PDF and opens a Gmail compose window instead; you attach the file by hand.

### On a new laptop

The `.env` file never travels with the code, so it is the step most likely to be missed when the code moves. Before the first deploy from a new laptop:

1. Copy `.env` from the old laptop into `C:\Users\sbowe\admin`, by USB stick or a password manager, never by email or chat.
2. If the old laptop is gone, rebuild the file: the database values from Supabase → **Project Settings** → **API**, the client ID from the Google Cloud project below. Claude can also read the three values from the last good deploy on GitHub (the `gh-pages` branch of BowenPRA/admin). They are meant to be public: every browser that opens The Current receives them.
3. Ask Claude to run `npm run build` in the admin folder. If the file is missing or incomplete, the build stops with "No VITE_SUPABASE_URL" and nothing goes live.

> **Ask Claude:** "I am on a new laptop. Check that the admin folder has a complete .env file, rebuild it from the last good deploy if it does not, and run a build to prove it before anything is deployed."

## Backups

> **Careful:** whether the database is backed up has not been checked (not checked since 15 October 2026). Bowen's notes record Supabase's free plan. On the free plan there are no backups, the project pauses after a week with no use, and storage is 1 GB. Paying for a plan with backups is a decision in [Known problems and open items](#/handbook/open).

The backups you make yourself:

| What | How | What it covers |
|---|---|---|
| **Export to a folder** | **Setup** → **Settings** → **Export to a folder** (Super Admin, in Chrome or Edge) | Every invoice and progress report as PDF, every proof of payment, every enrollment form's documents and signature, the student list and the invoice data as Excel. Pointed at a folder that Google Drive for desktop syncs, it is an off-site copy. Later runs write only what changed. |
| **Excel export of invoices** | **Invoices** → **Export**, or **Setup** → **Settings** → **Data export** → **Export** | Invoices, line items, payments, students |
| **Student list** | **Students** → **More** → **Export student list** | Students with photos, class lists, allergies, birthdays |
| **Leads** | **Leads** → **More** → **Export** | Active and archived families |

- Bowen's export folder was `C:\Users\bowen\Desktop\PRA Admin` (2 October 2026), synced by Google Drive for desktop.
- None of these copies the registers, the tasks, the report settings, the photo tab or the newsletter. Nothing in the sources makes a full copy of the database.
- Run the folder export at least at the end of every quarter, after reports are published and invoices sent.
- The code is backed up on GitHub only once it is pushed. Uncommitted work exists only on the laptop.
- The `private` folder, the `.env` file, the photo library and Claude's memory notes exist only on the laptop. Copy them to the shared drive or an external disk regularly.

## Trying a change safely

Claude checks changes to The Current on a copy that runs on the laptop, before anything is deployed.

- **Offline mode** runs The Current without the database. Everything is kept in that one browser's storage. The amber "Offline mode" band shows, you are signed in as "Offline admin", and the account menu has **Preview as**, to see the app as any teacher on the Teachers list. It is for trying things, never for real records: clearing the browser's data loses it all.
- Claude starts it from the Admin Email folder with the launch setting `admin-offline` (port 5178; there are spare copies on other ports for when one is busy). The admin folder has its own setting, `admin-dev`, on port 5180.
- `npm run dev` with the `.env` file present runs a local copy against the **live** database, as whoever signs in. Changes made there are real.
- There are no automated tests. `npm run lint` checks the code for mistakes, and `npm run build` checks that it builds. Everything else is tried by hand in offline mode, and the progress report layout is tested with every box at its limit.

> **Ask Claude:** "Show me the change in the offline copy of The Current before you deploy it."

## The other moving parts

### The Google Cloud project "PRA Admin"

- It lets The Current save Gmail drafts in admin@ (invoices, supply checks, the newsletter). It is a Google Cloud project made under admin@palmriveracademy.edu.vn, with the Gmail API switched on and one Web application client. The app uses it only to save drafts; it never sends.
- The client lists the addresses allowed to use it: https://current.pra.edu.vn and the laptop's offline address. When The Current moved to current.pra.edu.vn on 22 September 2026, drafts stopped the next day until the new address was added. Any new address needs adding the same way.
- The first draft in each browser session opens Google's sign-in for admin@.

### The Facebook function

- `supabase/functions/facebook-post` is, today, the one program of PRA's own that runs on a server: it posts to the Facebook Page for the Photos tab. It is deployed in Supabase → **Edge Functions**. Its secrets, the Page's ID and key, are in **Edge Functions** → **Secrets**, never in the code.
- Bowen set it up; there is no other written owner. The setup steps are in `supabase/functions/facebook-post/README.md`. See [Photos and Facebook](#/handbook/photos).
- A second function, `newsletter-build`, is written to rebuild the website when a newsletter is published. It needs a GitHub key in its secrets and is not set up yet (16 October 2026). Until it is, the website picks up a newly published issue at its nightly build at 02:30 or at the next push.

### The triage's login

The triage signs in to The Current as triage@pra.edu.vn. Its login is four values in the cloud routines' environment, and a login file on the laptop that is never shown. If that account's password changes, both must be updated the same day, or every run reports "not saved". [The inbox and the triage](#/handbook/inbox) has the detail.

## The accounts everything depends on

No credential is written here. Each login is handed over in person or through a password manager.

| Service | Used for | Login held by |
|---|---|---|
| GitHub: BowenPRA (mirror sbowen209) | The four code repositories; GitHub Pages hosting for both sites | Bowen |
| Supabase | The Current's database, logins, file storage, the Facebook function, the SQL Editor | Bowen, through the admin@palmriveracademy.edu.vn account |
| Google Workspace (admin@palmriveracademy.edu.vn is super admin) | Every staff, student and parent account; the admin@ inbox; Google Groups; the shared drives | Bowen holds the super admin; the office uses the admin@ mailbox |
| Google Cloud project "PRA Admin" | Gmail drafts from The Current | Bowen, under admin@ |
| GAM on the laptop | Making Google accounts and syncing the parent groups | The laptop, signed in as admin@ |
| Google Drive for desktop | The shared drive as a drive letter; the folder export's off-site copy | Bowen's pra.edu.vn account |
| Google Search Console | pra.edu.vn in Google search | Bowen |
| P.A Vietnam | The pra.edu.vn domain and its address records | A PRA account; who logs in is not recorded |
| Wix | The old website, the palmriveracademy.edu.vn address records (the office mail depends on them), the palmriveracademy.com domain | A PRA account; renewals paid by Hien |
| Netlify | The redirect from palmriveracademy.edu.vn | Bowen |
| Facebook Page and the Meta app "The Current" | Posts, and posting from the Photos tab | Page: the staff member who manages it (Bowen's notes name Mr. David). App: Bowen |
| Claude (Pro plan) | Sessions on the laptop, the five triage routines in the cloud, artifacts | Bowen's own Claude account. Never paid API billing |
| Canva ("Marketing PRA") | Yearbook, guidebook, flyers | Marketing and communications |
| Cambridge GO | The Cambridge assessment papers | Not recorded (Bowen or Seth) |

## When something breaks

| What you see | Most likely | What to do |
|---|---|---|
| The Current is a blank white page | A deploy is still landing, or the browser has the old copy, or `CNAME` or `base` changed | Wait two minutes and press Ctrl+F5. If it stays blank, ask Claude to check `public/CNAME` and the base, and deploy again |
| The amber "Offline mode" band on the live site | The last deploy was made without the `.env` values | Deploy again from the laptop that has `.env` |
| "Run supabase/updates-… in Supabase, then save again" | A database file has not been run | Run that file (Changing the database, above) |
| "permission denied for table …" | A new table without its grant, or a rule file not run | Copy the message to Claude; it writes the missing grant as a file for you to run |
| **Gmail draft…** opens a compose window instead of saving a draft | The Google client ID is missing from the build, or Google's sign-in was closed or blocked | Allow the pop-up and try again; if it persists, ask Claude to check the client ID and the allowed addresses in "PRA Admin" |
| Gmail drafts fail after a change of address | The new address is not on the Google client's list | Add it in Google Cloud → the "PRA Admin" client → allowed JavaScript origins |
| Nobody can sign in, and Supabase says the project is paused | The free plan pauses a project after a week with no use, which can happen in the summer holiday | Sign in to Supabase as admin@ and restore the project |
| The website did not change after a push | GitHub's build failed or is still running | On GitHub, the website repository → **Actions**: a red cross means it failed; ask Claude to read the error |
| The triage reports "not saved" for leads or tasks | Its login to The Current failed | See [The inbox and the triage](#/handbook/inbox) |

> **Ask Claude:** "The Current shows [what you see]. Find out why, tell me in plain words, and fix it if it is safe to."

## How Claude ends a session

At the end of a working session Claude says what changed and what is still on you. Expect a short list every time, in this order:

1. **Still on you: run this SQL.** The file's full path, and what it does. Nothing that depends on it works until it has run.
2. **Then I deploy.** Claude deploys The Current once the file has run (or has already, if the change works without it), and checks that the live site serves the new version.
3. **Commit on your word.** The change is not in the code's history until you say "commit". Say "commit and push" to send it to GitHub too.
4. **Anything else for a person:** a click on a live page, a Vietnamese text for staff to read before a website push, a login to type.

Typical replies, in Bowen's words: "ran the sql, commit and push"; "i ran the sql. deploy it and commit". Keep the list until every item is done. Items left over at the end of a session belong on the To-Do tab ([The To-Do tab](#/handbook/todo)) or in [Known problems and open items](#/handbook/open).
