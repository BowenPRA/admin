The Current is PRA's own web app for the office and the teachers: students, attendance, invoices, progress reports, leads, enrollment forms, photos and the task list. This chapter covers signing in, who can see what, and every page in the order the menu lists them. Open it when you are new to the app, when you give someone access, or when someone leaves. Each page has its own chapter for the detail; the links are at the end of each part.

## What The Current is

The Current runs in a web browser at https://current.pra.edu.vn, on a laptop or a phone (the register and the phone menu are built for thumbs). It is one web page that talks straight to a database run by a company called Supabase. That database is shared with another PRA app, the student Dashboard, which is why every table in it starts with `adm_`. PRA has no server of its own apart from one small function that posts photos to Facebook. The page is hosted for free on GitHub Pages; the code is in `C:/Users/sbowe/admin` on the laptop that holds the code, and on GitHub as BowenPRA/admin. A change to how the app works is a change to that code followed by a deploy (see [Behind the scenes](#/handbook/behind)). The app replaced the Google Sheets invoices in September 2026, the Inquiries Tracker spreadsheet on 30 September 2026, Jotform for enrollment on 30 September 2026, and the Team To-Do spreadsheet on 1 October 2026.

## Signing in

- The address is https://current.pra.edu.vn. The old address https://bowenpra.github.io/admin/ forwards there.
- Page addresses contain `#/`, for example https://current.pra.edu.vn/#/invoices. That is normal. A link such as https://current.pra.edu.vn/#/todo?task=23 opens task 23 on the To-Do page.

1. Open https://current.pra.edu.vn.
2. Type your PRA email in full (name@pra.edu.vn) and your password.
3. Press **Log in**.

- Always type the full email. If a short name is typed, the app tries the login pattern of the Dashboard app, which office accounts do not use.
- There is no "forgot password" link in the app. When someone forgets their password, Claude gives them a new temporary one with the account script (see "Giving someone access" below).

### Your menu and your password

Click your name at the foot of the menu on the left (on a phone, open the menu first). A small window shows **Signed in as** with your email, your role and one line on what it allows, **Change password** and **Log out**.

1. **Change password** opens a small window.
2. Type the new password twice. It needs at least 8 characters, and the two boxes must match.
3. Press **Save**. The message "Password changed" confirms it.

### English and Vietnamese

- The **English | Tiếng Việt** switch at the foot of the menu changes every label on the screen. When the menu is narrow it shows as **EN** or **VI**; click it to change.
- Invoices and progress reports have their own language, chosen on each document. The switch does not change them.
- Printouts have their own **English / Tiếng Việt** choice in their toolbar.
- The handbook is in English whichever way the switch is set.
- Many Vietnamese labels were written by Claude and have not all been read by Vietnamese staff. Every label calls students "học viên"; until 20 October 2026 about 40 older ones used the word for "pupil" that PRA avoids.

## Roles

Every login carries a role. The role decides which pages and buttons the app shows.

| Role (as the app names it) | Who has it on 15 October 2026 | What they see and do |
|---|---|---|
| Super Admin | Bowen | Everything. Only this role sees **Export to a folder** in Settings and may delete enrollment forms and their documents. |
| Head Teacher | Seth | Everything an Admin can, plus the Teachers page, Report settings, creating, publishing and translating progress reports. |
| Admin (Văn phòng) | Yvonne, Hien, Duyen, Nga (the accountant, added 8 October 2026) | Invoices, students, families, the fee settings, attendance for every year group, Leads, Enrollments, To-Do, Photos, Newsletter, Handbook. Progress reports only for a learning area the Teachers page gives them (Duyen has Technology and Art & Crafts in Year 1). |
| Teacher | David, Kiu, Solo, Caleb, Thanh, Tham N, Thắm V | Their own learning areas and homeroom parts of progress reports, attendance for the year groups they teach, Students read-only, Schedule and Assessments read-only, the Newsletter page. No Office pages. |
| View only | Anyone who signs in with no role and no Teachers row | Signed in but linked to nothing. If a Teachers row carries their email, the app treats them as a teacher. |
| Triage | triage@pra.edu.vn | Not a person. The inbox triage scripts sign in with it to add and update Leads and To-Do tasks and to read the parent lists. The app shows it as view only. |

