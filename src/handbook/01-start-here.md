This handbook is how the admin work at Palm River Academy is done: the admin app called The Current, the public website, the shared inbox and its automatic sorting, and the way all of it is run with Claude. It was written for the person who takes the admin role over from Bowen, and it assumes you can use a browser, email and Google Drive, and that you have Claude to help with the rest. Read this chapter first. It says how to use the handbook, the five rules that matter most, what the three systems are, and what to do in your first week.

## What this handbook is

- Nineteen chapters, in English, inside The Current under **Setup** → **Handbook**, at the foot of the menu on the left. Office accounts see it; teachers do not, because it covers fees and the inner workings.
- The search box at the top looks through every chapter. The list under a chapter's title jumps to its parts. **Print this chapter** prints what you are reading; **The whole handbook** at the bottom of the chapter list prints everything.
- It was written on 15 and 16 October 2026 from the code of the three systems, Claude's notes of every decision since September 2026, and about 600 of Bowen's own instructions to Claude since August 2026. Each chapter shows the date it was last gone through. A date more than a quarter old means the chapter may have drifted; [Keeping this handbook up to date](#/handbook/updating) says what to do about that.
- Where a step needs the computer rather than the browser, the chapter gives the sentence to say to Claude in a box that starts **Ask Claude:**. Copy it as it is. [Working with Claude](#/handbook/claude) explains why that works and where it stops.

## How to read it

1. **Today:** this chapter, then [The Current, tab by tab](#/handbook/the-current), [Working with Claude](#/handbook/claude) and [Rules and wording](#/handbook/rules).
2. **This week:** the chapter for each job as it comes up. Invoices are in [Fees, invoices and receipts](#/handbook/fees); a new family is in [Students, families and enrollment](#/handbook/students); the morning email digest is in [The inbox and the triage](#/handbook/inbox).
3. **Keep open:** [Known problems and open items](#/handbook/open). It is the honest list of what is fragile and what Bowen left unfinished, and it is the chapter most likely to need your decisions.
4. **When a word is new:** [Glossary and who is who](#/handbook/glossary).

## The five rules that matter most

Every rule Bowen set is in [Rules and wording](#/handbook/rules). These five are the ones that cause real harm when broken.

1. **Palm River Academy is a language center, never a school.** Not on an invoice, a report, the website, a Facebook post or an email. The legal name is Palm River Academy English Center. In Vietnamese the center is "trung tâm" and the children are "học viên". The reason is legal: PRA is not licensed as a school, and the word in writing is a liability. <!-- allow -->
2. **Claude drafts, people send.** No email to a parent, an applicant or a vendor ever leaves without a person pressing Send. The Current saves invoice emails as Gmail drafts; the triage saves reply drafts and sends only to four staff addresses. Facebook posts are prepared by Claude and published by a person.
3. **Passwords and keys are typed by you, never by Claude, and never written down in the code or in this handbook.** The database's secret key, the stock password for new accounts, the Google sign-ins: you type them when asked. Claude stops and waits.
4. **Nothing in the database changes until you run the file yourself.** Claude writes a file; you paste it into Supabase's SQL Editor and press Run. The usual loop for any change is: the database file (you) → deploy (Claude, without asking) → commit to the code's history (on your word). [Behind the scenes](#/handbook/behind) has the steps.
5. **Children's data stays private.** Names, birthdays, addresses, parents' contacts and photos live in the database behind a sign-in, never in the public code, on the website or in this handbook. A child's photo reaches the website or Facebook only after a person has checked the no-photo list; Claude never signs that off.

Two more that are not about harm but about the look of the place: progress reports are always one A4 page and their text limits are never lowered, and everything written for parents is plain and said once, with no AI flourish.

## The three systems

| System | Address | What it does | Who uses it | Where the code lives | Chapter |
|---|---|---|---|---|---|
| **The Current** | https://current.pra.edu.vn | Students, families, attendance, invoices and receipts, progress reports, leads and enrollment forms, the To-Do list, photos, assessments, the newsletter, this handbook | Office staff and teachers, each with a role | The `admin` folder on the admin's laptop; GitHub BowenPRA/admin; the database at Supabase | [The Current, tab by tab](#/handbook/the-current) |
| **The website** | https://pra.edu.vn and https://pra.edu.vn/vi/ | What prospective families see: programs, fees, staff, events, the Student Blog, the contact and enrollment forms, which save into The Current | Office staff through Claude | The `pra-website` folder; GitHub BowenPRA/website; GitHub Pages builds it on every push | [The website](#/handbook/website) |
| **The inbox and the triage** | admin@palmriveracademy.edu.vn | The shared inbox, sorted every weekday by Claude routines in the cloud: labels, reply drafts, forwards to the right person, digests, leads and tasks into The Current | Yvonne, Seth, Hien and the admin read the results | The `pra-triage` folder; GitHub BowenPRA/triage; the routines in the admin's Claude account | [The inbox and the triage](#/handbook/inbox) |

Around them sit Google Workspace (every account, the parent mailing groups, the shared drives), described in [Google Workspace and domains](#/handbook/google), and Claude itself, described in [Working with Claude](#/handbook/claude). Nothing here runs on paid API usage: all of it runs on one Claude Pro plan.

## The people

| Who | Role at PRA | In this handbook |
|---|---|---|
| **Bowen** | Admin until the handover; built all three systems with Claude | Super Admin in The Current; the person whose rules fill [Rules and wording](#/handbook/rules) |
| **Seth** | Head of Academy | Head Teacher role: everything in The Current; receives every forward and digest from the triage; reviews and publishes reports |
| **Yvonne** | Parent communication and admissions | Admin role; owns leads, enquiries, enrollment, schedules and absences in the inbox |
| **Hien** | Property Manager (Operations Manager on the website) | Admin role; owns fees, bills, utilities, insurance and facilities in the inbox |
| **Nga** | Accountant | Admin role since 8 October 2026 |
| **Duyen** | Office | Admin role; one report area |
| **The teachers** | David, Kiu, Solo, Caleb, Thanh N, Tham N, Thắm V; also Mr. Chiến and Thoa | Teacher role: their own learning areas and homeroom parts of reports, attendance for their year groups. Mr. Chiến and Thoa appear on reports or the website but have no login. |
| **Ms. Xuan** | Owner | No account in The Current; a separate guide was written for her in September 2026 |

Only confirmed email addresses are written out in [Glossary and who is who](#/handbook/glossary).

## What you need on day one

- **Your own account in The Current** as Super Admin, on a pra.edu.vn address. Bowen makes it before the handover with the account script (it needs the database's secret key, which he types). Do not share his login.
- **The admin@palmriveracademy.edu.vn mailbox.** It is more than an inbox: it is the Google Workspace super admin, the email the Supabase database account is under, the account the Gmail connector and the triage work through, and the sign-in for GAM. Change its password at the handover and set your own recovery phone and email.
- **The laptop, or what is on it.** The three code folders, the `.env` files that hold the keys, GAM and its configuration, the photo library, and Claude's memory folder for the Admin Email session folder. [Behind the scenes](#/handbook/behind) lists all of it; a fresh laptop can be set up with Claude's help, but the keys have to be carried over by a person.
- **The GitHub account BowenPRA** (with its mirror sbowen209), or your own account added as an owner of the three repositories.
- **A Claude Pro plan** with the Claude desktop app, the Admin Email folder open in the Code tab, and the Gmail connector signed in as admin@. The triage routines live in the Claude account that made them, so they are re-created under yours (see the handover list below).
- **The rest of the logins** in the table in [Behind the scenes](#/handbook/behind): Netlify, Cloudflare (website visitor numbers), P.A Vietnam (DNS), Wix, the Facebook Page, Google Cloud, Canva, Acellus, Cambridge GO, Twinkl.

## Your first week

Do each of these once, with the matching chapter open.

1. Sign in to The Current, change your password, and read the Home page: today's lessons, the attendance cards, your reports, the To-Do count.
2. Watch a teacher take the register on a phone, then open **Attendance** yourself and find the month summary. ([Attendance and the schedule](#/handbook/attendance))
3. At 08:00 on a weekday, read the morning digest that reaches Seth, Yvonne and Hien, and the report to the admin. Then open the Triage Log in the triage folder and match them up. ([The inbox and the triage](#/handbook/inbox))
4. Open **Invoices**, pick a paid invoice, open its PDF, its payments and its receipt. Then open the **Invoice builder** and walk through the steps without creating anything. ([Fees, invoices and receipts](#/handbook/fees))
5. Open **Reports**, open one student's report in the editor, and look at the PDF preview and the red and amber marks. ([Progress reports](#/handbook/reports))
6. Open **Leads** and **Enrollments** and follow one family from enquiry to student record. ([Students, families and enrollment](#/handbook/students))
7. Run one session with Claude. Open the Admin Email folder in the Code tab and type: "Show me the to-do list and tell me which tasks are for Claude." Read how it answers, then ask it for one small change and watch it deploy. ([Working with Claude](#/handbook/claude))
8. Read [Known problems and open items](#/handbook/open) to the end and write down the decisions that are yours.

## A normal week

- **Every weekday**, the triage runs from 06:00 to 19:30 Vietnam time: an early check, the morning update at 08:00 with digests, hourly sorting, the day recap at 15:00, two evening checks. You read what reaches you and act on "Needs direct attention". Leads from the website appear in **Leads**; tasks staff asked for by email appear in **To-Do**.
- **Every day**, registers are taken; the Home page shows which are done. Missing marks show on the month summary.
- **Fridays at 16:30**, the newsletter and the menu go to parents. The **Newsletter** tab (live since 16 October 2026) builds the issue; [The year at PRA](#/handbook/the-year) has the rhythm.
- **After an event**, photos go through the album, the no-photo list and then the Photos tab, Facebook and the website. ([Photos and Facebook](#/handbook/photos))
- **Two to three weeks before a quarter ends**, invoices for the next quarter go out as Gmail drafts; the last week of a quarter is report writing; the first week of a new quarter is **Class references**, publishing and printing. ([The year at PRA](#/handbook/the-year))

## The handover list

For Bowen and the new admin to go through together, in this order. Claude does the items marked so, after a yes.

1. The new admin's account in The Current as Super Admin, made with the account script. Then the two places in the code that name the admin: the office accounts list in `src/data/staff.js` and the fallback Super Admin address in `src/lib/AuthContext.jsx`. (Claude)
2. The triage: the address that may change labels by email, the "report to Bowen" in every run, and the four internal addresses, in the triage folder's `CLAUDE.md`, its docs and its skills. (Claude)
3. The admin@palmriveracademy.edu.vn mailbox: new password, new recovery phone and email, the new admin as a second Workspace super admin. (A person, in Google Admin.)
4. The triage routines re-created under the new admin's Claude account, in the same five slots, and switched off in Bowen's. The log and the code stay where they are. (Claude, with the new admin present; new routines are never made without asking.)
5. GitHub: the new admin added as an owner of BowenPRA/admin, BowenPRA/website and BowenPRA/triage, or the account itself handed over. Decide the two money items in [Known problems and open items](#/handbook/open) at the same time: making the admin repository private and paying for Supabase backups.
6. Supabase: the account email and the secret key. The key is typed by the admin only, so Bowen hands it over in person or through a password manager, never in a chat or an email.
7. The laptop: the three code folders, the `.env` files, GAM (`C:\GAM7` and `C:\GAMConfig`), the photo library `PRA Photos`, and the Claude memory folder for the Admin Email session folder, which holds every rule and decision Claude remembers. If the laptop changes hands, nothing else is needed. If it does not, Claude can set up a new one; the keys and GAM's sign-in have to be redone by a person. Copy the admin folder's `.env` before the first deploy ([Behind the scenes](#/handbook/behind?s=on-a-new-laptop) has the steps): on 19 October 2026 a deploy from a new laptop without it put the live Current in offline mode.
8. Netlify, Cloudflare (under admin@palmriveracademy.edu.vn), P.A Vietnam, Wix, the Facebook Page (Bowen is not its manager; find who is), Google Cloud project "PRA Admin", Canva, Acellus, Cambridge GO, Twinkl: each login moved or shared.
9. Read this handbook together, chapter by chapter, against the real screens, and set every "Last gone through" date. (Claude updates the chapters as you go.)

> **Ask Claude:** "We are doing the handover from Bowen to me. Go through the handover list in the Start here chapter of the handbook with us, one item at a time, and tell us which ones you can do and what you need from us for each."
