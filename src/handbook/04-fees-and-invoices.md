This chapter covers the money side of The Current: the fee schedule for 2026-2027, the rules the app applies when it prices an invoice, how an invoice is made, edited, emailed and paid, and the receipts, proof files and exports that follow. Open it before the invoices for a new quarter, when a family's bill needs something unusual, or when a number on an invoice looks wrong. The calendar of invoice runs is in [The year at PRA](#/handbook/the-year).

## Where the numbers live

- The live prices are in **Setup** (gear icon) → **Settings** → **Fee schedule**. The invoice builder always reads that saved copy.
- The same numbers are also written into the code (`src/lib/fees.js`) as defaults. They are used until **Save** is first pressed in Settings, and **Reset to defaults** puts them back into the form.
- The prices on the website's fees page are typed separately and must be changed there too (see [The website](#/handbook/website)).
- All amounts are in VND. The tables below are the 2026-2027 schedule as the app holds it on 15 October 2026. If Settings shows something different, Settings is what invoices use.

## The fee schedule for 2026-2027

### Tuition

Year 9 is invoiced as Upper Secondary in 2026-2027 (see the next table), so the Year 7-9 band covers Years 7 and 8 this year.

| Band | Full year, Early Bird | Full year, Standard | Each of Quarters 1 to 3 | Quarter 4 (reduced) |
|---|---|---|---|---|
| Nursery | 100,500,000 | 109,000,000 | 33,500,000 | 16,750,000 |
| Kindergarten | 132,000,000 | 142,000,000 | 44,000,000 | 22,000,000 |
| Year 1-6 | 168,000,000 | 182,000,000 | 56,000,000 | 28,000,000 |
| Year 7-9 | 183,000,000 | 197,000,000 | 61,000,000 | 30,500,000 |

- A student who pays the full-price Quarter 4 pays the normal quarter price for it (see "Quarter 4" below).
- A returning "legacy" student keeps last year's Early Bird price: 150,000,000 for the year, on the Early Bird plan only.

### Upper Secondary

| Item | Per year | Per quarter |
|---|---|---|
| Hybrid Pathway | 150,000,000 | 37,500,000 |
| Independent Pathway | 80,000,000 | 20,000,000 |
| Acellus (online) fee, every Upper Secondary student | 110,000,000 | 27,500,000 |

PRA pays the Acellus fee on the family's behalf and the family pays it back in cash. The invoice prints a note saying so.

### Meals, transport and one-time fees

| Item | Amount | How it is counted |
|---|---|---|
| Meals, Early Years (Nursery, Kindergarten) | 75,000 a day | Class days in the period |
| Meals, Primary and Secondary | 80,000 a day | Class days in the period |
| Meals, Vocational Program | 65,000 a day | Class days in the period |
| Transport, Hoi An | 2,000,000 a month | Months in the period |
| Transport, Vinh Dien | 2,650,000 a month | Months in the period |
| Transport, Da Nang | 4,000,000 a month | Months in the period |
| New student admission fee | 10,000,000, once | When the student's **New student** box is ticked. None for the Global Program |
| Trial day | 1,600,000 a day | A plan of its own, or extra days under Other fees |
| Staff child: learning materials | 500,000 a month | 3 months by default |
| Staff child: development fee | 10,000,000 a year | On every Staff child invoice |
| Sibling discount | 5% | See "The sibling discount" below |

- Class days come from **Settings** → **Academic calendar**: 180 in the year, 45 in each quarter.
- Transport months: 10 for the full year (June has only 4 class days and is not charged), 5 for a semester, 3 for a quarter, and 8 for Quarters 2, 3 and 4 (Quarter 2's 3 plus Semester 2's 5). The number can be changed for each student in the builder.

### Weekly plans

| Plan | Per week |
|---|---|
| Global Program, Nursery | 5,000,000 |
| Vocational, Years 1-6 | 4,500,000 |
| Vocational, Years 7-9 | 4,800,000 |
| Summer, Upper Secondary | 4,000,000 |

A weekly invoice starts at 4 weeks and has no Acellus row.

### Payment deadlines

| Plan or period | Deadline |
|---|---|
| Full year, Early Bird | 20 May 2026 |
| Full year, Standard | 30 June 2026 |
| Quarter 1 | 28 July 2026 |
| Quarter 2 | 8 October 2026 |
| Quarter 3 | 17 December 2026 |
| Quarter 4 | 22 March 2027 |
| Semester 2 | 10 December 2026 |

