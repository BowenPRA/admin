This chapter follows a child from the first enquiry to a complete student record in The Current: the Leads page, the enrollment form, the student statuses and IDs, the fields in the student window that change what the app does, families, the new-student checklist, the roster file and the exports. Open it when a family gets in touch, when an enrollment form arrives, when a student starts or leaves, or when a record looks wrong.

## From an enquiry to the first day

1. **A family gets in touch.** An email to admin@ is added to [Leads](#/leads) by the inbox triage. The website's contact or Book a tour form adds the family to Leads by itself and leaves the message in the "From the website" panel. A walk-in, a WhatsApp or Zalo message or a Facebook message is added by hand with **Add family**.
2. **Reply, tour, trial.** The office replies and moves the family's stage along: Contacted, Tour/call booked, Tour/call done, Trial. A trial day is billed with the **Trial day only** plan (see [Fees, invoices and receipts](#/handbook/fees)).
3. **The enrollment form.** The family fills in the form at https://pra.edu.vn/admissions/enroll/ (Vietnamese: https://pra.edu.vn/vi/admissions/enroll/). It arrives on [Enrollments](#/enrollments), adds the child as a **Pending** student with a family, and moves the lead to Enrolled. If the family agreed before sending the form, the office can make the records from the lead first with **Make the student records**.
4. **Check the record.** Open the form, press **Mark checked**, then open the student and work through the **New-student checklist**: ID, year group, start date, family and parent email, the lead link, the admission fee, the first invoice, the form.
5. **The steps outside The Current.** The **Supply check** email to the class teachers and Hien, the parent mailing lists, the no-photo list if the family chose private photos, the student's Google account (see [Google Workspace and domains](#/handbook/google)), and a word to the homeroom teacher.
6. **The first day.** Set the student's **Status** to **Enrolled**. From that day they are on the register and in the progress reports.

## Leads

**Office** → **Leads** holds every family who has asked about joining, one row per family. It replaced the Inquiries Tracker spreadsheet on 30 September 2026; the old spreadsheet's 88 families were imported the same day.

### Where leads come from

| Source (as the app names it) | How it gets onto Leads |
|---|---|
| Email | The inbox triage adds or updates the family from the admin@ inbox each day |
| Website form | The contact or Book a tour form on https://pra.edu.vn/contact/ saves it straight in |
| Walk-in, WhatsApp / Zalo, Facebook, Other | Added by hand with **Add family** |

- A website message from a new email address makes a new lead with stage New. One from an address already on Leads is attached to that family, and the family comes back out of the archive if it was there. The lead itself is left as the office wrote it.
- Each website message sends two emails: a thank-you to the family and an alert to Yvonne and admin@ (see [The emails after a form](#/handbook/students?s=the-emails-after-a-form)). The message still waits in the **From the website** panel at the top of Leads until someone marks it done, and the triage lists it in its digests.
- The triage signs in with its own account (see [The Current, tab by tab](#/handbook/the-current)). It adds and updates families, never moves a stage backwards and cannot delete.

### Stages

| Stage | Meaning |
|---|---|
| New | Enquiry received, no reply sent yet |
| Contacted | PRA has replied (information, brochure, fees); waiting on the family or on PRA |
| Tour/call booked | A visit or video call is booked; its date goes in Tour / call |
| Tour/call done | The visit or call has happened; next is usually a trial day or enrollment |
| Trial | Trial day or days booked or under way |
| Enrolled | Enrollment form received and/or fees paid |
| Lost / no reply | Chose elsewhere, or no reply after following up; usually archived |

### Working the list

- The tiles at the top (**Active families**, **Need a first reply**, **Follow-ups due**, **Tours / calls booked**, **Trial or enrolled**) filter the list when clicked.
- Each row has the family and email, the children, the program and timing, first contact and source, the stage (a dropdown that saves at once), the next step with **Who has the next step**, and the **Follow up by** date, red when it has passed.
- **Follow-up due** shows only the families whose date has come. **Archive** moves a family off the active list; **Move back to active** brings it back.
- **More** → **Download as Excel** writes every family, active and archived, on two sheets. **Print summary** prints the admissions summary. **More** → **Import tracker spreadsheet…** was for the old spreadsheet and adds only families not already there.
- An office account can be picked as the owner only if it is in the code's office list; on 15 October 2026 Nga was missing from it.

### Making the student records from a lead

1. Open the family on Leads.
2. Press **Make the student records**. Check each child's name, birthday and year group, the family's language and email, and the stage the lead should have afterwards.
3. Press **Make 1 pending student** (or **Make n pending students**).

The children start as Pending, in a family, linked to this lead. A lead marked Trial or Enrolled with no student record shows a warning until the records are made. **Link** joins a lead to a student who already has a record.

## Enrollment forms

**Office** → **Enrollments** lists the forms parents sent from the website. The form replaced Jotform on 30 September 2026. Each one saves straight into The Current; the website has no account and cannot read anything back.

### What the form asks

Five steps: the student; parents and emergency contacts; education and health; photo consent and pick-up; the admission contract, documents and signature.

- **Applying for:** the academic year (for example "Academic Year 26-27").
- **Previous schools:** for each one, its name, the language of instruction, the years there and the level reached.
- **Documents:** a photo of the child, the child's passport or ID card, a parent's passport or ID card (these three are needed to send), and the last progress report from the student's previous school (optional).
- **Photo consent:** "total" (photos may be used on the website and Facebook) or "private" (internal use only).
- Every "Yes" to a health or background question and every allergy shows as a flag on the row.

### What happens when a form arrives

- The form is attached to an existing student only when it is clearly that child: every word of the record's name is on the form, every word of the form's first name is in the record, and exactly one record fits (by birthday, or through the lead). Otherwise the form makes a new Pending student: in the lead's family when that is clear, else in the family with the same parent email, else in a new family.
- The row then shows **Pending student added**, **Already a student** or no student. **To check** stays until someone presses **Mark checked**; **To check only** shows those forms.
- The student's new-student checklist is shown inside the form window too.
- A form that came in without a student gets one with **Add pending student**.
- The family gets a thank-you email and the office an alert, both within about five minutes (next section).

> **Careful:** there is no button to merge two records. If a form made a second record for a child who already had one, copy any missing details into the right record and delete the extra one (it has no attendance yet). Do not then press **Add pending student** on the form, or the duplicate comes back. Ask Claude if the form needs linking to the right child.

### The emails after a form

Built on 22 October 2026 for Yvonne (To-Do #75). It works once the database file `updates-2026-10-22-mail.sql` has run and the mailer is installed in admin@ (see [Behind the scenes](#/handbook/behind?s=the-mailer-in-admin)).

When a family sends the enrollment form or the contact / book-a-tour form, The Current writes two emails and the mailer sends them from admin@ within about five minutes:

| Email | To | What it says |
|---|---|---|
| Thank-you | Every parent address on the form | The form or message has arrived, and the office will be in touch. It is in the language the family used first, then the other one. For a tour or call it repeats the day they asked for and says the office will confirm it |
| Alert | Yvonne and admin@ | Who sent it, how to reach them, what they asked for, and a link to it in The Current. Health answers and documents stay in The Current |

- **The wording.** **Enrollments** → **Emails** (or **Emails** on the Leads panel). One tab for each form, English and Vietnamese, with a preview filled in with a made-up family. Words in braces such as `{child}` are filled in for each family; the window lists them. A blank line starts a new paragraph. **Save**, and every form from then on uses it.
- **Switching off.** Untick the box at the top of a form's tab to stop its thank-yous. The office alert still goes. The alerts are switched off, or sent elsewhere, on the **Office alerts** tab.
- **Did it go?** Each form and each website message shows a line for its two emails: sent (with a link to it in admin@'s Sent), waiting, or not sent and why. **Emails** → **Outbox** lists the latest emails of every kind and says when the mailer last checked in.
- **Send again.** An email that failed, or was not sent, has **Send again** in the Outbox.
- **One a day.** An address gets at most one thank-you in 24 hours, so nobody can type a stranger's address into the contact form and flood them. Siblings' enrollment forms sent the same day each get their own. The office alert goes every time, and says when a thank-you was held back.
- **Late forms.** A thank-you or an alert more than two days late (the mailer was stopped) is marked "not sent" rather than arriving days after the form.
- The Vietnamese wording was written by Claude and has not been read by Vietnamese staff yet. The emails promise no response time; add one in the wording if the office wants to.
- Forms imported from Jotform never send anything.

### The private part

- The section **Documents and ID details: office only** holds the ID numbers, the uploaded documents and the signature. Since 5 October 2026 every office account can open it. Each document link works for an hour; open the form again for a fresh one.
- Only the Super Admin can delete a form. Deleting it deletes its ID numbers, documents and signature for good; the student and family stay.
- The folder export (Super Admin) also writes each form's documents and signature into the export folder (see [Fees, invoices and receipts](#/handbook/fees)).
- The 37 forms sent through Jotform before 30 September 2026 are not in The Current. Bringing them in needs Bowen's Excel export from Jotform, and their files stay on Jotform (not checked since 15 October 2026).

## Student statuses

The status is at the top of the student window. It never changes by itself: not when an invoice is paid, not when an end date passes.

| Status (screen) | Meaning | Register | Progress reports | Invoices | Counts and mailing lists |
|---|---|---|---|---|---|
| Enrolled | In class now | Yes | Yes | Yes | Counted; parents on the mailing lists |
| Pending | Coming, not in class yet | No | No | Yes, can be invoiced | Not counted; parents not added to the lists |
| Past | Has left | No | No | No; picking one with **Include inactive** in the builder brings them back as Pending | Not counted; parents taken off the lists |

- A new student starts as Pending, whether added by hand, from a lead or by a form. Students loaded from the roster file come in as Enrolled.
- A past student picked in the invoice builder comes back as Pending after a confirm, with the year group suggested from the birthday. Their new-student checklist starts again. If they still have an old end date, the window asks whether to **Keep it** or **Clear it**.
- A family's status follows its children: active if any child is enrolled, pending if any is waiting, past once none is left.

## Student IDs

- Every new student gets the next free S number (S0001, S0002 …). The form fills it in and the database does too; the button beside **Student ID** puts in the **Next free ID**.
- The old PAL codes became S numbers with the same digits (PAL0115 became S0115). Older BLE codes stay as they are, because they are printed on invoices already sent. Bowen's rule (2 October 2026): keep the old BLE numbers, give new students only S numbers.
- On Students, a blue **Update IDs** banner appears while any PAL code is left, and an amber **Give them IDs** banner while any student who is not Past has no ID. The checklist flags a new student whose ID is not an S number.

## The student window

Click a student's row on **Students**. The window has these sections: the top part (photo, names, ID, status), **Enrollment**, **Travel**, **Documents** (see [Documents on Drive](#/handbook/students?s=documents-on-drive)), **Personal**, **Family & contact**, **Billing**, and the **New-student checklist**. **Delete** is at the bottom left. The fields below are the ones that change what the app does.

### Names

- **Full name** as on the passport, family name where the family writes it. **Nickname** is what the child is called in class; the register shows it.
- **Legal first name (for reports)** is the given name printed in progress report comments instead of the nickname. Type it when the guess is wrong. Left blank, the app works it out from the full name: for a Vietnamese name with the family name first, the last two words ("Nguyễn Văn A" gives "Văn A"); for a two-word Vietnamese name, the last word; for other names, the word that matches the nickname, otherwise the first word.
- The report prints the full name with the nickname in quotes under it. Bowen's rule (15 September 2026): use the legal first name, keep the nickname in quotes.

### Enrollment

- **Year group** is picked from the birthday until it is changed by hand ("Picked from the birthday: change it if needed"). Year groups follow the English system with a 1 September cut-off, and move to the nearest class that has students when classes are combined.
- **Program**: Regular, Global, Vocational, Hybrid Pathway, Independent Pathway, Staff child or No program. It drives the price (see [Fees, invoices and receipts](#/handbook/fees)).
- **Class / homeroom**: the class name when it differs from the year group, for example when two year groups are taught together.
- **Start date**: a student added by hand starts with today's date. Change it to the real first day. The attendance summary does not expect a student before it. The window warns when it is still to come for an Enrolled student, before the form was sent, more than nine months from today, after the end date, or when the day and month look swapped.
- **Expected end date**: only for a student who will leave. After it the register lists them last and stops expecting them, the summaries stop counting their missing marks, invoices for later quarters leave them out, and the parent mailing lists drop them. **End of quarter** buttons fill in a quarter's last day. Home and Students show who is finishing this quarter.
- **Partial day: joins after the morning lessons** with **Arrives at** (11:35 by default): for a student who comes only in the afternoon. Their progress reports have no academic areas, and the register does not mark them present in bulk before that time. See [Attendance and the schedule](#/handbook/attendance).

### Family & contact

- **Family**: the dropdown, with "+ New family for this student" at the bottom.
- **Parents' email** and **Parents' phone** on the student are used for invoices and class lists only when the family has no contacts.
- Every email box checks the part after the @ as you type. A slip such as "gmai.com" shows "gmai.com: did you mean gmail.com?" with a button to fix it. It never stops a save. The same check is on the website's forms.

### Billing

- **Legacy student (last year's price)**: a returning student who keeps last year's Early Bird price.
- **New student (admission fee applies)**: the invoice builder adds the 10,000,000 admission fee while it is ticked. Untick it once an invoice carries the fee, or it lands on the next invoice too. Leave it unticked for the Global Program.
- **Full-price Quarter 4**: ticked for anyone added since the 2026-2027 fee schedule came out. See [Fees, invoices and receipts](#/handbook/fees).
- **Meals at PRA**: Yes, No, or not answered. One mark covers meals and snacks. It is also on the Students list as the **Meals** column (an amber outline until answered; **Meals not answered** filters them). It decides who is on the menu mailing list (parents_menu@) and whether meals start ticked on a new invoice. On 15 October 2026 every current student had an answer.

## Documents on Drive

Each student's enrollment form, ID papers and photo stay where the office files them: **Palm River Administration Drive** → **ADMISSIONS** → **Enrollment** → **Students' enrollment forms**, by year, then programme and class, then the student or the family. The Current does not copy the files. It keeps the list of file and folder names in that folder and works out from the names whose files are whose. Built 19 October 2026.

### On the student window

- The **Documents** section is for office accounts only; teachers do not see it. Files are grouped as **Enrollment form**, **Not sorted yet**, **Student's ID papers**, **Parents' ID papers**, **Photo** and **Other files**. A form sent from the website, and the files uploaded with it, show in the same list.
- **Not sorted yet** (in an amber box) holds the student's files whose names do not say what they are, such as a phone picture named IMG_1234.jpg. They do not count as ID papers or a photo until someone says what they are: click **Sort them** (see below).
- Click a file name to see it inside The Current, with **Previous** and **Next** for the student's other files. The arrow on the right of a row opens the file in Drive in a new tab. **Open their folder in Drive** opens the folder that holds most of their files.
- Google decides who sees a file: only accounts that can open the Palm River Administration Drive (admin@ and the office staff who are members of it). If the viewer stays blank or shows a Google page, open the file in Drive and sign in with such an account.
- For an Enrolled or Pending student, an amber line names what was not found: enrollment form, ID papers or photo. The photo on the student's record in The Current counts as a photo.
- A file filed twice shows once, with "filed 2 times"; the newest year's copy is the one that opens.

### Keeping the list up to date

- The Current reads the folder when someone clicks **Check Drive** (on the student window or in the summary). The time and account of the last check show beside the button.
- The first time in a session, Google asks which account to use: choose admin@palmriveracademy.edu.vn. After that, opening a student window reads Drive again on its own when the last check is more than half an hour old.
- File a new student's papers in Drive as before, then click **Check Drive**.
- The matching reads names. A form named after the student, "Passport" or "Photo" with the student's first name, a folder named "<student> - Enrollment Form" or "<family name> Family" all work. A file with a camera name such as IMG_1234.jpg goes to whoever the folder belongs to, under **Not sorted yet**. Renaming such a file in Drive ("Passport Mia.jpg") also sorts it, at the next **Check Drive**.
- The same picture copied into two children's folders (brothers and sisters) is taken to be the parents' ID papers and goes under **Parents' ID papers**, marked "Also in a brother's or sister's folder".

> **Careful:** a file renamed or moved in Drive keeps its place on the student window only after the next **Check Drive**. A file deleted in Drive leaves the list at the next check.

### Sorting files whose names say nothing

Click a file to open it, or **Sort them** in the **Not sorted yet** box. Under the file, **What is this file?** has a button for each kind: **Student's ID papers**, **Parents' ID papers**, **Photo**, **Enrollment form**, **Other files**, and **Not this student's**. Click one: it saves at once and the next file not sorted yet opens. Files already sorted show the same buttons under **Filed as**, with their kind in blue, so a wrong one can be changed the same way.

Built 20 October 2026, after a new student's passport pictures, named IMG_7091.JPG and so on, sat under Other files while the summary said they had no ID papers.

### Putting a wrong guess right

1. On the student window, click **Correct the list** under the documents.
2. Use the drop-down beside a file to say what it is (for example **Student's ID papers** instead of **Other files**), or the cross to mark it **Not this student's**.
3. To add a file the matching missed, type part of its name or its folder in **Add a file from the folder** and click it.
4. Click **Done**.

Corrections save at once and stay through later checks.

### The summary

**Students** → **More** → **Documents on Drive** lists every Enrolled and Pending student with a tick or a dash for enrollment form, ID papers and photo. **Only students missing something** is ticked to start with. Click a name to open the student.

An amber page with a question mark instead of a dash means the paper may be among files not sorted yet. Click **Sort 3** (the number of files) beside the student: the files open one after another with the buttons described above, and the window closes when nothing is left to sort or nothing is missing any more.

Below the table, **Files from this year not given to a student** lists this school year's files the matching could not place. Pick a student in **Give to…** to put a file on their record. When everything from this year is placed, the list does not show.

**Previous students not in The Current** is folded away at the bottom: files from earlier years whose student or family was never added to The Current (most of the summer and Global Program families of 2025-2026), one line per family or student folder. Nothing needs doing there. If one of those students comes back, add them on **Students** and the matching picks up their old files at the next **Check Drive**.

> **Careful:** two copies of the same file (same contents, different names) show once. The copy whose name says what it is wins, so "CCCD" with a name beats a phone's number-named copy.

### Setting it up

Done once, by Bowen:

1. Run `supabase/updates-2026-10-19-drive-docs.sql` in Supabase → **SQL Editor**. Until then the section says documents are not set up.
2. Switch on the Google Drive API for The Current's Google project: console.cloud.google.com → the project that holds The Current's Google sign-in → **APIs & Services** → **Library** → **Google Drive API** → **Enable**. Until then **Check Drive** says Drive is not switched on.

The Current asks Google only for permission to read file and folder names (drive.metadata.readonly). It cannot change, download or share a file.

> **Ask Claude:** "Check that the Drive documents tables are set up on the live database and that Check Drive works for admin@."

If the office ever starts a new top folder for enrollment papers, The Current has to be pointed at it.

> **Ask Claude:** "Point Check Drive at this folder as well: <the folder's Drive link>."

## Families

- **Students** → **Families** lists each family with its language, its children (click one to open them), up to three contacts, and a **Missing email or phone** warning and filter.
- The family window: family name, preferred invoice language (English or Vietnamese), the contacts (name, relation, email, phone, **Add contact**), notes, and **Delete**. Deleting a family unlinks its children; it does not delete them.
- One family for each set of siblings. Every child of a family comes onto an invoice together, the sibling discount needs them on one invoice, and invoices are addressed to the family's contacts.
- **More** → **Group into families** looks at the parents' emails and phone numbers on the student records and proposes families for siblings, with the language guessed from the names. It shows the list and asks before saving.

## The new-student checklist

Every Pending student has one, and so does an Enrolled student whose checklist was started and not finished. **Add to the new-student checklist** starts one for a student who began recently. It is in the student window and in the form window on Enrollments; **New students with steps to finish** on Students and a chip on Home find the open ones.

Lines the app works out from the records:

| Line | Done when |
|---|---|
| Student ID | The student has an S number |
| Year group | Set; a note appears when the birthday points to another year group |
| On the register | Status is Enrolled ("Pending. Set the status to Enrolled on their first day.") |
| Start date | Set, with the warnings above |
| Expected end date | Optional; "None. Only for a student who will leave early." |
| Family | In a family with parent names |
| Parent email | An address that looks right |
| On the Leads list | Linked to their lead (**Link**, or **Add to Leads** as Enrolled) |
| Admission fee | **New student** ticked, an invoice carrying the fee, or **No admission fee for this student** |
| First invoice | An invoice in The Current, or **Billed outside The Current** |
| Enrollment form | A form on Enrollments, or **Form kept on paper or by email** |

Lines a person ticks with **Mark done** (each tick records who and when):

| Line | What to do |
|---|---|
| Supply check | Press **Supply check**. It saves a Gmail draft in admin@ to the teachers of that year group who sign in, and Hien, asking what the student needs (books, materials), and adds a To-Do for Hien. Mr. Chiến has no login and is left out; tell him in person. A person sends the draft |
| Parents on the mailing lists | Add the parent emails in Google Groups (parents_all@ for every family, parents_ey@ for Early Years, parents_menu@ for the menus). **Copy the parent emails** helps |
| On the no-photo list | Only when the form's photo consent is private: put the child on the no-photo list (see [Photos and Facebook](#/handbook/photos)) |

"Photo on the record" is shown for information.

## The roster file

The student list was first filled in September 2026 from the office's student workbook (an Excel file) through a roster file. Day-to-day changes are made in the student window; the roster file is for a whole new list.

1. On the laptop that holds the code, `python scripts/build_roster.py "<workbook.xlsx>"` in `C:/Users/sbowe/admin` reads the workbook and writes `private/roster.json`.
2. **Students** → **More** → **Load roster file…** and pick that file. It adds anyone missing, as Enrolled, and fills in blank details on existing records.

- The same script also writes `src/data/rosterIndex.js`: only student IDs and one-way fingerprints of the names, no names. That list is how the app knows who was on the 2026-2027 roster, and so who pays the reduced Quarter 4. Running the script again with a newer workbook changes who counts as on the roster.
- **Settings** → **Import roster (Excel)** is an older, simpler import. It matches by name only and puts unknown year groups in Year 1. Avoid it.

> **Rule:** the `private/` folder in `C:/Users/sbowe/admin` holds the full roster with birthdays, parents' contacts and home addresses, and the student photos. It is left out of git and must stay that way. Anything in the code's `public/` folder or used by the code ends up on the public website, so children's details reach the app only through the database, after someone signs in. On 22 September 2026 the roster and 37 photos were found in the public code and on the live site, where they had been since 14 September; they were taken out the same day. The old copies are still in the code's history, and the repository is public (not checked since 15 October 2026).

> **Ask Claude:** "Build a new roster file from this office workbook, tell me how many students it adds or changes and whether it changes who gets the reduced Quarter 4, and wait for my yes before anything is loaded or deployed."

## Exports

- **Students** → **More** → **Export student list**: an Excel workbook of the students listed now (the filters apply), with photos, parent contacts, class lists, an allergy list, birthdays, and summary counts. Every sheet is locked without a password; filtering and column widths still work. **Settings** → **Data export** → **Export student list** exports everyone.
- **Copy parent emails** (above the list) copies the parent addresses of the students shown, ready to paste into an email or a mailing list. Past students are left out unless the **Past** tab is open. Addresses that look mistyped are listed in a warning.
- The folder export writes `Student list.xlsx` too.

> **Rule:** children's and parents' details never go into the code, the website, a shared document or git. A one-off fix to a family's record that cannot be made in the student window goes to the admin as a database update in chat, run by hand, never saved in the code.

## When a student leaves

1. Open the student. In **Enrollment**, set **Expected end date** to their last day (an **End of quarter** button if they leave at a quarter's end).
2. Once they have gone, set **Status** to **Past** and press **Save**.
3. Check that no invoice for a later quarter still lists them, and void or correct one that does.
4. Their parents come off the Google Groups at the next sync, unless a sibling stays. Their Google account is handled in [Google Workspace and domains](#/handbook/google).

> **Rule:** never delete a student who has attended. Deleting deletes every attendance mark and trip they ever had, and their progress reports and enrollment form lose the link to them. Delete only a record made by mistake.

## Google accounts and parent groups

- Students have Google accounts at pra.edu.vn, made outside The Current with a tool called GAM on Bowen's laptop. See [Google Workspace and domains](#/handbook/google).
- The parent mailing lists parents_all@, parents_ey@ and parents_menu@palmriveracademy.edu.vn follow The Current. A script in the triage's code reads the student records and proposes the changes: parents of Enrolled students whose end date has not passed; Nursery and Kindergarten for parents_ey@; **Meals at PRA** Yes for parents_menu@. It runs as a dry run first and changes the groups only on the admin's yes. A leaver comes off once Past or past their end date; a mistyped address is never added. Running it from inside The Current is To-Do #60, planned and not built. Details in [Google Workspace and domains](#/handbook/google).

> **Ask Claude:** "Run the parent groups sync for parents_all as a dry run, show me who would be added and removed, and wait for my yes."
