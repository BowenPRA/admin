This chapter is the calendar of the admin work: the quarters of the 2026-2027 academic year, what happens in each quarter and each week, the events and holidays, the renewals that come round once a year, and the move to a new academic year. Open it at the start of each quarter, before a fee run or a report period, and in May, when the next academic year has to be planned.

## The academic year 2026-2027

The academic year runs from Tuesday 4 August 2026 to Friday 4 June 2027: 180 class days in four quarters of 45 days each. Year groups follow the English 1 September cut-off, so Year 1 in 2026-2027 is the children born from September 2020 to August 2021. Photos and events are filed by academic year too, starting in August.

| Quarter | First day | Last day | Class days |
|---|---|---|---|
| Quarter 1 | Tuesday 4 August 2026 | Thursday 8 October 2026 | 45 |
| Quarter 2 | Thursday 15 October 2026 | Thursday 17 December 2026 | 45 |
| Quarter 3 | Tuesday 5 January 2027 | Wednesday 24 March 2027 | 45 |
| Quarter 4 | Monday 29 March 2027 (see the warning below) | Friday 4 June 2027 | 45 |

> **Careful:** the sources disagree on when Quarter 4 starts. The fee sheet says Monday 29 March 2027, and The Current uses 29 March for invoices, attendance and reports. The academic calendar PDF and the calendar grid on the website say Thursday 25 March. Ask Seth which is right, then have Claude correct whichever is wrong. A smaller one of the same kind: the calendar PDF colours Monday 4 January as Quarter 3, while The Current and the website both start Quarter 3 on Tuesday 5 January.

### Days PRA is closed

| Dates | What |
|---|---|
| Monday 31 August to Wednesday 2 September 2026 | Independence Day holiday |
| Friday 9 to Wednesday 14 October 2026 | Fall break, between Quarter 1 and Quarter 2 |
| Tuesday 24 November 2026 | PRA closed (Vietnamese Culture Day) |
| Friday 18 December 2026 to Monday 4 January 2027 | Winter holiday |
| Wednesday 3 to Monday 15 February 2027 | Tết holiday |
| Friday 26 March 2027 | PRA closed |
| Friday 16 April 2027 | Hùng Kings' Commemoration Day |
| Monday 26 to Friday 30 April 2027 | Spring break and Reunification Day |

If bad weather closes PRA during the year, the lost days are made up on Friday 29 January, Monday 1 February and Tuesday 2 February 2027.

The day itself: drop-off 8:00 to 8:30, classes 8:30 to 15:20, extra-curricular activities (ECAs) 15:30 to 16:10. Partial-day students arrive at 11:35.

### Where the dates are kept

The same dates live in several places, and they must agree.

