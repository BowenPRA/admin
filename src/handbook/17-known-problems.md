This chapter lists what is fragile, what is unfinished and what is waiting for a decision, as it stood on 16 October 2026. Open it before a big change, before a handover, and whenever something breaks: the cause may already be here. Each item says when it was found and where it stands.

## How to use this chapter

- Every item has a date and its status on 16 October 2026. "Open" means nothing has changed yet, even where a plan is written. "(not checked since 15 October 2026)" means the item comes from Claude's notes and nobody looked at the live system again.
- When an item is fixed, move it to the [Closed](#/handbook/open?s=closed) list at the end with the date and one line on how. Do not delete it: the closed list shows what has already been tried.
- When you find a new problem, add it to the right group with the date you found it.
- When a decision is made, write the answer next to the item and close it.

> **Ask Claude:** "Go through the known-problems chapter and check each item against the live systems; mark what has changed."

## Risks that need a decision or money

### The admin code is public and its history holds children's data

- **Found:** 22 September 2026. **Status on 16 October 2026:** open (the repository was still public when checked that day).
- The Current's code is in the GitHub repository BowenPRA/admin, which is public because GitHub Pages on the free plan only publishes public repositories.
- From 14 to 22 September 2026 the full student roster (birth dates, home addresses, parents' contacts, allergies) and the student photos were inside that code. They were moved out on 22 September 2026 and now reach The Current only from the database after sign-in. Git keeps every old version, so anyone who looks through the history can still read them.
- **Plan:** buy GitHub Pro and make the repository private, then check that https://current.pra.edu.vn still loads. Not done; last discussed 29 September 2026.
- The website repository is public too, with every photo the website shows. Bowen wants photos out of public git where possible.

### The Year 1 Showcase slides skipped the photo check

- **Found:** 16 October 2026. **Status:** open.
- The Quarter 1 Showcase page on the website carries Year 1's slides as a PDF, with about 70 photos of Year 1 children. It went live on 16 October 2026 on Bowen's word without a check against the no-photo list; Claude had flagged it.
- **To close:** a member of staff checks the slides against the no-photo list. If a child on the list appears, Claude takes the PDF off the page and you push the website. See [the photos chapter](#/handbook/photos).

### The database has no backups

- **Found:** 29 September 2026. **Status:** open.
- The Current's database is Supabase on the free plan: no backups, 1 GB for files (about twenty photo events), 500 MB for data, and the project pauses after a week with no use.
- The only copy outside Supabase is the folder export, which only the super admin can run and which runs only when clicked. It holds invoices, proof of payment, progress reports, enrollment documents (since 5 October 2026) and two spreadsheets. It does not hold attendance, leads, to-dos, newsletters or event photos.
- **Plan:** Supabase Pro at USD 25 a month (daily backups kept for 7 days, never pauses). An email to Seth and Hien proposing it was drafted on 2 October 2026 (To-Do #40), with a storage figure still to fill in. It had not been sent (not checked since 15 October 2026).
- **Until then:** run the folder export after every invoice batch and every report period. See [Behind the scenes](#/handbook/behind).

### Anyone can create a login

- **Found:** 29 September 2026. **Status:** open.
- Supabase self sign-up is switched on; **Teachers** → **Create login** in The Current relies on it. A stranger who signs up gets "View only" and can read nothing, because every right needs a row on the [Teachers](#/teachers) page with that email address. The guard works, but sign-up should still be closed.
- The two forms on the website (contact and enrollment) have only overall hourly limits, so someone could fill them and block real families for an hour. Left as a decision on 1 October 2026.
- **To close:** turn off sign-up in Supabase and make every login with the staff-accounts script instead. Claude can plan the change.

### Office mail depends on the Wix account

- **Found:** 2 October 2026. **Status:** open; steps written 2 October 2026.
- The DNS for palmriveracademy.edu.vn, including the records that deliver mail to admin@, is held in the Wix account. If Wix is cancelled before the DNS moves to P.A Vietnam, the office inbox stops receiving mail.
- The Wix Premium plan renews on 12 February 2027 (USD 118.80) and may be charged from about 22 January 2027.
- **To close:** move the DNS to P.A Vietnam, check that mail still arrives at admin@, then turn off Wix's auto-renew. palmriveracademy.com stays on Wix (Bowen, 6 October 2026). See [Google Workspace and domains](#/handbook/google).

### One person holds everything

- **Found:** 29 September 2026. **Status:** open; this handbook is the first answer.
- Bowen alone can deploy, run database files, hold the Supabase secret key, and administer Google Workspace, GitHub, Netlify, Supabase and the Claude account. Ms. Xuan has a 14-page guide to The Current but no admin access.
- **Still needed:** a second super admin in The Current and in Google Workspace; a written owner for the Facebook app's key and the Supabase function secrets; the handover list in [Working with Claude](#/handbook/claude?s=taking-over-from-bowen) worked through.

## Fragile parts of the code

### No safety net

- **No automated tests** (29 September 2026, open). The only automatic check is the code linter. Each change is tried by hand in the offline copy; database files are tested before they are handed over; report PDFs are tested by script at their character limits. A change can still break a screen nobody looked at.
- **Deletes cascade, with no undo** (open). Deleting an invoice deletes its payments and proof files. Deleting a student deletes every attendance mark and trip they ever had. Deleting a report deletes its learning areas; deleting a photo event deletes its photos and posts. There is one confirm box and no recycle bin. For a leaver, set the status to Past instead.
- **No audit trail** (open). Invoices, payments, students, families and settings record when they last changed, not who changed them. Nothing records who deleted what.
- **Settings are saved whole** (1 October 2026, left as a decision). The fee schedule, the calendar and the report settings are each one document, and Save writes all of it. Two people editing Settings at the same time overwrite each other. Edit Settings one person at a time.
- **No unsaved-changes warning on an invoice** inside the app (only when the browser tab closes), and **no error screen**: a crash shows a blank page (1 October 2026, left as decisions).

### Year-specific code

- **Found:** 29 September 2026. **Status:** open; the first rollover is summer 2027.
- About 46 places in 12 files are written for 2026-2027, and there is no new-year workflow. The files:
  - `src/lib/fees.js`: the academic year, every default amount, the payment deadlines, and the calendar with quarter dates and class days per month
  - `src/lib/report/defaults.js`: the report year and the four periods
  - `src/data/schedule.js`: the built-in timetable
  - `src/data/staff.js`: the staff list and who teaches what
  - `src/data/rosterIndex.js`: who was on the 2026-2027 roster, for the reduced Quarter 4
  - `src/pages/InvoiceBuilder.jsx`: the default installment dates
  - `src/lib/placement.js`: class by birthday, written against 2026-2027
  - `src/lib/i18n.jsx`: a few labels that say 2026-27
- The Settings page cannot change the quarters' real start and end dates; only `fees.js` can. Moving students up a year has no button.
- **The Current holds one academic year at a time.** The first invoices of a new year fall due while the old year is still running (the early-bird deadline was 20 May in 2026), but switching the saved year changes every new invoice's prefix and prices and the calendar that attendance reads. How to bill the new year while the old one finishes has not been worked out. **Found:** 16 October 2026, while writing [The year at PRA](#/handbook/the-year). **Status:** open; settle it in the May 2027 planning session.
- [The year at PRA](#/handbook/the-year) has the steps for the new year.

### Accounts and keys in the code

- **A personal Gmail as fallback super admin** (1 October 2026, left as a decision). `src/lib/AuthContext.jsx` makes one address in `ADMIN_EMAILS` a super admin whatever the database says. That address is Bowen's personal Gmail. Change it at handover.
- **Office accounts in two lists** (open). `OFFICE_ACCOUNTS` in `src/data/staff.js` and the staff-accounts script each list the office. They disagree: Nga is in the script but not in `OFFICE_ACCOUNTS` (checked 16 October 2026), so she cannot be picked as a lead owner.
- **Gmail drafts rely on a Google Cloud sign-in client** called "PRA Admin", under admin@. If it is deleted, The Current opens a compose window instead of saving a draft.
- **Facebook posting relies on a Page key** kept in a Supabase function's secrets, with no written owner besides Bowen.

### Smaller weak spots

- **The spreadsheet library** (29 September 2026, open). The Current reads and writes Excel files with the `xlsx` package, version 0.18.5, which has a known high-severity security advisory. The risk is highest when opening a spreadsheet from outside PRA. No replacement has been chosen.
- **Enrollment forms are placed by name** (2 October 2026, reduced). A form attaches to an existing student only when the names match word for word and exactly one record fits. Twins can still be confused, and there is no merge button.
- **Roster import matches by name only.** **Settings** → **Import roster** matches students by name and puts an unknown level in Year 1.
- **Enrollment documents are never cleaned up.** Files uploaded with a form that was never sent stay in the store (1 October 2026, left as a decision).
- **Offline mode keeps data in one browser.** Clearing that browser's site data loses it. It is for testing only.

### The triage and the mail

- **A used-up allowance stops the cloud runs without warning** (15 October 2026, the 06:00 and 08:00 runs). The first sorting run picks up the early mail, but the digests come only from a morning update, so run it by hand from a session. See [the inbox chapter](#/handbook/inbox).
- **The triage login's password lives in two places.** If it is renewed with the admin repository's triage-account script, the "PRA triage" cloud environment needs the new value the same day, or every run reports "NOT SAVED".
- **GitHub must stay connected** to the Claude account. If it is disconnected, runs are skipped for up to 72 hours, and then the routines switch themselves off.
- **Links in triage mail cannot be clicked**, and pictures cannot go through the Gmail connector. Both are known limits of the connector, not faults in a run.
- **The shared drive "Palm River Administration" has no single owner**, and Bowen is not a member, so the signed enrollment forms on it are reached through admin@ only (6 October 2026).

## Database files not confirmed as run

A database change is an SQL file that a person runs in Supabase (**SQL Editor** → **New query** → paste → **Run**; see [Behind the scenes](#/handbook/behind)). The code does not record which files have run. These were handed over and never confirmed.

| Handed over | What the file does | Status on 16 October 2026 |
|---|---|---|
| 21 September 2026 | Early Years teacher links (or **Teachers** → "Add 10 new classes from the schedule") | Probably run: the review of 29 September found every file up to 28 September in the live database |
| 21 September 2026 | Proof of payment on receipts | Probably run (same review), though still listed as unconfirmed on 1 October |
| 22 September 2026 | The private store for student photos | Probably run: photos were uploaded to it later |
| 28 September 2026 | Website state on event photos | Probably run (same review) |
| 29 September 2026 | A Facebook column on posts | Not run on 29 September; the Facebook function was redeployed on 1 October, so it may have run since |
| 1 October 2026 | Receipt numbers made unique | Unconfirmed |
| 1 October 2026 | Who may delete a To-Do task | Unknown on 5 October |
| 2 October 2026 | Master Minds on Year 1 and Mr. Chiến for Movement (or three clicks on the live site instead) | Unconfirmed |
| 8 October 2026 | Bowen's Year 7 Quarter 1 Science and Maths comments, two files | Unconfirmed; five students' comments and one Maths score still to write |
| 16 October 2026 | The first Quarter 2 newsletters, English and Vietnamese, two files | Handed over on 16 October |
| 22 October 2026 | Emails after website forms and scheduled newsletters (the outbox) | Handed over on 22 October, with the mailer to install in admin@ (`scripts/mailer/README.md`) |

Also waiting: one Kindergarten student's legal first name, to be typed on the record by the office (21 September 2026; the name is in Claude's notes), and a yes or no on an extra update in the enrollment placing function that would touch enrolled students (item 10 of the 2 October review).

The exact files, for searching or for Claude:

```
C:\Users\sbowe\admin\supabase\updates-2026-09-21-early-years.sql
C:\Users\sbowe\admin\supabase\updates-2026-09-21-receipt-proof.sql
C:\Users\sbowe\admin\supabase\updates-2026-09-22-private-photos.sql
C:\Users\sbowe\admin\supabase\updates-2026-09-28-event-photos-website.sql
C:\Users\sbowe\admin\supabase\updates-2026-09-29-facebook.sql
C:\Users\sbowe\admin\supabase\updates-2026-10-01-receipt-numbers.sql
C:\Users\sbowe\admin\supabase\updates-2026-10-01-todo-delete.sql
C:\Users\sbowe\admin\supabase\updates-2026-10-02-master-minds-movement.sql
C:\Users\sbowe\Desktop\Admin Email\year7-q1-reports.sql
C:\Users\sbowe\Desktop\Admin Email\year7-q1-reports-2.sql
C:\Users\sbowe\Desktop\Admin Email\q2-week-1-newsletters.sql
C:\Users\sbowe\Desktop\Admin Email\q2-week-1-vietnamese.sql
C:\Users\sbowe\admin\supabase\updates-2026-10-22-mail.sql
```

### How to tell whether a file has run

- **The app tells you.** A screen that needs a missing column shows a message that names the file to run and says to save again.
- **Claude can probe.** It asks the live database for the new column through the triage login; a missing column answers with an error. The probe reads no student or family data.
- **Run it again if in doubt.** Every file Claude writes is meant to be safe to run twice, and its first lines say so.

> **Ask Claude:** "Check which of the unconfirmed database files in the known-problems chapter have run on the live database, and tell me which ones I still need to run."

## Work not yet pushed or committed

As of 16 October 2026, checked with git and against the live site that day:

- **The Current:** one commit, the newsletter editor's rename of The Palm Press to Student Blog (`2ab6f3a`), is committed but not pushed; it went live with the handbook's deploy on 16 October 2026. The handbook (this chapter included), the Handbook page and its checker are deployed but not committed yet.
- **The website, the triage and the redirect:** nothing waiting on the laptop; each matches GitHub.
- **The Year 7 Maths assessment paper** of 6 October 2026 is committed (`73e4794`); whether the live Assessments tab shows it was not checked.

> **Rule:** `npm run deploy` publishes everything in the admin folder, committed or not. Before a deploy, check what is in the folder. If another session's unfinished work is there, wait for it, or deploy a clean copy.

A commit that is not pushed exists only on the laptop. Push once the work is checked.

> **Ask Claude:** "Show me what is uncommitted or unpushed in the three repositories, and what a deploy of The Current would publish."

## Open decisions waiting for Bowen

### Money, accounts and mail

| Since | Decision | Notes |
|---|---|---|
| 2 October 2026 | Supabase Pro | See [the database has no backups](#/handbook/open?s=the-database-has-no-backups) above |
| 29 September 2026 | GitHub Pro and a private admin repository | See the first risk above |
| 8 October 2026 | admin@pra.edu.vn for parents | Two separate admin accounts exist; mail to admin@pra.edu.vn reaches nobody. Plan offered: an alias and "send mail as" on the main admin@ account, then change the address shown on the website and invoices |
| 8 October 2026 | Invoice email: BCC Hien by default? | 12 of the 16 fee announcements sent in September and early October copied her; the app has CC but no BCC. Also open: the "IMPORTANT:" prefix, the office signature (it has the old-domain website line), wording per invoice type, a Vietnamese staff read |
| 1 October 2026 | Clickable links in triage mail | The Gmail connector turns every link into a Google redirect. A way round it (a script under admin@ or the Gmail API) is not chosen |

### The Current

| Since | Decision | Notes |
|---|---|---|
| 16 October 2026 | Nga cannot own a lead | She is an office account in the script but not in `OFFICE_ACCOUNTS`. Whether that is intended is not known |
| 22 October 2026 | The thank-you emails' wording | Written by Claude in plain English and Vietnamese, unread by Yvonne and by Vietnamese staff; no response time promised. Edit under **Enrollments** → **Emails** |
| 7 October 2026 | A documents section on the student window | Passports and uploads reachable from the student's own record |
| 1 October 2026 | Practice packets in the Assessments library | Keep them beside the assessment papers, or take them out |

### Google Workspace and the mailing lists

| Since | Decision | Notes |
|---|---|---|
| 8 October 2026 | About 50 past-student Google accounts | They sit in /Students: keep, suspend or delete |
| 8 October 2026 | A block on direct GAM commands | A Claude setting that stops Claude running GAM directly or reading `C:\GAMConfig`; offered, no answer |
| 15 October 2026 | Parent mailing lists | The menu list was synced on 15 October once the meals answers were in. The Early Years list has not been synced. Whether pending families go on the lists is open. One parent address was refused by Google and needs checking in The Current |
| 15 September 2026 | Two teachers' email addresses | Not confirmed for Ms. Thoa (written "Thao" in places) and Tan |

### The website and the wording

| Since | Decision | Notes |
|---|---|---|
| September 2026 | Quarter 4 start date | The fee sheet says 29 March 2027; the PRA calendar says 25 March. The website gives the 22 March payment date and starts Quarter 4 on 25 March in its calendar grid |
| 5 October 2026 | Trial-day price | The fee sheet and the website say 1,600,000 VND; the admissions SOP document still says 1,500,000. The triage's notes were corrected on 5 October. The SOP document needs the same fix |
| 29 September 2026 | Staff titles | Should Mr. David stay "Deputy Head Teacher"? The Vietnamese titles "Chủ sở hữu" and "Phó giáo viên trưởng" read stiffly; "Lễ tốt nghiệp" for graduation is unconfirmed |
| 30 September 2026 | Enrollment form wording | "Summer Program 2026" is still offered under "I am enrolling for"; should a birth certificate be named for a child with no passport or ID card? |
| 6 October 2026 | Old Wix maths pages | They redirect to the home page; Bowen never said whether they should go elsewhere |
| 30 September 2026 | The old Jotform forms | 37 old submissions to export to Excel; the importer is not written |

### Waiting on staff

From the notes up to 15 October 2026; check the [To-Do](#/todo) tab for the current state.

- **Yvonne:** send an enrollment form again to test it (To-Do #32); answer the questions on incoming students and parent emails (To-Do #45, due 9 October 2026); enter the four incoming children from Leads.
- **Seth:** check the traveling-student feature with a real trip (To-Do #34) and confirm the 06:00 run suits him (To-Do #35).
- **Hien:** the exact Twinkl renewal figure of 14 October 2026, which is only in the Twinkl account or on the card statement (To-Do #7).
- **Vietnamese-speaking staff:** read the new Vietnamese listed under the website TODOs below.

### Clean-up on Bowen's side

All of these were his to do; none was confirmed done (not checked since 15 October 2026).

- Turn off the three retired account skills (inbox-triage-daily, inbox-status-check, team-todo-resolver) in the Claude app's skill settings (1 October 2026).
- Stop the old Cowork scheduled triage, which would send a second set of digests, and delete the leftover one-off routine "PRA triage environment check" at https://claude.ai/code/routines (1 October 2026).
- Retire the GitHub Pages fallback of the redirect repository, and delete the empty repository palmriveracademy-www-redirect (still there on 16 October 2026) and its laptop folder (7 October 2026).
- Delete the test drafts "TEST link formatting A-F" in admin@ Drafts (1 October 2026).
- Delete the one-byte test upload in Supabase Storage, in the enrollment store (30 September 2026).
- Uninstall the OneDrive app, delete the `OneDrive` user environment variable, and remove the OneDrive folder from Cowork's trusted folders (30 September 2026).
- About 170 Mid-Autumn photos on the shared drive were never brought into the library, and the question of the outside photographer's watermark is open (30 September 2026).
- Check Meta Business Suite for posts deleted while scheduled before the fix of 1 October 2026.

## Website TODOs

From the website's own plan and notes, as of 16 October 2026. [The website chapter](#/handbook/website) has the detail.

- The Quarter 4 start date (see the decisions above).
- Parent and teacher meeting dates for 2026-2027 are not on the calendar.
- Whether to keep a promotion slot on the home page.
- A calendar file to add to phones (`.ics`): planned, not built.
- A public photo gallery page, the long-term aim of the photo library. The `/album/` page is internal.
- Ages: the Global Program page says 2 to 14; the Early Years page says 20 months to 4. Bowen to confirm.
- Quarter 3 starts on 5 January 2027 on the site; the calendar PDF colours 4 January. Not questioned.
- Better staff photos for Bowen, Ms. Tham and Ms. Thắm V (600-pixel squares from the old site) and Ms. Duyen (low resolution).
- Whether IGCSE comes back on the Lower Secondary page.
- A Vietnamese text of the admission contract (English only until PRA supplies one).
- A staff read of every recent Vietnamese line: the privacy page, the forms, the reel, the calendar key, the blog, the event pages, the newsletter pages.
- The footer email is admin@palmriveracademy.edu.vn; it follows the admin@pra.edu.vn decision.
- The home noticeboard cards never expire on their own. Prune them by hand: the Thanksgiving card after 26 November 2026, the two offers that run to December 2026.
- The Vietnamese check lists the robots and sitemap pages as missing twins. Harmless; they could be added to its skip list.
- The Google Business Profile link and the address wording after the 2025 ward changes.

## Dates to watch

| Date | What happens | What to do before it |
|---|---|---|
| When GitHub emails | The GitHub key for website builds ("The Current: rebuild website", made 22 October 2026) expires | Make a new one and replace the `GH_TOKEN` secret (see [Behind the scenes](#/handbook/behind?s=the-facebook-function)) |
| 30 October 2026 | Supabase stops giving new tables to the app's roles by itself | Nothing for you: every new SQL file grants its tables (the rule is in `supabase/README.md`) |
| 26 November 2026 | The Thanksgiving card on the website's home page goes out of date | Prune it after the day |
| 5 January 2027 | Google changes who may post to a group that limits posters | Make admin@ a Manager of the three parent lists and check allstaff@ (steps on To-Do #27; not checked since 15 October 2026) |
| about 22 January 2027 | Wix may charge the renewal | Move the DNS to P.A Vietnam and turn off auto-renew (see the risks above) |
| 12 February 2027 | Wix Premium renews | As above |
| 30 May 2027 | palmriveracademy.edu.vn renews at P.A Vietnam | Renew it: the redirect and the office mail depend on it |
| about July 2027 | pra.edu.vn renews (last renewed 15 July 2026) | Renew it at P.A Vietnam |
| summer 2027 | The first move to a new academic year | Plan it: see [Year-specific code](#/handbook/open?s=year-specific-code) |
| 29 April 2028 | palmriveracademy.com paid until then, at Wix | Decide whether to keep it |

## Things that look wrong but are deliberate

Do not "fix" these.

- **On Target is stored as 3 and Confident as 5.** The five levels are saved as ids, not as an order: Emerging 1, Practicing 2, On Target 3, Moving Beyond 4, Confident 5. When the scale was renamed on 22 September 2026 each saved value kept its place on the scale. Every saved report uses these numbers; the screen and the PDF show the levels in the right order.
- **Mr. Chiến's teacher row has no login.** Its email column holds `no-login:chien`, which can never match a sign-in. It exists so his name prints on Movement for Years 1 to 6; the head gives his levels on the reports.
- **Pending students are billable but not on the register.** New and returning students start as pending. The invoice builder includes them; attendance, reports and counts leave them out until someone sets them to active by hand.
- **The triage login is not a person.** triage@pra.edu.vn is a login in The Current with the role "triage", used by the triage scripts. It may read, add and update Leads and To-Do tasks, never delete, and cannot read students. Claude's own notes on To-Do tasks show as "Inbox triage", whether a cloud run or a session wrote them. Do not remove the login.
- **The handbook is in English only.** The page title and buttons follow the EN/VI switch; the chapters do not.
- **A(T) counts as an absence.** A traveling student is still absent for attendance (Bowen, 1 October 2026).
- **Late counts as attended.**
- **The current report period stays on the quarter that ended** during the break between quarters, so reports can still be finished.
- **Only students on the 2026-2027 enrolled roster get the reduced Quarter 4.** New and returning students pay a full Quarter 4.
- **Students are listed priciest first on an invoice**, so the sibling discount lands on the cheapest child.

## Closed

Move items here when they are fixed, newest first, with the date and one line on how.

- **Older Vietnamese wording in The Current.** About 43 older strings used the old word for students; Bowen held them on 2 October 2026. Closed 20 October 2026: the invoices, the receipt, the force majeure clause and every screen label say "học viên". Invoices saved before then keep the old word in their saved table until they are rebuilt.
- **The menu mailing list waited for the meals answers.** Closed 15 October 2026: every meals answer filled in, list synced.
- **Student Google accounts could email anyone.** Closed 9 October 2026: delivery rules per unit.
- **The invoice bug list of 17 September 2026** (a student's level written back from an invoice, receipt numbers not unique, last save wins on paid). Closed 1 October 2026 in the code; the receipt-number file is listed above as unconfirmed.
- **Lists cut off at 1,000 rows.** Closed 1 October 2026: every list is read 1,000 rows at a time until the end.
- **Website enquiries were lost.** The first contact form posted to a placeholder address. Closed 30 September 2026: forms save into [Leads](#/leads).