The quarters themselves run 4 August to 8 October 2026, 15 October to 17 December 2026, 5 January to 24 March 2027 and 29 March to 4 June 2027.

## The rules the app applies

The pricing rules are written into the code. The office does not need to remember them, but should know them well enough to spot a wrong invoice.

### The sibling discount

- 5% off the main tuition of the cheapest child, when two or more children with tuition are on the same invoice.
- On a tie, the child listed last (the younger) gets it.
- It is never applied on the Staff child, Trial day or No tuition plans, and never to the Acellus fee.
- In the builder, **Apply sibling discount (5% on the cheaper child)** can be unticked, and **Discount applies to** can point it at a chosen child instead of **Automatic (cheapest)**.
- The percentage is in **Settings** → **Fee schedule**; 0 switches it off everywhere.

> **Careful:** the discount only works when the siblings are on one invoice. Pick the family, not one child at a time.

### The Acellus fee

Every Upper Secondary student pays the Acellus (online) fee, and so does every Year 9 student this year. It is ticked by default as **Online fee - Acellus (paid on behalf, cash)**. Discounts never touch it. Both it and **Pathway fee (Hybrid / Independent)** can be unticked for one student on one invoice.

### Proration

For a student who joins or leaves part-way through a quarter, on a **Pay by quarter** invoice:

1. In **3. Options for each student**, open **Prorated quarters**.
2. Tick the quarter and type the **Class days to charge**.
3. **Same for all students** copies it to the siblings.

The tuition for that quarter becomes the quarter price × days ÷ 45, rounded to the nearest 1,000 VND. Meal days follow the prorated days. The invoice prints a line such as "(Quarter 1: 30 of 45 days)".

### A student who joins after Quarter 1

A student who joins in Quarter 2 can pay for Quarters 2, 3 and 4 on one invoice: choose **Pay by quarter** and the period **Quarters 2, 3 and 4**, which ticks those three quarters.

- The invoice still prints every quarter's price, Quarter 1 included, and the **Full Year Tuition** is all four quarters. Only Quarters 2, 3 and 4 are shaded, and the blue **Tuition due in this payment** box under them gives what this invoice asks for. Bowen chose this on 20 October 2026: the shading and the box show what the family pays, so the Quarter 1 price can stay. (That morning, for a few hours, the table left out quarters that ended before the student's start date.)
- If a quarter that is ticked to bill ended before the student's **Start date**, the builder warns: this catches Quarter 1 still ticked from the default. A wrong start date is corrected on the student record.
- A **Tuition override** is the full-year price, shared over the four quarters in the schedule's proportions.
- The newcomer pays the full-price Quarter 4 (see "Quarter 4" below) and, unless they are in the Global Program, the admission fee.
- A child who joins part-way through Quarter 2 is charged for the days attended with **Prorated quarters** (see "Proration" above).

### Quarter 4