| Where | What it holds | Who changes it |
|---|---|---|
| The Current's code, `src/lib/fees.js` | The quarters' real first and last days, the class days per month, the payment deadlines. Attendance, "this quarter", expected end dates and the reduced Quarter 4 all read these. | Claude, then a deploy |
| [Settings](#/settings), the **Fee schedule** and **Calendar** cards | The saved copy that invoices use: amounts, deadlines, class days per month and per quarter, the quarter ranges printed on invoices | Any office account |
| [Report settings](#/reports/settings) | The academic year and the four report periods | The head |
| The website, `src/_data/calendar.json` | The calendar on the schedule page, in two parts (a month list and month grids) that must be changed together | Claude, then a push |
| The website's tuition page | The payment dates and the quarterly prices | Claude, then a push |

## The rhythm of a quarter

Every quarter has the same shape. Fees for the next quarter are announced near the end. Progress reports are written in the last week and the break. The first week of the next quarter closes both off.

### Fees

| Payment for 2026-2027 | Deadline |
|---|---|
| Full year, early bird | 20 May 2026 |
| Full year, standard | 30 June 2026 |
| Quarter 1 | 28 July 2026 |
| Quarter 2 | Thursday 8 October 2026 |
| Quarter 3 | Thursday 17 December 2026 |
| Quarter 4 | Monday 22 March 2027 |
| Semester 2 | 10 December 2026 |

- The announcement of the next quarter's fees goes out about two to three weeks before the current quarter ends, and is due on the current quarter's last day. The Quarter 2 announcements were sent from 21 September to 2 October 2026, due 8 October. Expect the Quarter 3 run in late November (due 17 December) and the Quarter 4 run in early March.
- Quarter 4 is the exception: it is due Monday 22 March 2027, two days before Quarter 3 ends. The Current, the website's tuition page and its calendar all say 22 March.
- Each announcement is an invoice made in [Invoices](#/invoices). The Current saves it as a Gmail draft in admin@ with the PDF attached; a person reads it and presses Send. The default email text was rewritten on 8 October 2026 from the 16 announcements the office actually sent. [Fees, invoices and receipts](#/handbook/fees) has the steps.
- After the deadline, each payment is recorded on its invoice, which gives it a Phiếu thu (receipt) number. **Invoices** → **Print summary** shows what has been received, what is still owed and how late.

### Progress reports

One progress report per student per quarter. Quarter 1 of 2026-2027 went like this:

| Date | What happened |
|---|---|
| Thursday 24 September 2026 | Teachers were emailed the link to The Current and told comments were open |
| Thursday 1 October | Seth's guidelines to teachers |
| Thursday 8 October | Quarter 1 ended |
| 9 to 14 October | The break; reports written |
| Friday 16 October | Reports due |

- The head makes the reports with **Create reports** in [Reports](#/reports): the period, the template, the year groups.
- Teachers write their own learning areas and homeroom parts. A course description is written once per year group and learning area each quarter. A comment shorter than its minimum counts as not written and stays on the teacher's list.
- The Reports page and Home pick the quarter from today's date. During the break they stay on the quarter that has ended. From the first day of the new quarter they show the new one, so a report still being finished then is found by pressing the old quarter's button.
- Reports set to English and Vietnamese are translated through **Translate**: a file is downloaded, filled in by Claude in the desktop app, and uploaded again. [Progress reports](#/handbook/reports) has the details.

### Class references and publishing

1. Check that every review score of the year group is in before printing. The class reference printed beside each student's score is the average of all the scores entered so far, worked out when the report is printed, so a missing score changes it. Nothing needs pressing (the **Class references** button was removed on 24 October 2026).
2. A teacher sets a finished report to **Ready to review**. The head reads it and publishes it. Only the head can publish, and once a report is published only the head can change it.
3. **Print all** on the year group's card makes one PDF of the year group in English; **Tiếng Việt** makes the Vietnamese pages of the reports set to both languages.
4. The super admin runs **Export to a folder** in [Settings](#/settings) (in Chrome or Edge). The published reports land in the Drive-synced folder under `Reports/2026-2027/Quarter 1/` and then the year group.

### The first week of a quarter

1. **Payments.** Record the payments that came in for the fees due on the last day of the quarter that has ended, and print **Invoices** → **Print summary** to see who still owes.
2. **Reports.** Finish, publish and export the old quarter's reports (pick its button on the Reports page).
3. **Leavers and starters.** A student's status never changes by itself. In the last week of a quarter, Home and [Students](#/students) show who finishes that quarter; once their expected end date has passed, their row on the Students list carries an "ended on" chip. Set them to Past. Set new students who have started from Pending to Enrolled, and look at their new-student checklist.
4. **Parent mailing lists.** After the student records are right, sync the parent Google Groups from The Current (a dry run first; see [Google Workspace and domains](#/handbook/google)).
5. **Website notices.** Remove the home noticeboard cards whose dates have passed; they do not expire by themselves. The reel notices do.
6. **Assessments.** Add the quarter's assessment papers and PRA progress reviews to the Assessments tab (see [Assessments library](#/handbook/assessments)).
7. **This handbook.** Go through it, as [Keeping this handbook up to date](#/handbook/updating) asks at the start of each quarter.

> **Ask Claude:** "It is the first week of Quarter 3. Do a dry run of the parent mailing group sync from The Current and show me what would change, then list the website notices whose dates have passed."

## The week

### Every class day

- Each class's register is taken in [Attendance](#/attendance), on a phone or a computer. Teachers see only their own year groups; office accounts see every class. Home shows which classes are still to register. [Attendance and the schedule](#/handbook/attendance) has the details.
- The admin@ inbox is read by the triage (below). Replies to families are drafts until a person sends them.

### The triage, Monday to Friday

The triage is Claude sorting the admin@ inbox on a timetable, Vietnam time. Nothing runs at the weekend; Monday's first runs cover Saturday and Sunday.

| Time | Run | Who hears from it |
|---|---|---|
| 06:00 | Early check | Seth, only about something that cannot wait until 08:00 |
| 08:00 | Morning update, the full run | Yvonne, Hien and Seth each get a digest; the admin (Bowen today) gets a report |
| Every hour, 08:30 to 16:30 | Sorting of new mail | The owner of each item, with Seth in copy |
| 15:00 | Day recap | Seth, with the admin in copy |
| 18:30 and 19:30 | Evening checks | Seth, only about something that cannot wait until morning |

- Hien's Monday digest also lists the standing costs.
- Read the morning report each day and answer what it lists under "Needs Bowen".
- When the Claude allowance runs out, a run is refused rather than billed, and nothing tells you. That happened on the morning of 15 October 2026, when the 06:00 and 08:00 runs did not run. The morning update then has to be run by hand. [The inbox and the triage](#/handbook/inbox) has the rest.

> **Ask Claude:** "Our triage did not run this morning. Run the morning update now from the triage folder and give me the report here."

### Fridays at 16:30

- Two newsletters go out from admin@ by BCC: The Palm River Post to parents_all@ and allstaff@, and the Early Years newsletter to parents_ey@ and allstaff@. The weekly menu goes to parents_menu@ at the same time.
- Since 16 October 2026 the newsletters are written in The Current under **Outreach** → **Newsletter** ([Newsletter](#/newsletter)), in the format of Seth's Google Doc. **Publish** makes the website pages, two PDFs and a Gmail draft; a person sends the draft. Until a build step that Bowen still has to set up is in place, the website shows a published issue after its nightly rebuild (02:30) or the next push (as built on 16 October 2026).
- The parents_menu@ list follows the "Meals at PRA" answers on the student records. It is not synced until the office has answered for every current student.

### The To-Do list

- Each weekday the morning update reads the comments staff wrote on [To-Do](#/todo) tasks (since 5 October 2026), closes tasks that the mail shows are done, and lists in the admin's report the tasks waiting for a session with Claude.
- Once a week, or when the list grows, open a session and work through Claude's tasks. [The To-Do tab](#/handbook/todo) has the details.

> **Ask Claude:** "Read the to-do list."

### Now and then

- An inbox clean-up, only in a session with Claude, which lists what it would archive and waits for your yes ([The inbox and the triage](#/handbook/inbox)).
- Website changes as they come: a notice, a date, a photo ([The website](#/handbook/website)).
- After any change to The Current: the database file (you), the deploy (Claude), the commit (on your word) ([Behind the scenes](#/handbook/behind)).

## Events in the year

The website's [events page](https://pra.edu.vn/events/) shows only the current academic year, newest first; each past year moves to its own page by itself. Only some events get a full page of their own, and only when the admin asks (Mid-Autumn 2026 and the Quarter 1 Showcase so far).

| When | Event | Notes |
|---|---|---|
| Tuesday 4 August 2026 | First day of the academic year | |
| August, date to be filled in | Welcome Back | Held in August in past years |
| Friday 25 September 2026, afternoon | Mid-Autumn Festival | Lanterns made by Year 7, a silent auction, student booths, a lion dance. Profits went back to the students, with 15% to the charity Da Nang Go. The website's card says 2:30pm on Bowen's instruction, although the flyer said 14h00 to 16h00. Event page at https://pra.edu.vn/events/mid-autumn-2026/ |
| Thursday 15 October 2026, afternoon | Quarter 1 Showcase | The first day of Quarter 2. Each class showed families what it had learned. Event page at https://pra.edu.vn/events/q1-showcase-2026/ |
| Friday 30 October 2026 | Halloween, for students | From the Quarter 2 Week 1 newsletter |
| Tuesday 24 November 2026 | Vietnamese Culture Day | No classes |
| Thursday 26 November 2026 | Thanksgiving lunch, families invited | A card on the website's home page links to the newsletter; remove it after 26 November. In 2025 it was 27 November. |
| Thursday 17 December 2026 | Quarter 2 Showcase | The last day of Quarter 2 |
| December, date to be filled in | Christmas | Held in past years |
| Wednesday 3 to Monday 15 February 2027 | Tết holiday | |
| Dates to be filled in | Quarter 3 and Quarter 4 showcases | |
| March, date to be filled in | March Mathness | A 2025-2026 event |
| Dates to be filled in | Reading Safari, Learning Without Walls, Anti-Bullying Week | 2025-2026 events. Anti-Bullying Week is kept off the website on Bowen's word. |
| Dates to be filled in | Trips | A yearly study trip to Australia and trips within Vietnam. The Da Lat trip is planned and budgeted by the students. |
| June 2027, date to be filled in | Graduation and the yearbook film | The film is credited to the Yearbook Team. The Vietnamese word for graduation on the website ("Lễ tốt nghiệp") still waits for a staff read. |
| Friday 4 June 2027 | Last day of the academic year | |
| Not on any calendar | Parent-teacher meetings | No dates for 2026-2027 in any source; to be filled in |

After an event, the photos go through the photo library and the Photos tab before anything is public ([Photos and Facebook](#/handbook/photos)), and the event is added to the website's events page once its photos are signed off.

## Renewals and dates to watch

| Date | What | What to do | Held by |
|---|---|---|---|
| 14 October each year | Twinkl subscription renews | The exact charge is only in the Twinkl account or on the card statement. The triage turns the renewal notice into a To-Do. | Hien |
| From 30 October 2026 | Supabase stops giving new database tables to The Current's roles by itself | Nothing for you: every database file Claude writes now includes the grants (the lines are in `supabase/README.md`). If a feature built after this date fails with a permission error, a missing grant is the first thing to check. | Claude writes the file, you run it |
| Tuesday 5 January 2027 | Google Groups change: a super admin can no longer post to a group that limits who may post, unless the group allows it | Before then, add admin@palmriveracademy.edu.vn as a Manager of parents_all@, parents_ey@ and parents_menu@, and check allstaff@. The Friday newsletters are posted from admin@ to these groups. The steps were written for Bowen as To-Do #27; whether they were done is not recorded (not checked since 15 October 2026). | admin@ |
| From about Friday 22 January 2027 | Wix may charge the renewal of the old website's Premium plan (USD 118.80 a year; it renews on 12 February 2027) | Decide before 22 January whether to keep paying. Read the warning below first. | PRA's Wix account, paid by card |
| Sunday 30 May 2027 | palmriveracademy.edu.vn domain, at P.A Vietnam | Renew it. The office address admin@palmriveracademy.edu.vn and the redirect from the old website address both depend on it. P.A Vietnam sends its notices to admin@palmriveracademy.com, which arrives in admin@. | PRA's P.A Vietnam account (who logs in is not recorded) |
| Around July 2027 | pra.edu.vn domain, at P.A Vietnam | It was renewed on 15 July 2026, so the next renewal is due around July 2027 (from Claude's notes; not checked since 15 October 2026). The website, The Current's address and every staff email depend on it. | PRA's P.A Vietnam account |
| Saturday 29 April 2028 | palmriveracademy.com domain, at Wix | It stays on Wix and is not redirected (Bowen, 6 October 2026). | PRA's Wix account |

> **Careful:** the DNS records of palmriveracademy.edu.vn, including the ones that deliver the mail of admin@palmriveracademy.edu.vn (MX, SPF and DMARC), are kept in the Wix account. If Wix is cancelled or lapses before those records move to P.A Vietnam, the office inbox stops receiving mail. Moving them is a job for a session with Claude, with the records checked before and after. Do not cancel Wix until that is done.

> **Ask Claude:** "Plan moving the DNS of palmriveracademy.edu.vn from Wix to P.A Vietnam without breaking admin@ mail. Show me the current records first and wait for my yes before anything changes."

## The move to a new academic year

Nothing about the move to a new academic year is automatic, and it has never been done: The Current was built in September 2026, and about 46 places in 12 of its files named 2026-2027 when they were counted on 29 September 2026. The first move is in summer 2027. The checklist below says where each thing lives and who changes it.

> **Rule:** plan the move with Claude in May. The new fee sheet and calendar have to be decided first, and the first invoices of the new year need the new fee schedule while the old year is still running (in 2026 the early-bird deadline was 20 May), so do not leave it to June. Start earlier if the fee sheet is ready earlier.

> **Ask Claude:** "Plan the move to the 2027-2028 academic year with me. Here are the new fee sheet and the new calendar. Go through the checklist in the handbook's year chapter, tell me what you will change in the code, what I must do in Settings, in Supabase and in Google, and in what order, and wait for my yes before changing anything."

### The checklist

1. **Decide the numbers.** The new fee sheet (tuition for each band and plan, meals, transport, admission fee, trial day, deadlines) and the calendar (first and last day, the quarter dates, class days per month, closed days). Seth and Ms. Xuan decide; nothing below can start without them.
2. **The Current's code** (Claude, then a deploy). `src/lib/fees.js` holds the academic year, the default amounts, the seven deadlines and the calendar: first and last day, class days per month, the four quarters' real dates. The Settings page cannot edit the quarters' real dates or the list of months, so this step comes first. Claude also changes the other places that name 2026-2027: the report periods in `src/lib/report/defaults.js`, the default installment plan in the invoice builder, and a few labels that say "2026-27". Give Claude the new amounts at the same time, so the code's defaults are the new fee sheet.
3. **[Settings](#/settings) → Fee schedule** (any office account, after the deploy). Press **Reset to defaults**: it brings the new calendar in from the code. It also puts every amount in the form back to the code's defaults, which is why the amounts are done after it, never before. Check the amounts against the fee sheet (or type them), check the class days and the printed quarter ranges in English and Vietnamese on the **Calendar** card, then press **Save**. Nothing is kept until Save.
4. **When to press Save.** The academic year saved in step 3 sets the invoice and receipt numbers: 2027-2028 gives PRA-2728-0001 and PT-2728-0001, starting again at 0001. But The Current holds one academic year at a time. After the Save, every new invoice takes the new prefix and the new prices, even one for the old year, and the saved calendar that attendance and "this quarter" read is the new year's. The first invoices of the new year fall due while the old year is still running (the early-bird deadline was 20 May in 2026), so this cannot wait for the summer either. How to bill the new year while the old one finishes has not been worked out: settle it in the May planning session (see [Known problems and open items](#/handbook/open)). An old-year invoice made after the switch can be corrected by hand in the invoice editor, where every amount can be changed.
5. **[Report settings](#/reports/settings)** (the head). The academic year and the four periods (label, first day, last day). Check the templates and the signature lines while there.
6. **[Schedule](#/schedule) → Edit** (an office account). The new timetable, saved in the database. Claude updates `src/data/schedule.js` so that **Built-in schedule** means the new year. Reports take each homeroom teacher's name from the Schedule, so do this before reports are made.
7. **[Teachers](#/teachers)** (the head). Each teacher's learning areas and homeroom year groups for the new year. Claude updates `src/data/staff.js`, the built-in staff list behind the **Add … from 2026-27 schedule** button. New teacher logins are made on the Teachers page (**Create login**); new office logins go through the staff-accounts script, which you run because it asks for the database's secret key.
8. **Students move up a year group** ([Students](#/students)). There is no button. Change each student's year group by hand in the student window (the year group suggested from the birthday helps), or ask Claude for a database update file that moves everyone at once, checked with you first, which you run. Set leavers to Past; never delete them, because deleting a student deletes every attendance mark they had. Look at the **New student** and **Legacy** boxes on every record: last year's new students are not new any more, and who keeps a legacy price is a decision to make again.
9. **The reduced Quarter 4.** In 2026-2027 only the students on the enrolled roster when the fee schedule was published pay the reduced Quarter 4. The Current knows that roster only as name fingerprints in `src/data/rosterIndex.js`, made by `scripts/build_roster.py` from the office's student workbook. Decide whether the rule continues. If it does, Claude rebuilds the fingerprints from the new roster and deploys, and the **Full-price Quarter 4** box is checked on every new or returning student.
10. **Attendance** needs nothing. Old marks stay, and the periods on the Summary follow the saved calendar.
11. **The website** (Claude, then a push once staff have read the new Vietnamese). The tuition page (prices and payment dates typed into the page and its Vietnamese twin), the calendar (`src/_data/calendar.json`, both the month list and the grids), the "Academic year 2026-2027" choice on the enrollment form (`src/_data/enroll.json`), the Family Guidebook PDF, the home noticeboard and the reel. The events page moves to the new year by itself.
12. **Google accounts** (a session with Claude; see [Google Workspace and domains](#/handbook/google)). Students who move from Year 6 to Year 7, or from Year 8 to Year 9, change unit (Primary to Secondary to Upper Secondary). The one Secondary student with a unit of his own is moved by hand when he changes stage. New regular students from Year 1 up, and Global Program students from Year 4 up, get accounts. The roughly 50 accounts of past students in /Students still wait for a decision (October 2026).
13. **Parent mailing lists.** Once the student records are right, sync parents_all@, parents_ey@ and parents_menu@ from The Current: a dry run first, then the real one on your word. Families of leavers drop off.
14. **The Assessments catalog.** The list behind [Assessments](#/assessments) is a file in the code (`public/assessments/catalog.json`), built on the laptop by `scripts/assessments/build_catalog.py`, which also copies the papers to the shared drive. Check it against what each year group will be taught, add new PRA progress reviews as they are written, and deploy.
15. **Photos.** Finish any photo event still open in [Photos](#/photos): **Finish event** keeps one version of each photo and frees the storage.
16. **This handbook.** This chapter (quarters, deadlines, events, renewals), the figures in [Fees, invoices and receipts](#/handbook/fees), and the examples in the other chapters (invoice numbers such as PRA-2627-0001, dates, folder names with 2026-2027 in them).

### Checking the move

1. Open **New invoice**, pick one student and a plan, and compare the live total on the right with the new fee sheet. Do not press **Create invoice**.
2. Open [Attendance](#/attendance) → **Summary** and check that the new year's quarters are in the list of periods.
3. Open [Reports](#/reports) and check that the period buttons show the new year's quarters.
4. Open the website's schedule page and tuition page in English and Vietnamese.

> **Ask Claude:** "We have moved to the new academic year. Check The Current's code, Settings and Report settings, and the website, for anything that still says 2026-2027, and list it for me before changing anything."
