# The Current: feature map

One line per feature of The Current (current.pra.edu.vn), grouped as the sidebar groups them (`src/components/Layout.jsx`, `NAV`). Routes are from `src/App.jsx`. "Hb" is the handbook chapter in `src/handbook/` (03 = `03-the-current.md`). This is a map, not documentation: open the files and the chapter for detail.

`node scripts/check-handbook.mjs` also checks this file: every repo path in backticks must exist, and every route in `src/App.jsx` must appear here in backticks. Paths outside the repo (C:/Users/sbowe/...) are checked only on a laptop that has that folder.

## Before saying something is new

1. Search this file for the thing and for the words a person would use (post, email, print, export, PDF, Drive, Facebook, schedule).
2. Grep the code: `src/` (pages, components, lib, and the labels in `src/lib/i18n.jsx`) and `supabase/` (tables, functions, SQL files).
3. Search the handbook (the chapters in `src/handbook/`, or the Handbook page's search box), then the session notes in C:/Users/sbowe/.claude/projects/C--Users-sbowe-Desktop-Admin-Email/memory/.
4. Only then say it needs building. If it exists but is not live, say that (see the last section).

## Sign-in and the frame (every page)

| Feature | What it does | Files | Hb | Depends on |
|---|---|---|---|---|
| Sign-in page | Email and password sign-in at `/login`; every other page needs a session. | `src/pages/Login.jsx`, `src/lib/AuthContext.jsx` | 03 | Supabase Auth |
| Roles | Super Admin, Head Teacher, Admin (office), Teacher, View only; decide pages and edits. | `src/lib/AuthContext.jsx`, `src/data/staff.js` | 03 | adm_teachers, RLS in `supabase/reports.sql` |
| Sidebar menu | Sections Teaching, Office, Outreach, Setup; narrow icon mode; phone drawer. | `src/components/Layout.jsx` | 03 | none |
| Register-hour glow | Attendance glows amber 8:00-9:00 on class days. | `src/components/Layout.jsx` | 03, 06 | academic calendar feed |
| Change password | Own password, from the menu under your name. | `src/components/Layout.jsx` | 03 | Supabase Auth |
| English / Tiếng Việt switch | Whole app in either language. | `src/lib/i18n.jsx` | 03 | none |
| View as (offline only) | Preview the app as a given teacher in offline mode. | `src/components/Layout.jsx`, `src/lib/AuthContext.jsx` | 03, 14 | offline mode |
| Offline mode band | Yellow band when the build has no database; data in localStorage. | `src/lib/db.js`, `src/lib/supabaseClient.js` | 03, 14 | .env at build time |

## Top of the menu

| Feature | What it does | Files | Hb | Depends on |
|---|---|---|---|---|
| Home `/` | Today's chips, quick links, today's lessons, attendance today, your reports, totals. | `src/pages/Home.jsx` | 03 | most tables |
| Home: lessons and newsletter lines | Lessons waiting; newsletter approval and class-corner reminders. | `src/components/lessons/HomeLessonsCard.jsx`, `src/components/newsletter/CornerReminder.jsx` | 03, 20 | adm_lesson_requests, adm_newsletters |
| Students `/students` | Student list with status, year group, program and meals filters. | `src/pages/Students.jsx` | 03, 05 | adm_students |
| Student window | Names, enrollment, family and contact, billing, dates, status. | `src/components/students/StudentModal.jsx` | 05 | adm_students |
| Families tab | Families, Add family, Group into families (shared parent email or phone). | `src/components/students/FamilyModal.jsx`, `src/lib/families.js` | 05 | adm_families |
| Student IDs | Student numbers made and shown on the record. | `src/lib/studentIds.js` | 05 | adm_students |
| Year group from birthday | Suggests the class from the date of birth. | `src/lib/placement.js` | 05 | none |
| Email slip warning | "gmai.com: did you mean gmail.com?" on typed addresses. | `src/lib/emailCheck.js`, `src/components/EmailSlip.jsx` | 05 | same list in C:/Users/sbowe/pra-website/src/assets/js/main.js |
| Trial students, Make trial | Pending students booked for trial days; shown on Home and Attendance. | `src/lib/trial.js` | 05, 06 | `supabase/updates-2026-10-26-trial-students.sql` |
| Partial-day students | Arrive late (e.g. 11:35): no academic areas, register skips before arrival. | `src/lib/studentDates.js` | 06, 07 | `supabase/updates-2026-09-22-partial-day.sql` |
| Start and end dates | Expected end date, finishing this quarter, leavers. | `src/lib/studentDates.js` | 05, 06 | `supabase/updates-2026-10-02-student-dates-onboarding.sql` |
| New-student checklist | Steps to finish for a new student, counted on Home. | `src/components/students/NewStudentChecklist.jsx`, `src/lib/onboarding.js` | 05 | adm_students.onboarding |
| Supply check | Gmail draft to the year group's teachers and Hien, plus a To-Do for Hien. | `src/components/students/SupplyCheckModal.jsx`, `src/lib/supplyCheck.js` | 05 | Gmail drafts (`src/lib/gmail.js`) |
| Documents on Drive, Check Drive, Sort | Lists each student's files in the Drive enrollment folder; sort unnamed files. | `src/components/students/StudentDocuments.jsx`, `src/components/students/DriveDocsModal.jsx`, `src/lib/driveDocs.js`, `src/lib/useDriveDocs.js` | 05 | adm_drive_files, adm_drive_doc_links, Google sign-in |
| Student photos | Private student photos on the record, class lists and reports. | `src/lib/photoKey.js`, `scripts/upload-student-photos.mjs` | 05, 14 | bucket adm-photos |
| PRA Learn login line | The student's PRA Learn login on the student window. | `src/components/learn/LearnLoginLine.jsx` | 20 | learn-accounts function (C:/Users/sbowe/learn/supabase/functions/learn-accounts) |
| Meals Yes/No | Meals answer on the list; feeds the menu mailing list. | `src/pages/Students.jsx` | 05, 13 | `supabase/updates-2026-10-15-parent-groups.sql`, C:/Users/sbowe/pra-triage/parent_groups.py |
| Copy parent emails | Copies the parent addresses of the rows shown. | `src/pages/Students.jsx` | 05 | none |
| Load roster file | Loads the private roster JSON into the database. | `src/pages/Students.jsx`, `scripts/build_roster.py` | 05 | private/roster.json (not in git) |
| Export student list | Styled Excel workbook of students, families, birthdays. | `src/lib/studentWorkbook.js`, `src/lib/exportExcel.js` | 05 | none |
| Class lists `/print/class-lists` | A4 page per class: photo, birthday, allergies, contacts, pick-up. | `src/pages/PrintClassLists.jsx`, `src/components/print/Sheets.jsx` | 03, 06 | adm_enrollments (health answers) |
| Attendance `/attendance` | Daily register: Present, Late, Absent, Mark everyone else present, notes. | `src/pages/Attendance.jsx` | 06 | adm_attendance |
| Trips (traveling students) | Days away traveling, counted as A(T) absence. | `src/components/attendance/Trips.jsx`, `src/lib/travel.js` | 06 | adm_travel, `supabase/updates-2026-10-01-travel.sql` |
| Attendance summary | Month, quarter or year totals per student. | `src/lib/attendanceSummary.js` | 06 | adm_attendance |
| Attendance printout `/print/attendance` | Overview plus a register per year group, A4 landscape. | `src/pages/PrintAttendance.jsx` | 03, 06 | adm_attendance |
| ECAs `/eca` | Terms, activities, lists, waiting list, ECA register and summary. | `src/pages/Ecas.jsx`, `src/lib/eca.js` | 06 | adm_eca_terms, adm_eca_activities, adm_eca_members, adm_eca_attendance |
| ECA register printout `/print/eca` | One A4 page per activity with students, allergies, week boxes. | `src/pages/PrintEca.jsx` | 03, 06 | same tables |
| Incidents `/incidents` | Student incidents (any staff) and staff incidents (office), pictures, Closed. | `src/pages/Incidents.jsx`, `src/components/incidents/IncidentModal.jsx`, `src/lib/incidents.js`, `src/lib/incidentFiles.js` | 03, 05 | adm_incidents, bucket adm-incidents, `supabase/updates-2026-11-03-incidents.sql` |
| Incident printout `/print/incident/:id` | Injury or incident report on A4, English or Vietnamese. | `src/pages/PrintIncident.jsx` | 03, 05 | adm_incidents |
| To-Do `/todo` | Team and Claude tasks: For me, All, To check, Claude, Done; files, notes. | `src/pages/Todos.jsx`, `src/components/todos/TodoModal.jsx`, `src/lib/todos.js`, `src/lib/todoFiles.js` | 10 | adm_todos, rpc adm_todo_add_update, bucket adm-todo, C:/Users/sbowe/pra-triage/the_current_todos.py |

## Teaching

| Feature | What it does | Files | Hb | Depends on |
|---|---|---|---|---|
| Reports `/reports` | Quarter and year-group list of progress reports with completion. | `src/pages/reports/Reports.jsx`, `src/components/report/ReportsTabs.jsx` | 07 | adm_reports, adm_report_sections |
| Create reports | Makes the quarter's reports; skips leavers and late joiners. | `src/pages/reports/Reports.jsx`, `src/lib/report/utils.js` | 07 | adm_reports |
| Update class references | Class reference = live mean of the year group's scores. | `src/lib/report/utils.js` | 07 | adm_report_sections |
| Set status to (bulk) | Tick reports, set Draft, Ready, Published or Sent. | `src/pages/reports/Reports.jsx` | 07 | `supabase/updates-2026-10-26-report-sent.sql` |
| Send in | Per report: English, Tiếng Việt or Both for the family email. | `src/pages/reports/Reports.jsx` | 07 | adm_report_send, `supabase/updates-2026-10-23-report-send.sql` |
| Family emails | One Gmail draft per family with each child's report PDF, Seth in copy. | `src/components/report/FamilyEmailsModal.jsx`, `src/lib/report/familyEmails.js` | 07 | Gmail drafts, `supabase/updates-2026-10-23-report-drafts.sql` |
| Translate | Vietnamese reports from a translation file, with a review step. | `src/components/report/TranslationModal.jsx`, `src/lib/report/translationFile.js` | 07 | adm_report_sections |
| Report date | One date on every report of the quarter (Super Admin). | `src/pages/reports/Reports.jsx` | 03, 07 | adm_reports |
| Class reference (class average) | Live average of the year group's review scores, printed beside each score; no button. | `src/lib/report/utils.js`, `src/pages/reports/ReportEditor.jsx` | 02, 07 | adm_reports |
| Report editor `/reports/:id` | Write your parts; saves as you type; levels, scores, comments. | `src/pages/reports/ReportEditor.jsx` | 07 | adm_report_sections, adm_course_notes |
| Wording checker and limits | Flags wording and counts characters against each box's limit. | `src/components/report/WritingTags.jsx`, `src/lib/report/wording.js`, `src/lib/report/defaults.js` | 07 | none |
| Report PDF `/print/report/:id` | One A4 page per report, English or Vietnamese, with photo and signatures. | `src/pages/reports/PrintReport.jsx`, `src/lib/report/reportPdf.js`, `src/lib/report/reportPdfLayout.js`, `src/components/report/ReportPdfPreview.jsx` | 07 | adm_signatures, bucket adm-photos |
| Print all `/print/reports` | Every report of a year group and quarter, one language. | `src/pages/reports/PrintBatch.jsx` | 03, 07 | same |
| Report settings `/reports/settings` | Wording, periods, five levels, learning areas, templates, signature lines. | `src/pages/reports/ReportSettings.jsx`, `src/lib/report/defaults.js` | 07 | adm_settings |
| Upper Secondary `/reports/upper-secondary` | Homeroom and academic comments plus Acellus transcript PDFs per student. | `src/pages/reports/UpperSecondary.jsx`, `src/lib/transcripts.js` | 07 | adm_upper_secondary, bucket adm-transcripts, `supabase/updates-2026-10-27-upper-secondary.sql` |
| Schedule `/schedule` | Timetable by Classes, Teachers, Duty; Edit, Save, Print, Built-in schedule. | `src/pages/Schedule.jsx`, `src/lib/schedule.js`, `src/data/schedule.js` | 03, 06 | adm_settings |
| Assessments `/assessments` | Search Cambridge and PRA assessment papers; files open on the shared drive. | `src/pages/Assessments.jsx`, `src/lib/assessments.js`, `public/assessments/catalog.json` | 09 | `scripts/assessments/build_catalog.py`, `scripts/assessments/gather_downloads.py` |
| Lessons `/lessons` | Teachers request a lesson or game; queue, statuses, approve or ask for changes. | `src/pages/Lessons.jsx`, `src/components/lessons/RequestForm.jsx`, `src/components/lessons/RequestView.jsx`, `src/lib/lessons.js` | 20 | adm_lesson_requests, rpc adm_lesson_add_update, bucket adm-lessons, pilot list in `src/lib/lessons.js` |
| Lessons: book pages | Pick book, unit, section and page pictures for a request. | `src/components/lessons/BookPicker.jsx`, `src/lib/lessonBooks.js` | 20 | adm_sources, bucket adm-books, C:/Users/sbowe/pra-triage/lessons/books_sync.py |
| Lessons: About this class | What the lesson builder knows about each class. | `src/components/lessons/ClassProfileModal.jsx` | 20 | adm_class_profiles |
| Lessons: emails | Outbox emails to the teacher and the queue runner. | `src/lib/mail.js` | 20 | `supabase/updates-2026-11-05-lessons-mail.sql`, Apps Script mailer |
| Lessons: files on a request | Book-page photos and the teacher's own slides or worksheets. | `src/components/lessons/LessonFiles.jsx`, `src/lib/lessonFiles.js` | 20 | bucket adm-lessons, `supabase/updates-2026-11-05-lessons.sql` |
| Lessons: the queue | Claude builds the packs and puts the links back on the request. | `src/components/lessons/RequestView.jsx` | 20 | teacher-lessons skill, C:/Users/sbowe/pra-triage/the_current_lessons.py |
| Student logins (PRA Learn) | Make logins, print login cards, reset codes, per class. | `src/components/learn/StudentLogins.jsx`, `src/components/learn/LoginCards.jsx`, `src/lib/learn.js` | 20 | learn_accounts, learn-accounts function |
| Results on a request | Students' results on PRA Learn for a lesson request. | `src/components/learn/LearnResults.jsx` | 20 | rpc learn_request_results |
| Newsletter (teachers) `/newsletter` | Teachers see the page under Teaching; EY teachers get the questions. | `src/pages/newsletter/Newsletters.jsx` | 03 | adm_newsletters |
| Early Years questions `/newsletter/questions` | Weekly Nursery and Kindergarten answers; Copy for the newsletter; By report area. | `src/pages/newsletter/EyQuestions.jsx`, `src/lib/newsletter/eyQuestions.js`, `src/lib/newsletter/eyAnswers.js` | 03 | adm_ey_answers, `supabase/updates-2026-10-22-ey-questions.sql` |

## Office

| Feature | What it does | Files | Hb | Depends on |
|---|---|---|---|---|
| Invoices `/invoices` | Invoice list, statuses, Set status…, Gmail drafts, Delete selected. | `src/pages/Invoices.jsx`, `src/lib/invoiceStatus.js` | 04 | adm_invoices, adm_payments |
| New invoice `/invoices/new` | Builder: fees, sibling discount, proration by First day / Last day. | `src/pages/InvoiceBuilder.jsx`, `src/lib/pricing.js`, `src/lib/fees.js`, `src/lib/invoiceDates.js` | 04 | adm_settings |
| Invoice for someone not in The Current | Invoice with no student record (guest). | `src/pages/InvoiceBuilder.jsx` | 04 | adm_invoices |
| Invoice page `/invoices/:id` | Edit lines, language, Mark as sent, Record payment, proof of payment. | `src/pages/InvoiceEditor.jsx`, `src/components/ProofPicker.jsx`, `src/lib/proof.js` | 04 | adm_payments, bucket adm-receipts |
| Gmail draft… (invoice email) | Saves the invoice email with PDF to admin@ Drafts; never sends. | `src/components/SendInvoiceModal.jsx`, `src/lib/invoiceEmail.js`, `src/lib/invoiceDraft.js`, `src/lib/gmail.js` | 04 | Google sign-in, VITE_GOOGLE_CLIENT_ID |
| Invoice PDF `/print/invoice/:id` | Full-screen invoice PDF with bank details, VietQR, force majeure clause. | `src/pages/PrintInvoice.jsx`, `src/lib/invoicePdf.js`, `src/lib/invoicePdfLayout.js`, `src/lib/forceMajeure.js` | 04 | `public/vietqr.png` |
| Receipt `/print/receipt/:id` | Cash receipt (Phiếu thu), English and Vietnamese. | `src/pages/PrintReceipt.jsx`, `src/components/ReceiptDocument.jsx` | 04 | `supabase/updates-2026-10-01-receipt-numbers.sql` |
| Export Excel (invoices) | Workbook of invoices and payments. | `src/lib/exportExcel.js` | 04 | none |
| Fees summary `/print/fees` | Received, invoiced, still owed and overdue for a month or the year. | `src/pages/PrintFees.jsx`, `src/lib/feesSummary.js` | 03, 04 | adm_invoices, adm_payments |
| Leads `/leads` | One row per enquiring family: stage, next step, follow-up, Archive. | `src/pages/Leads.jsx`, `src/components/leads/LeadModal.jsx`, `src/lib/leads.js` | 05 | adm_leads, C:/Users/sbowe/pra-triage/the_current_leads.py |
| From the website | Contact and tour form messages, with thank-you and alert status. | `src/components/leads/WebMessages.jsx` | 05, 11 | adm_web_messages, rpc adm_web_submit, `supabase/updates-2026-09-30-website-forms.sql` |
| Make the student records | Turns a lead's children into pending students. | `src/components/leads/MakeStudentsModal.jsx` | 05 | adm_students |
| Admissions summary `/print/admissions` | Enquiries, stages, sources, tours, forms, follow-ups due. | `src/pages/PrintAdmissions.jsx`, `src/lib/admissionsSummary.js` | 03, 05 | adm_leads, adm_enrollments |
| Enrollments `/enrollments` | Website enrollment forms; Mark checked; Add pending student; To check only. | `src/pages/Enrollments.jsx`, `src/components/enrollments/EnrollmentModal.jsx`, `src/lib/enrollment.js` | 05 | adm_enrollments, adm_enrollment_private, bucket adm-enrollment, rpc adm_enroll_submit, rpc adm_enrollment_make_student |
| Enrollment form on the website | /admissions/enroll/ sends the form into Enrollments. | C:/Users/sbowe/pra-website/src/assets/js/enroll.js | 05, 11 | `supabase/updates-2026-09-30-enrollments.sql`, `supabase/updates-2026-11-05-enrollment-guard.sql` |
| Enrollment printout `/print/enrollment/:id` | Print / Save PDF of one form; also from the student window. | `src/pages/PrintEnrollment.jsx` | 05 | adm_enrollments |
| Emails `/emails` | Outbox of everything The Current emails; Send again; thank-you wording; alerts. | `src/pages/Emails.jsx`, `src/components/mail/MailLine.jsx`, `src/components/mail/MailParts.jsx`, `src/lib/mail.js` | 03, 05, 14 | adm_mail_queue, adm_mail_templates, rpc adm_mail_retry, `scripts/mailer/the-current-mailer.gs` |

## Outreach

| Feature | What it does | Files | Hb | Depends on |
|---|---|---|---|---|
| Photos `/photos` | Event list; Upload event… from the laptop. | `src/pages/photos/Photos.jsx`, `src/components/photos/UploadEvent.jsx`, `src/lib/eventUpload.js` | 08 | adm_photo_events, bucket adm-event-photos, `scripts/upload-event-photos.mjs` |
| Event page `/photos/:id` | Looks, captions, sign-off against the no-photo list, notes, Finish event. | `src/pages/photos/PhotoEvent.jsx`, `src/components/photos/PhotoModal.jsx`, `src/components/photos/EventNotes.jsx`, `src/lib/eventPhotos.js` | 08 | adm_event_photos |
| Post to Facebook… | Posts or schedules a draft post with photos to the Page; Cancel on Facebook. | `src/components/photos/PostCard.jsx`, `src/components/photos/FacebookPost.jsx`, `src/lib/facebook.js` | 08, 14 | function `supabase/functions/facebook-post/index.ts`, adm_event_posts (photos only, no video) |
| Photos for the website | Choose photos to publish on pra.edu.vn. | `src/components/photos/WebsitePanel.jsx` | 08, 11 | `supabase/updates-2026-09-28-event-photos-website.sql` |
| Newsletter `/newsletter` | Issue list for The Palm River Post and the Early Years newsletter; New issue. | `src/pages/newsletter/Newsletters.jsx`, `src/lib/newsletter/newIssue.js` | 03, 11 | adm_newsletters, adm_newsletter_parts |
| Newsletter editor `/newsletter/:id` | Sections EN then VI, photos, preview as page, email and PDF. | `src/pages/newsletter/NewsletterEditor.jsx`, `src/components/newsletter/PartEditor.jsx`, `src/components/newsletter/Preview.jsx`, `src/lib/newsletter/pdf.js` | 03 | bucket adm-newsletter, public bucket newsletter |
| Newsletter: no-photo list check | Flags photos of students on the no-photo list. | `src/components/newsletter/NoPhotoList.jsx` | 03, 08 | adm_students |
| Newsletter: Teachers' answers | EY questions answers inside an Early Years issue. | `src/components/newsletter/EyAnswersPanel.jsx` | 03 | adm_ey_answers |
| Publish or schedule… | Publish now (page + Gmail draft) or Schedule (approval, then mailer sends). | `src/components/newsletter/PublishPanel.jsx`, `src/lib/newsletter/publish.js`, `src/lib/newsletter/email.js` | 03, 11 | function `supabase/functions/newsletter-build/index.ts`, rpc adm_newsletter_schedule, Apps Script mailer |
| Send a test… | Test email of an issue to up to six staff addresses. | `src/components/newsletter/TestDialog.jsx` | 03 | rpc adm_newsletter_send_test |
| Website `/website` | Visits, page views, top pages, sources, countries, devices for pra.edu.vn. | `src/pages/WebsiteStats.jsx`, `src/lib/webStats.js` | 11 | function `supabase/functions/web-stats/index.ts` (Cloudflare Web Analytics) |

## Setup

| Feature | What it does | Files | Hb | Depends on |
|---|---|---|---|---|
| Settings `/settings` | Fee schedule, academic calendar, bank account, center details. | `src/pages/Settings.jsx`, `src/lib/fees.js` | 03, 04 | adm_settings |
| Data export / Import roster (Excel) | Export Excel, Export student list, import a roster workbook. | `src/pages/Settings.jsx`, `src/lib/exportExcel.js` | 03, 05 | none |
| Export to a folder | Super Admin: invoices, receipts, reports and lists into a Drive folder. | `src/components/FolderExportCard.jsx`, `src/lib/folderExport.js` | 04, 14 | Google Drive for desktop on the laptop |
| Signatures `/signatures` | Sign on screen or upload a photo; printed on progress reports. | `src/pages/Signatures.jsx`, `src/components/signatures/SignSheet.jsx`, `src/components/signatures/UploadSheet.jsx`, `src/lib/signature.js` | 03, 07 | adm_signatures, `supabase/updates-2026-10-23-signatures.sql` |
| Teachers `/teachers` | Who teaches what, homerooms, Head flag, Create login, add from schedule. | `src/pages/reports/Teachers.jsx`, `src/data/staff.js` | 03, 07 | adm_teachers, `scripts/create-staff-accounts.mjs` (office accounts) |
| Handbook `/handbook`, `/handbook/:chapter` | Search, read and print the admin handbook. | `src/pages/Handbook.jsx`, `src/handbook/index.js`, `src/handbook/markdown.js` | 19 | `scripts/check-handbook.mjs` |

## Outside the app (often asked about)

| Feature | What it does | Files | Hb | Depends on |
|---|---|---|---|---|
| The mailer in admin@ | Apps Script that sends the outbox every five minutes. | `scripts/mailer/the-current-mailer.gs`, `scripts/mailer/README.md` | 14 | pasted by hand into Apps Script in admin@ |
| Database backup | Daily pg_dump to PRA Backups\Database at 12:00. | `scripts/backup-database.ps1` | 14 | Task Scheduler on the laptop |
| File backup | Weekly copy of every storage bucket, Mondays 12:10. | `scripts/backup-files.ps1` | 14 | laptop_backup key, Task Scheduler |
| Staff and triage logins | Make office and teacher logins; the triage login. | `scripts/create-staff-accounts.mjs`, `scripts/create-triage-account.mjs` | 03 | Supabase secret key typed by Bowen |
| Inbox triage | Weekday routines that sort admin@ and add Leads and To-Do rows. | C:/Users/sbowe/pra-triage/routine/morning-update.md | 12 | triage login, cloud routines |
| Parent mailing lists and Workspace accounts | Groups follow Students; staff and student Google accounts. | C:/Users/sbowe/pra-triage/parent_groups.py, C:/Users/sbowe/pra-triage/workspace_accounts.py | 13 | GAM |
| Database schema and updates | Base schema plus dated update files Bowen runs. | `supabase/schema.sql`, `supabase/reports.sql`, `supabase/README.md` | 14 | Supabase SQL Editor |

Not in The Current (checked 13 Nov 2026): no video posting to Facebook (photos only), no forgot-password link (a reset needs Bowen's secret key), no kitchen meal sheet or bus list printout.

## Built but not live / not committed

Live bundle on 13 Nov 2026: index-CTRZCWr1.js. Sources: git status and a string check of that bundle on 13 Nov 2026, and the session notes named.

Built, not live (in the working folder only):
- Incidents page and `/print/incident/:id`; `supabase/updates-2026-11-03-incidents.sql` not run (note pra-incidents-page, 3 Nov 2026; absent from the live bundle 13 Nov).
- Invoice refund note (bank transfer only, nothing through Wise) in `src/lib/invoicePdfLayout.js` and `src/lib/invoiceEmail.js` (note pra-invoice-refund-note, 30 Oct 2026; absent live 13 Nov).
- 3 Nov bug-pass fixes, including the "Reports go out" field in `src/pages/reports/ReportSettings.jsx`; the mailer fix needs re-pasting into Apps Script (note pra-admin-bug-pass-2026-11-03, 3 Nov 2026; absent live 13 Nov).
- Login page fix: a signed-in person at `/login` goes to Home (`src/pages/Login.jsx`; note pra-login-page-fix, 2 Nov 2026; its handbook section absent live 13 Nov).
- Lessons book picker (`src/components/lessons/BookPicker.jsx`, `src/lib/lessonBooks.js`); `supabase/updates-2026-11-10-books.sql` not run, books not loaded (note pra-lessons-book-picker, 10 Nov 2026; absent live 13 Nov).
- `supabase/updates-2026-11-05-enrollment-guard.sql` marked NOT RUN in its own header (5 Nov 2026).

Live, not committed (untracked or modified in git status, 13 Nov 2026): Early Years questions, Upper Secondary, Family emails, the Reports / Upper Secondary switch, enrollment printout, invoice dates and proration, invoice for someone not in The Current, invoice screens rework. Also not committed: `scripts/backup-files.ps1` (runs on the laptop, note pra-file-backup, 27 Oct 2026). The files that went live are kept in `C:/Users/sbowe/Desktop/Admin Email/deploy-kit/` (note pra-admin-deploy-kit, 11 and 13 Nov 2026).