- "Office accounts" in this handbook means Super Admin, Head Teacher and Admin together.
- For progress reports, "the head" is Super Admin, Head Teacher, or anyone whose Teachers row has **Head teacher (can edit every report)** ticked.
- A teacher's rights come from their row on the Teachers page: the learning areas ticked for each year group (for example English in Year 7) and the homeroom year groups. Attendance follows the same year groups.
- Mr. Chiến (Movement, Years 1 to 6) has no login on purpose. His Teachers row says "No login"; progress reports print his name and Mr. Seth writes his comments.

> **Rule:** the database enforces the same rights as the screen. Hiding a button is not the only protection: if an account without the right tries something, the database refuses it and the app shows the error. This is why giving someone a role is done with care, and why the public key built into the page does no harm.

> **Careful:** one of Bowen's personal email addresses is written into the code as a stand-by Super Admin for an account that has no role. It should come out before the handover. It is listed in [Known problems and open items](#/handbook/open).

## The menu

Every page you can open is listed in the menu down the left side of the screen, under a few headings. The page you are on is shaded blue. (Until 20 October 2026 the pages sat in a row of tabs along the top, with a second row for each group.)

| Heading | Pages | Who sees it |
|---|---|---|
| None, at the top | **Home**, **Students**, **Attendance**, **ECAs**, **To-Do** | Everyone; ECAs for office accounts and for teachers who run an ECA this term; To-Do for office accounts only |
| **Teaching** | Reports, Schedule, Assessments; for teachers also Newsletter | Everyone |
| **Office** | Invoices, Leads, Enrollments | Office accounts |
| **Outreach** | Photos, Newsletter | Office accounts |
| **Setup**, at the foot | Settings, Teachers (Super Admin and Head Teacher only), Handbook | Office accounts |