- Only students on the 2026-2027 roster when the fee schedule was published pay the reduced Quarter 4.
- A new or returning student pays a full quarter for Quarter 4. Their record has **Full-price Quarter 4** ticked, and the Students list shows a small **Q4** chip.
- The builder shows the choice for each student and it can be changed for one invoice. Untick it on the student only if a newcomer was promised the old terms.
- The app knows the roster only as student IDs and one-way name fingerprints in `src/data/rosterIndex.js`; see [Students, families and enrollment](#/handbook/students?s=the-roster-file).

### Students with no program

A student whose program is **No program** pays no tuition and gets no tuition row. The invoice carries only their meals, transport and other fees. This is how one child of a family is billed for the bus while the others pay tuition. The **No tuition (meals / transport / fees only)** plan does the same for a whole invoice.

### Staff children

The **Staff child (materials + meals)** plan charges learning materials per month (3 months by default) plus the yearly development fee, with meals as usual.

### The order of students and the due date

- On every table of an invoice the priciest child comes first. The sibling discount then lands on the child at the bottom.
- The due date is the plan's deadline (or the deadline of the first quarter or installment being billed). If that date has already passed, the due date becomes one week after the issue date. It prints in a red bar under the total.
- The due date can be set by hand in the builder or on the invoice page; **Use the date from the plan** goes back to the automatic one.

### The expected end date

A student whose expected end date comes before every quarter on an invoice is left off it. The builder says so and they can be put back by hand. Nothing else about the price changes.

### Discounts the app does not apply by itself

The app knows one sibling percentage and nothing else. Anything else agreed with a family goes in by hand, as an **Extra discount %** (on the main tuition only) or a **Tuition override (VND, blank = schedule)**. On 23 September 2026 the website announced a Global Program sibling offer (10% off the first child, 15% off the second, until December 2026) and 35% off Nursery and Kindergarten tuition for the rest of the year; neither is built into the app (not checked since 15 October 2026).

## Making an invoice

The **Invoice builder** is **Office** → **Invoices** → **New invoice**. The live total is on the right the whole time.

1. **1. Choose students.** Pick a family and all its children come along, or tick students one by one. **Include inactive** shows past students; picking one offers to bring them back as Pending, with the year group worked out from the birthday.
2. **2. Payment plan and period.** Choose the **Payment plan**: **Full year - Early Bird**, **Full year - Standard**, **Pay by quarter** (tick the **Quarters to bill now**), **Installments (custom %)** (60/40 with due dates by default), **Weekly (Global / Vocational / Summer)**, **Trial day only**, **Staff child (materials + meals)** or **No tuition (meals / transport / fees only)**. Choose the period (Full year, Semester 1 or 2, Quarters 2, 3 and 4, Quarter 1 to 4, or Custom period). On **Pay by quarter** the period and the ticked quarters move together: choosing Semester 2 ticks Quarters 3 and 4, and ticking quarters by hand names the period after them (for example "Quarters 2 and 3"). Here too: the sibling discount, the **Due date** and the **Invoice language** (English or Vietnamese; it starts as the family's preferred language).
3. **3. Options for each student.** For each child: **Year / level** and **Program** for this invoice, the tuition override, extra discount, **Full-price Quarter 4**, the Upper Secondary boxes, **Meals** (days × rate), **Transport** (months × zone), **New student admission fee**, trial days, weeks, months of materials, and **Prorated quarters**.
4. **4. Deductions and notes.** **Already paid / deposits** (**Add deduction**, then a label and an amount), **Extra notes on the invoice**, **Cash payment only (hide bank details)**, and **Show force majeure clause** (on by default).
5. Press **Create invoice**. The invoice opens on its own page with its number.

- Meals start ticked for every student whose **Meals at PRA** is Yes or not answered, and unticked for No.
- The admission fee row appears only when the student's **New student** box is ticked. For a Global Program child, leave it unticked.
- The printed invoice is headed "Fee announcement" in English.
- On a **Pay by quarter** or **Installments** invoice, the last column of the tuition table is **Full Year Tuition** (Vietnamese "Học phí cả năm"): the student's tuition for the whole year. The columns billed now are shaded, and a blue box right under them gives **Tuition due in this payment** ("Học phí cần thanh toán đợt này"), the shaded amounts added up for all the children. Both were added on 20 October 2026. Invoices saved before keep "Total" as the column name until they are rebuilt; the box appears on every PDF made from then on.

## Editing an invoice

The invoice page shows the document as tables beside a live A4 preview of the PDF.

- Every cell, heading and column label can be changed by hand. **Add row** and **Add section** add more; deductions and notes can be added; **Show bank details**, **Show QR code** and the force majeure clause can be switched off.
- The **Year / level** and **Program** pickers beside each student re-price the tuition table. Numbers typed by hand in that table are replaced. Changing the year here also changes it on the student record.
- **Rebuild from options** reopens the builder for the same invoice. It replaces every hand edit to the tables, after a warning.
- **Duplicate** copies the invoice as a new one.
- **Internal notes (not printed)** are for the office.
- **Save** keeps the changes. **Download PDF** saves the file; **Open PDF** shows it full screen to print.

### Switching the language

The **Invoice language** switch on the invoice page rebuilds the whole document in the other language from the saved builder choices, keeping which quarters are billed, the deductions and the switches. It asks first: headings and wording are replaced, and numbers typed by hand into the tables are recalculated. An invoice is in one language; a family that needs both gets two.

## The invoice list and statuses

**Office** → **Invoices** lists every invoice with its number, students, family, period, issue and due dates, total, paid, balance and status. A ✉ after the number means it was marked sent; a pen icon means a Gmail draft exists. The pills at the top filter by status, with counts.

| Status | Meaning | How it is set |
|---|---|---|
| Draft | Made, not yet sent to the family | Every new invoice starts here |
| Sent | Emailed to the family | **Mark as sent** on the invoice page, or the status picker on the list |
| Partly paid | Some money recorded | By itself, when a payment is recorded |
| Paid | Fully paid | By itself, when the payments reach the total |
| Void | Cancelled; left out of every total | By hand |

- The status picker on each row saves at once. Ticking several rows and using **Set status…** does the same for all of them.
- **Mark as sent** saves at once with the date and the addresses. Setting an invoice back to Draft clears them.
- A status chosen by hand stays as long as nothing is paid; once payments exist, they decide between Partly paid and Paid.
- **Delete selected** and the bulk actions act only on the rows the filter shows.

> **Rule:** void an invoice that a family has seen; delete only one made by mistake. Deleting an invoice deletes its payments and their proof files with it, with no undo.

## Invoice and receipt numbers

- Invoices are numbered PRA-2627-0001, PRA-2627-0002 and so on. Receipts are PT-2627-0001 and so on.
- The middle part comes from the academic year in **Settings** → **Fee schedule** (2026-2027 gives 2627). When the year changes there, the middle part changes and the count starts again at 0001.
- The app takes the highest number so far and adds one. The database refuses a duplicate, and the app then takes the next one.

## Emailing an invoice

> **Rule:** The Current never sends email. It saves a draft in the admin@palmriveracademy.edu.vn Gmail account with the PDF attached. A person reads it in Gmail and presses Send.

1. On the invoice, press **Gmail draft…**.
2. Check the window: **Send to** (filled from the family's contacts, else the parents' emails on the students), **CC**, the subject and the text. Change anything.
3. Press **Save to Gmail drafts**. The first time in a browser session, Google asks you to sign in as admin@palmriveracademy.edu.vn; allow the pop-up.
4. The message "Draft saved in Gmail with the PDF attached" confirms it, and the invoice shows that a draft exists.
5. In Gmail, open Drafts as admin@, check it once more and send.
6. Back in The Current, press **Mark as sent** on the invoice.

- Several invoices at once: tick them on the list and press **Gmail drafts (n)**.
- There is no BCC box. In 12 of the 16 announcements sent in September and October 2026 the office copied Hien; add her in Gmail before sending if she should have it.

### The default email

- The default subject is "Fee announcement for (period), academic year (year) - (students)". The text greets the parents, says the announcement is attached, gives the total, the due date and the bank transfer details, and asks for a screenshot of the transfer. The Vietnamese version says the same.
- It was reworked on 8 October 2026 from the 16 announcements the office actually sent, and has been live since 15 October 2026: no invoice number line and no "any questions" line, because staff deleted them before sending.
- Each email can be changed in the draft window and again in Gmail. The default itself is in the code (`src/lib/invoiceEmail.js`); changing it means asking Claude and a deploy.
- Still open for Bowen's decision: a default copy to Hien, bringing back the invoice number line, an "IMPORTANT:" prefix or the office signature, different opening words per kind of invoice, and a Vietnamese staff read of the default.

> **Ask Claude:** "Change the default invoice email in The Current so it ends with the office signature, show me the English and Vietnamese text before you change anything, then deploy."

### If Gmail is not connected

If the draft window says "Gmail is not connected yet", the button reads **Save PDF and open a Gmail draft** instead. Pressing it saves the PDF to the computer and opens a Gmail message with the text filled in; attach the PDF by hand and save or send it from Gmail.

It means the live app was built without the Google connection, or Google no longer accepts it. The connection is a "PRA Admin" project in Google Cloud under admin@palmriveracademy.edu.vn, and its address list must include https://current.pra.edu.vn (drafts broke for a day on 23 September 2026 when the app moved to that address).

> **Ask Claude:** "Gmail drafts from The Current say Gmail is not connected. Check the Google client ID in the .env file and the PRA Admin client in Google Cloud, fix what is wrong, and deploy."

## Payments and receipts

1. On the invoice, in the **Payments** card, press **Record payment**.
2. Fill in the amount, **Paid on**, **Method** (**Cash** or **Bank transfer**), **Reference / note**, **Payer**, and the receipt text in English and Vietnamese.
3. Add the **Proof of payment** files for a transfer (below).
4. Save. The receipt number (PT-2627-…) is given automatically, and the invoice moves to Partly paid or Paid.
5. **Print receipt** opens the cash receipt (Phiếu thu): English and Vietnamese on one sheet, with lines for the cashier and the chief accountant. The legal name, tax code and address on it come from **Settings** → **Center details**.

### Proof of payment

- Screenshots or PDFs of a bank transfer, up to 6 on each payment. Choose files, drop them in, or press Ctrl+V to paste a screenshot.
- Pictures are shrunk to a few hundred KB; a PDF can be up to 10 MB.
- They are kept in private storage. Only office accounts can open them, through links that last an hour. A paperclip on the payment row opens them later.
- Proof is not printed on the receipt. It is deleted with its payment or its invoice.

## Exports and the fees summary

### Export to a folder

**Settings** → **Export to a folder**, Super Admin only, in Chrome or Edge.

- It writes every invoice and progress report as a PDF, every proof of payment file, every enrollment form's documents and signature, and the student list and invoice data as Excel files, into a folder on the computer.
- Pointed at a folder that Google Drive for desktop keeps in step, it is an off-site copy. Bowen's export folder is `C:/Users/bowen/Desktop/PRA Admin`; whether Google Drive for desktop now syncs it has not been checked since 15 October 2026.
- The folder is remembered. After the first run only new and changed files are written. **Write every file again** and **Include reports that are not published yet** are options. Void invoices are skipped. It deletes nothing, apart from replacing its own older copy of the same record.
- Layout: `Invoices/2026-2027/`, `Invoices/2026-2027/Proof of payment/`, `Reports/2026-2027/Quarter 1/Year 3/`, `Enrollments/`, `Student list.xlsx`, `Invoices and payments.xlsx`.

1. **Export to a folder** → choose the folder the first time.
2. Press **Export now** and wait for "Export finished."

### Excel export

- **Invoices** → **Export Excel**, or **Settings** → **Data export** → **Export Excel**: one workbook with four sheets (Invoices, Line items, Payments, Students).
- The student workbook is described in [Students, families and enrollment](#/handbook/students).

### The printed fees summary

**Invoices** → **Print summary** opens a printout for a month or the year: money received, invoiced, still owed as of the end of the month (worked out from the payment dates), what is overdue grouped by how late, and the share collected. It has its own English / Tiếng Việt switch.

## Changing the fee schedule

A price change that applies from now on is made in the browser:

1. **Setup** → **Settings** → **Fee schedule**. Change the amount.
2. Press **Save**. New invoices use it at once. Invoices already made keep their numbers.

Then make the same change on the website's fees page and in the code's defaults, so **Reset to defaults** does not bring the old price back.

> **Ask Claude:** "From Quarter 3 the Vinh Dien transport rate is 2,800,000 a month. Update the default in The Current's fee schedule code, and the website's fees page in both languages if it shows that rate. Show me the changes, then deploy The Current. I will change Settings myself."

> **Careful:** Settings saves the whole schedule at once. Two people saving Settings at the same time overwrite each other. Do it alone, and reload the page before you start.

## The new academic year

The fee schedule, the deadlines, the calendar, the invoice and receipt prefix and the Quarter 4 rule all belong to 2026-2027. Some of them can be changed in Settings; some (the quarters' start and end dates, the first and last class day, the months) are only in the code. The full order of work is in [The year at PRA](#/handbook/the-year).

> **Ask Claude:** "We are moving The Current to 2027-2028. Here is the new fee schedule and calendar. Follow the rollover steps in the handbook's year chapter, update the code defaults, deploy, and then walk me through Reset to defaults and Save in Settings before I type the new amounts."

## What can go wrong

- **An invoice with a wrong number in it.** Fix the cell on the invoice page and Save, or change the option and **Rebuild from options**. Check the live total against the tables in this chapter.
- **Siblings billed separately.** No sibling discount. Make one invoice for the family, or use **Discount applies to** on the right one.
- **A new student with the reduced Quarter 4.** Check **Full-price Quarter 4** on the student and on the invoice.
- **Two people in Settings.** The last Save wins.
- **Leaving the invoice page with unsaved changes.** The browser warns only when the tab is closed, not when you move to another page in The Current. Press **Save** before you go.
- **A delete.** Deleting an invoice deletes its payments and proof files; nothing records who deleted what. Prefer Void.
- **Gmail drafts stop.** See "If Gmail is not connected" above.
- **Receipt numbers.** A database update of 1 October 2026 makes receipt numbers unique. Whether it has been run on the live database has not been confirmed (not checked since 15 October 2026).

The invoice bugs found on 17 September 2026 were fixed on 1 October 2026: an invoice no longer writes an old year group back onto the student, the automatic due date is a full week, cleared dates save, failed saves show an error, "80.000" is read as 80,000, amounts are whole dong, a family pick keeps the per-student options, bulk actions skip hidden rows, the status picker and **Mark as sent** save at once, and a duplicate number is retried. The open items are in [Known problems and open items](#/handbook/open).