- A heading with no page you may open is left out. A teacher sees no Office, Outreach or Setup.
- Under the pages come the **English | Tiếng Việt** switch and your name, which opens your own menu.
- On a laptop, the small round arrow button on the edge of the menu, beside the logo, makes the menu narrow: icons only, and each page's name shows when you point at its icon. The same button makes it wide again. Each computer remembers the choice. On a screen under 1,100 pixels wide the menu starts narrow.
- On a phone or a tablet the menu is hidden. Tap the three lines at the top left to open it. It closes when you pick a page, tap outside it, or press the cross.
- On a short screen the menu scrolls, and it scrolls itself to the page you are on.
- From 8:00 to 9:00 on a class day, **Attendance** glows amber with "by 8:45" beside it, as a reminder of the morning register. [Attendance and the schedule](#/handbook/attendance?s=taking-the-register) has the detail.
- The browser tab shows the name of the page you are on, for example "Invoices · The Current".
- A red band at the top of the page reading "Could not load data." with an error after it means the app could not read the database. Reload the page. If it stays, copy the whole message and give it to Claude.

## The pages

### Home

- **What it is for:** a first look at the day. It is **Home** at the top of the menu; clicking the logo opens it too.
- **Office accounts see:** a greeting band with today's numbers as chips you can click (classes still to register, report parts left this quarter, leads that are new or due a follow-up, website messages waiting, who is traveling today, the ECAs meeting today (or, in the week before a term, the day ECAs start), students finishing this quarter, new students with checklist steps open, enrollment forms to check, and To-Do counts for you, late and to check); four quick links (**New invoice**, **Attendance**, **Students**, **Reports**); **Today's lessons** if you are on the Schedule; **Attendance today** with one row per class (Done, In progress, Not taken yet); **Your reports**; the Invoiced, Paid and Outstanding totals in VND (void invoices left out); and the most recent invoices.
- **Teachers see:** the greeting band (with their own ECA when it meets today), Today's lessons, Attendance today for their classes, Your reports, and **Your classes** (each year group with its learning areas and what each still needs).
- Deeper: each chip leads to the page that holds the work.

### Students

- **What it is for:** every student record and every family.
- **Main things you do:** add a student (**Add student**); open a student by clicking the row and change their details, status, dates or family; mark **Meals** Yes or No on the list; print **Class lists**; under **More**: **Load roster file…**, **Group into families**, **Add family** and **Export student list**; **Copy parent emails** for the rows shown.
- Two tabs, **Students** and **Families**. Status buttons: **Enrolled**, **Pending**, **Past**, **All**. Filters for year group, program, without a family, finishing this quarter, new students with steps to finish, and meals not answered.
- **Who sees it:** everyone; only office accounts can change anything. Teachers see "View only" at the foot.
- Deeper: [Students, families and enrollment](#/handbook/students).

### Attendance

- **What it is for:** the daily register and the attendance totals.
- **Main things you do:** on **Take attendance**, pick the day and a year group and tap **Present**, **Late** or **Absent** for each student, or **Mark everyone else present**; add a note or a trip. On **Summary**, read the totals for a month, a quarter or the year, and print them with **Print summary**.
- **Who sees it:** everyone. Office accounts take every year group; a teacher takes the year groups on their Teachers row.
- Deeper: [Attendance and the schedule](#/handbook/attendance).

### ECAs

- **What it is for:** the after-class activities (3:30 to 4:15 in Quarter 2): each quarter's term, its activities, who is on each list, and a register for each session. Added 21 October 2026, in place of keeping the lists from the Google Form by hand.
- **Main things you do:** see which activity runs on which day (each weekday has its own colour) and every week of the term on the term calendar; open an activity's tile; on **Register** pick the session and tap **Present**, **Late** or **Absent**, or **Mark everyone else present**; on **Students** add students, move one to the waiting list or take one off; on **Summary** see each student's sessions; **Print register** for a paper copy. Office accounts also add a term (**New term**), change it (**Edit term**) and add or change activities (**Add activity**, **Edit activity**); teachers cannot.
- **Who sees it:** office accounts, and teachers who run an ECA this term. The teacher who runs an activity takes its register and changes its list; other activities are read-only for them.
- Deeper: [Attendance and the schedule](#/handbook/attendance?s=ecas).

### To-Do

- **What it is for:** the shared task list for the team and for Claude. It replaced the "Team To-Do & Issues Tracker" spreadsheet on 1 October 2026.
- **Main things you do:** add a task (title, details, who it is for, who asked, due date, priority, up to 10 files); add a note; change the status (To do, Doing, Waiting, To check, Done) with the pill on the row. Tabs: **For me**, **All**, **To check**, **Claude**, **Done**.
- Tasks have a number (#23). The inbox triage adds tasks from staff emails through its own account and cannot delete. Seth and Bowen may delete any task; anyone else only a task they added or asked for.
- **Who sees it:** office accounts.
- Deeper: [The To-Do tab](#/handbook/todo).

### Reports

Under **Teaching**.

- **What it is for:** writing, checking, publishing and printing the quarterly progress reports.
- **Main things you do:** pick the quarter and year group; open a report and write your parts (everything saves as you type); see what is still to write; print a whole year group with **Print all** (English) or **Tiếng Việt (n)**. The head also has **Create reports**, **Update class references**, **Translate** and **Settings** (the Report settings page: wording, periods, the five levels, learning areas, templates, learner skills, signature lines).
- **Who sees it:** everyone. What you can change depends on your Teachers row; only the head publishes.
- Deeper: [Progress reports](#/handbook/reports).

### Schedule

Under **Teaching**.

- **What it is for:** the 2026-2027 timetable: each class's week with its homeroom teacher and room, each teacher's week, and the duty roster.
- **Main things you do:** read it by **Classes**, **Teachers** or **Duty**; **Print** it. Office accounts can **Edit** it and **Save**. **Built-in schedule** puts back the timetable that ships with the app.
- The Schedule is where progress reports take the homeroom teacher's name from, and where Home takes "Today's lessons".
- **Who sees it:** everyone; office accounts edit.
- Deeper: [Attendance and the schedule](#/handbook/attendance?s=the-schedule).

### Assessments

Under **Teaching**.

- **What it is for:** a searchable list of the Cambridge and PRA assessment papers for Years 1 to 9 in Maths, Science and English.
- **Main things you do:** search; switch between **My classes** and all; filter by class, subject, year and type; open a paper. Every file opens on the PRA shared Google Drive (Program curricula › Assessments Library), so only members of that shared drive can open it. The app holds only the list.
- **Who sees it:** everyone.
- Deeper: [Assessments library](#/handbook/assessments).

### Newsletter

Under **Outreach** for office accounts, under **Teaching** for teachers.

- **What it is for:** writing the two weekly newsletters, The Palm River Post (to all parents and all staff) and the Early Years newsletter (to Early Years parents and all staff), which go out from admin@ on Fridays at 16:30.
- **Main things you do:** **New issue** for a Friday; write the sections in English, then the Vietnamese; preview it as the website page, the email and the PDF; then **Publish or schedule…**.
  - **Schedule…** picks a day and time (it starts at the issue's Friday, 16:30). Seth or Bowen approves it; when one of them schedules it, that is the approval. Ten minutes before the time the page goes on pra.edu.vn, and at the time the mailer in admin@ emails it to the edition's parent group and allstaff@, with both PDFs. While it waits, the issue shows **Waiting for approval** or **Goes Fri …, 16:30**.
  - **Publish now** works as before: the page goes up at once and the email is saved in admin@'s Gmail Drafts for a person to send.
  - **Send a test…** (beside Publish, at any stage, and on a scheduled issue) emails the issue to staff only: to you, or up to six @pra.edu.vn addresses, with "[Test]" in front of the subject and a yellow box on top with your name and an optional note ("Check the Vietnamese in the Kindergarten section"). It arrives within five minutes. While writing, it is the issue as it is now, with its photos (they show for a week) and no PDFs. Once scheduled, you can choose the scheduled email exactly as it will go, PDFs attached: read that one on your phone before approving. The link to the website page works once the issue is on the website. At most ten tests an hour each. In a test of an issue still being written, a part with no Vietnamese yet shows a short grey note in the Vietnamese half, not the English a second time.
  - The email opens with two buttons in its coloured band, **Read it online** (the English page) and **Đọc trên web** (the Vietnamese page). Pages opened from them count under "From email" in the issue's readers.
  - A section takes up to four photos (two side by side, then two more).
  - Changes made after scheduling are not in the email. The window says so and offers **Schedule again**.
- Seth and Bowen see a line at the top of the Newsletter page, and on their Home page, when an issue is waiting for them. Each also gets a short email asking them to approve it.
- The page was added on 16 October 2026 and follows the layout of Seth's Google Doc "Weekly Newsletters 2026-27". Some parts (class corners, dates, reminders) are hidden for now. Since 22 October 2026 publishing starts a website build, and the issue's page is up about two minutes later.
- **Who sees it:** office accounts write and publish. Teachers see the page under Teaching; while the class corners are hidden it tells them the office writes the newsletter and there is nothing for them to do.
- There is no chapter for it yet. The website side is in [The website](#/handbook/website).

### Invoices

Under **Office**.

- **What it is for:** making, sending and tracking fee invoices, recording payments, and printing receipts.
- **Main things you do:** **New invoice** (the builder); open an invoice to edit it, make a **Gmail draft…**, **Mark as sent**, **Record payment** and **Print receipt**; change a status from the list; tick several and use **Set status…**, **Gmail drafts** or **Delete selected**; **Export Excel**; **Print summary**.
- **Who sees it:** office accounts.
- Deeper: [Fees, invoices and receipts](#/handbook/fees).

### Leads

Under **Office**.

- **What it is for:** every family who has asked about joining, one row per family, from first contact to enrolled or lost. It replaced the Inquiries Tracker spreadsheet on 30 September 2026.
- **Main things you do:** read the "From the website" panel at the top and mark messages done (each message shows whether its thank-you and the office alert went; **Emails** on the panel opens the wording and the outbox); change a family's stage; set the next step, who has it and a follow-up date; **Make the student records** when a family agrees; **Archive** families that have gone quiet; **Print summary**; **Add family**.
- The daily inbox triage adds and updates rows through its own account.
- **Who sees it:** office accounts.
- Deeper: [Students, families and enrollment](#/handbook/students?s=leads).

### Enrollments

Under **Office**.

- **What it is for:** the enrollment forms parents send from https://pra.edu.vn/admissions/enroll/. Each form arrives by itself and adds the child as a pending student, or links to an existing one.
- **Main things you do:** open a form and read every answer, including the documents and ID details; **Mark checked**; **Add pending student** for a form that came in without one. **To check only** shows the forms nobody has checked.
- Each form shows at the top whether the family's thank-you and the alert to the office went. **Emails** (top right) holds the wording of the thank-you emails, who gets the alerts, and the outbox: every email The Current has sent or is waiting to send.
- **Who sees it:** office accounts. Only the Super Admin can delete a form.
- Deeper: [Students, families and enrollment](#/handbook/students?s=enrollment-forms).

### Photos

Under **Outreach**.

- **What it is for:** the curated photos of each event, their captions, the internal notes on the event, and the draft Facebook posts.
- **Main things you do:** **Upload event** from the laptop; check each photo against the no-photo list; choose a look and write captions; prepare posts and send them with **Post to Facebook…**; choose photos for the website; **Finish event** when it is done.
- **Who sees it:** office accounts.
- Deeper: [Photos and Facebook](#/handbook/photos).

### Settings

Under **Setup**.

- **What it is for:** the numbers and names the invoices are built from.
- **Main things you do:** **Fee schedule** (every price, the sibling discount, the deadlines); **Academic calendar** (class days per month and per quarter, the printed date ranges, transport months); **Bank account**; **Center details** (the names on invoices, email, address, the legal name and tax code for receipts); **Data export** (**Export Excel**, **Export student list**, **Import roster (Excel)**); **Export to a folder** (Super Admin only); **Save**; **Reset to defaults**.
- **Who sees it:** office accounts.

> **Careful:** Save writes the whole fee schedule and calendar at once. If two people have Settings open and both save, the second one wins and the first person's changes are gone. Change Settings one person at a time.

- Deeper: [Fees, invoices and receipts](#/handbook/fees) and, for the new academic year, [The year at PRA](#/handbook/the-year).

### Teachers

Under **Setup**.

- **What it is for:** who teaches what. Each teacher's row decides which parts of the progress reports they can write and which registers they can take.
- **Main things you do:** **Add teacher**; open a row to set the title, name, sign-in email (or "No login"), the **Head** flag, **Active**, the learning areas ticked per year group and the homeroom year groups; make a login for a teacher (see "Giving someone access"). "Who teaches what" lists every year group with enrolled students and flags any learning area with nobody, and any homeroom teacher on the Schedule who cannot yet write the homeroom parts. The buttons **Add n from 2026-27 schedule**, **Add n new classes from the schedule** and **Add n homerooms from the schedule** fill rows from the timetable.
- Office accounts are listed separately at the bottom. They are made by the account script, not on this page.
- **Who sees it:** Super Admin and Head Teacher.
- Deeper: [Progress reports](#/handbook/reports).

### Handbook

Under **Setup**.

- **What it is for:** this handbook. Search, read a chapter, **Print this chapter**, or open **The whole handbook** to print every chapter.
- **Who sees it:** office accounts. Teachers do not: it covers fees and the inner workings.
- Deeper: [Keeping this handbook up to date](#/handbook/updating).

## Printouts

Each printout opens in a new tab with a toolbar: **Back**, the period or year group pickers, **English / Tiếng Việt** where it applies, and **Print**. To keep a copy, choose "Save as PDF" in the print dialog.

| What prints | Opened from | Who |
|---|---|---|
| Attendance summary: an overview sheet, then one register per year group with its notes (A4 landscape) | **Attendance** → **Summary** → **Print summary** | Everyone; teachers their own year groups |
| ECA register: one A4 page per activity with its students, allergies, a box per week (marks taken so far filled in) and the waiting list | **ECAs** → an activity → **Print register**, or **Print all registers** on the ECAs page | Everyone who can open ECAs |
| Class lists: one A4 page per class with photo, birthday, allergies and health notes, who to call, emergency contacts and pick-up list | **Students** → **Class lists** | Everyone; teachers their own classes; emergency contacts and pick-up for office accounts only. Marked confidential |
| Fees summary: money received, invoiced, still owed and how late, for a month or the year | **Invoices** → **Print summary** | Office accounts |
| Admissions summary: enquiries, stages, sources, tours and calls, enrollment forms, follow-ups due | **Leads** → **Print summary** | Office accounts |
| One invoice, full screen | An invoice → **Open PDF** | Office accounts |
| A cash receipt (Phiếu thu), English and Vietnamese | An invoice → Payments → **Print receipt** | Office accounts |
| One progress report | A report → **PDF** | Everyone who can open that report |
| Every report of a year group and quarter, one page per student, one language | **Reports** → **Print all** or **Tiếng Việt (n)** | Everyone who can see that year group |
| The timetable | **Schedule** → **Print** | Everyone |

## Giving someone access

Every staff member also needs a Google account (name@pra.edu.vn) to receive email. That is separate from The Current; see [Google Workspace and domains](#/handbook/google).

### A teacher

A teacher's login is made on the Teachers page by the Super Admin or the Head Teacher.

1. **Setup** → **Teachers** → **Add teacher**. Type the title (Mr., Ms.), the name and their PRA email.
2. Tick the learning areas they teach in each year group, and their homeroom year groups. Press **Save**.
3. Open their row again. At the bottom, open **Create a login for this teacher**.
4. Type a temporary password of at least 6 characters in **Temporary password** and press **Create login**. The message under it says whether the login was made.
5. Give the teacher the temporary password in person, not by email. They sign in and change it from the menu under their name.

- If the message says an account with this email already exists, the teacher already has a login and signs in with their own password.
- A login made this way carries no role. The app and the database treat it as a teacher because its email matches the Teachers row. If the row is removed or set inactive, the login has no rights.

### An office account

Office accounts (Admin, Head Teacher, Super Admin) are made with a script on the laptop that holds the code: `scripts/create-staff-accounts.mjs` in `C:/Users/sbowe/admin`. The list of office staff and their roles is written inside that script. The script creates any login that is missing with a temporary password, printed once, and sets everyone's role.

The script asks for the Supabase **secret** key. You type it yourself; Claude never types or sees it. The key is in Supabase (signed in as admin@palmriveracademy.edu.vn) under Project Settings → API Keys → Secret key. Today it is held by Bowen.

1. Ask Claude to add the person to the script's list with their PRA email and role (`admin`, `head` or `super_admin`).
2. Claude starts the script with `--dry-run` in the Terminal panel. You paste the key and read what would change.
3. Claude starts the real run in the Terminal panel. When it asks for the key, paste it there yourself.
4. Note the temporary password it prints and give it to the person in person. They change it from their menu.

The key shows on screen as you paste it, and the temporary password prints in the same tab. Claude does not read a tab once the key is in it, for the dry run too: read the result yourself and tell Claude what it says. On 20 October 2026 Claude read a dry run's output and the key reached the chat, so the key was due to be replaced (Supabase → Project Settings → API Keys).

The shared office inbox admin@palmriveracademy.edu.vn has its own Admin login, named Office, since 20 October 2026.

> **Ask Claude:** "Add a new Admin account to The Current for the PRA email I give you. Show me the dry run of the staff account script, then start the real run in my terminal so I can paste the secret key myself."

- The same script gives an existing login a new temporary password with `--reset` and the person's email. That is the answer to a forgotten password.

> **Ask Claude:** "A teacher has forgotten her password for The Current. Run the staff account script with --reset for the email I give you, in my terminal; I will paste the key."

- The office account list also exists in a second place in the code, `src/data/staff.js`, which decides who can be picked as the owner of a lead. On 15 October 2026 Nga was in the script but not in that file. When you add an office account, ask Claude to add it to both.
- On the command line, if Claude is not at hand, in PowerShell (the script then asks for the key):

```
node C:\Users\sbowe\admin\scripts\create-staff-accounts.mjs --dry-run
```

### The triage account

triage@pra.edu.vn is not a person. The inbox triage scripts sign in with it to read, add and update Leads and To-Do tasks (never delete), add files to tasks, read the website messages and read the parent lists for the Google Groups sync. It is made or renewed by a second script, `scripts/create-triage-account.mjs`, which also asks for the secret key and writes a login file that the triage scripts read, kept in the Admin Email folder on the laptop and never in the code. Do not delete it, do not give it a role in the staff script, and do not use it to sign in to the app. See [The inbox and the triage](#/handbook/inbox).

## When someone leaves

### A student

1. Open the student on **Students**.
2. In **Enrollment**, set the **Expected end date** to their last day. Once they have gone, set **Status** (at the top of the window) to **Past**.
3. Press **Save**.

> **Rule:** never delete a student who has attended. Deleting a student deletes every attendance mark and trip they ever had, with no undo. Their progress reports and enrollment form stay, but lose the link to them. Past keeps their history and takes them off the register, the reports and the parent mailing lists.

More in [Students, families and enrollment](#/handbook/students).

### A teacher

1. **Setup** → **Teachers**, open their row, untick **Active** and press **Save**. From that moment they cannot write report parts or take registers. Their name stays on the reports they wrote.
2. Remove their login. The app has no button for it: the login is deleted in Supabase under Authentication → Users, signed in as admin@palmriveracademy.edu.vn.
3. Their Google account is handled in [Google Workspace and domains](#/handbook/google).

> **Ask Claude:** "A teacher has left. Walk me through unticking her Teachers row and deleting her login in Supabase, and check nothing else in The Current still names her as a homeroom teacher."

### An office account

Ask Claude to take the person out of the staff account script and out of `src/data/staff.js`, then delete their login in Supabase under Authentication → Users. Reassign their open tasks on **To-Do** and their leads on **Leads** first, so nothing is left with nobody.

## The offline mode band

The Current can run without the database, keeping everything in that one browser. It is meant for trying things on the laptop. When it does, a yellow band at the top of the page reads "Offline mode: data is stored in this browser only.", you are signed in as "Offline admin", and your menu has **Preview as (offline only)** to see the app as any teacher.

- On your own laptop, while Claude is testing a change, the band is expected. Nothing typed there reaches the real records.
- On https://current.pra.edu.vn the band should never appear. If it does, the last deploy was built without the database settings (this happened on 14 September 2026, and on 19 October 2026 after the move to a new laptop). Do not type anything into it: it would be lost. Real records are safe in the database; the page cannot see them. Anything staff typed while the band was showing stays in their own browser only, so ask them to check and enter it again once the real site is back, and to reload the page.

> **Ask Claude:** "The live Current shows the yellow Offline mode band. Check the .env file on the laptop and deploy The Current again, then tell me when the live site shows the real data."
