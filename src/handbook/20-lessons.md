The Lessons tab is where teachers ask for a lesson for one of their classes. A request comes back as slides for class with a one-page plan, a guided review, online practice or homework, a printed worksheet or a review game, in the style of Bowen's Year 7 decks. Teachers never use the Claude account: whoever runs PRA's Claude account works the queue and puts the links back on the request. This chapter is for teachers asking for a lesson and for the person running the queue.

## Where it is

- **Lessons** in the menu on the left, under Teaching, at https://current.pra.edu.vn/#/lessons.
- For now only Mr. Bowen and Mr. David see it (Bowen, 5 November 2026): Mr. David's Year 5 Maths is the first class to try it. Nobody else has it in the menu, on Home or in the student window, and opening the address shows only "Lessons is being tried with a few teachers first". The list is `LESSONS_PILOT` in `src/lib/lessons.js`: to open the tab to another teacher, add their login address there and deploy, then change this line.
- Inside the pilot, the page works as this chapter describes: teachers see their own classes, and office accounts and head teachers also see the queue.
- A link such as `#/lessons?request=12` opens request 12.
- Built 5 November 2026. The database part is `supabase/updates-2026-11-05-lessons.sql`, run once by Bowen. Until it has run, the page says which file to run. The emails are a second file, `supabase/updates-2026-11-05-lessons-mail.sql`, run after it (see [Emails](#/handbook/lessons?s=emails)).

## Asking for a lesson

A teacher who has no requests yet sees two lines at the top of the tab saying how it works. On the Lessons tab each of your classes has a card: how many requests it has and where they are, the latest one, and three buttons.

- **New request** opens the form for that class.
- **Next lesson** opens the form filled in from your last request for the class: the same book, the next section with its pages, and what you asked for last time. When the last request was from a book, the card says what it will ask for ("Next lesson asks for Unit 5.3 ... · pp. 48–51"), and the form says it again at the top. Check it and send.
- **About this class** (the line on the card) holds what the builder should know about the class. Fill it in once; see below.

The form has three short steps. Only the class and one thing to build from are required. Teachers can write in English or Vietnamese.

1. **What to make.** Tick any of Slides for class, Guided review, Online practice / homework, Printed worksheet, Review game. The first three are ticked to start with. A small **What you'll get** box under the list says in plain words what comes back for what is ticked.
2. **Based on.** One or more of: a book from the catalogue (the class's year first, then the years either side; then the unit and the section, each shown with its pages, such as "5.2 Adding negatives · pp. 44–47", and the pages box filled in from the section), your own files (photos of book pages, your slides or worksheets: drag them in, paste a screenshot, or pick them; pictures, PDFs and Office files, 25 MB each), Drive links (one a line), or a topic in a sentence.
3. **Details**, all optional: the teaching date, the lesson length, key words, what the class finds hard, ideas to include, what to avoid, the homework size and its due date, anything else.

**Save as draft** keeps it out of the queue. **Send** puts it in the queue. The teaching date decides where it sits in the queue, so give one when you know it.

## About this class

Filled in once per class by its teachers (or the office) and shown inside every request for that class:

- the English level, in your words
- whether to add Vietnamese where it helps
- how many students have a device at home for online practice (all, most, some, few)
- the name to use in examples, for example "Mr. David"
- the books the class uses (they get a star in the book list)
- notes: routines, what works, what they enjoy

## What comes back

When the lesson is ready the request shows big buttons, one for each part: **Open slides**, **Print plan**, **Try the review**, **Practice**, **Worksheet**, **Game**, with a note from the builder when there is one. The review and the practice are on the students' site, PRA Learn (learn.pra.edu.vn, being set up). Once students start them, the request also shows how the class is getting on: see [Student logins and results](#/handbook/lessons?s=student-logins-and-results).

Open each part and look through it, then:

- **Approve** when it is right. The request is done and the links stay on it.
- **Ask for changes**, and say what should change. It goes back to the builder.

Messages on a request (comments, a question from the builder, your answer) are in the thread at the bottom of the request window.

## Publishing to PRA Learn

The guided review and the practice are put on PRA Learn by the builder, as part of building the pack. They go there closed: students cannot see them yet. The teacher checks them from the buttons on the request (**Try the review**, **Practice**), then opens the lesson for the class on PRA Learn, from the class page (**Class page on PRA Learn** on the request). Until then the request says "Not open to the class yet". Students sign in with the logins below.

## Emails

The Current emails people when a request needs them, through the same outbox as the other emails from admin@ (Office > Emails shows them). Each email is in English, then Vietnamese, and links straight to the request.

- **To the teacher** when the request is **Ready to check** (with a link for each part and the builder's note), and when the builder asks a **question** (with the question).
- **To the person running the queue** when a teacher **sends** a request (also a draft or a cancelled one sent again; sending the same one again within 30 minutes does not send a second email), and when a teacher **asks for changes** (with what they wrote).
- Nothing is emailed for Building, Done, Cancelled, a comment or an answer to a question.
- The queue address is a setting, the `lessons` row of the email settings: `{ "on": true, "to": "admin@pra.edu.vn", "teacher_on": true, "office_on": true }`. `to` is the address, `teacher_on` / `office_on` switch one side off, `on: false` stops them all. There is no box for it on the Emails page yet; Bowen changes it in Supabase (Table Editor, `adm_mail_templates`).
- An email problem never stops a request from saving.
- Database part: `supabase/updates-2026-11-05-lessons-mail.sql`, run once after the lessons file. It tests itself and undoes the test.

## Student logins and results

Students do the guided review and the practice on PRA Learn, learn.pra.edu.vn. Each student signs in with a username and a 4-digit PIN that their teacher prints on a login card. The Lessons tab is where logins are made and where a request shows how the class did.

### Who can do it

- Office accounts, Seth and Bowen: every class.
- A teacher: the classes on their Teachers row, and the students of those year groups.
- The database and the function that makes logins check this again, so a page that shows a button to the wrong person still gets nothing.

### Making logins and printing the cards

- **Student logins** at the top of the Lessons tab opens the window for a class (pick it in the list). The same button is on each class card. For one student, the student window (Students, then the student) has a **PRA Learn login** line.
- A login belongs to the student, not the class: one login works in every class of their year group. Enrolled and Pending (trial) students can have one; Past students are not listed.
- **Make logins for the 3 without one** (or **Make logins for all 12** the first time) makes the missing ones. **Make login** on a row makes one.
- The username is a word and two numbers, such as `otter27`, never the child's name. The PIN is 4 digits.
- **A PIN is shown only once**, straight after the login is made or a new PIN is given. A yellow box then shows the cards: press **Print 12 cards** before doing anything else. **Done**, or closing the window, forgets the PINs for good. If they were not printed, the only way back is a new PIN.
- One A4 page holds up to 24 cards; a smaller class gets bigger cards, and more than 24 print on more pages. Each card has the child's name (the nickname when there is one), the username, the PIN, the address learn.pra.edu.vn and two short instructions in English and Vietnamese. Cut along the dashed lines and keep the cards in class.

### A lost card, a forgotten PIN, a student who leaves

- **New PIN** gives a new PIN with the same username, and the old PIN stops working at once. Print the new card.
- **Disable** signs the student out and stops the login from working; their work on PRA Learn is kept. **Enable** undoes it. Disable a login when a student leaves or a card has gone to someone it should not have.
- The list also shows when each student last signed in, which is the quickest way to see who has not tried yet.

### Results on a request

When a request's review or practice is on PRA Learn, the request window shows **Students on PRA Learn** under the lesson's buttons:

- for the guided review and for the practice, how many students are done, started and not started, with a bar;
- the average score of each student's first finished try;
- the questions most often wrong the first time (up to five), in the words of the question;
- how many students cannot sign in yet (no login, or a disabled one);
- **Class page on PRA Learn**, which opens the class's page there with each student's results.

Until the teacher opens the lesson for the class on PRA Learn, it says "Not open to the class yet". Teachers see the results of their own classes; office accounts, Seth and Bowen see all of them.

### Before it works

None of this works until PRA Learn's database part (`C:\Users\sbowe\learn\supabase\learn-schema.sql`) has been run and the `learn-accounts` function has been deployed (its README is in `C:\Users\sbowe\learn\supabase\functions\learn-accounts\`). Until then the Student logins window says so. In offline testing the logins and the results are made up, so all of it can be tried there.

## The statuses

Each status has its own colour, on the pill, the row's left edge and the buttons.

| Status | What it means |
|---|---|
| **Draft** | Saved but not sent, so not in the queue. The office and Seth and Bowen can open it; other teachers cannot. |
| **Sent** | In the queue, not started. You can still change or cancel it. |
| **Building** | The lesson is being made. |
| **Question for you** | The builder asked something. Your answer sends the request back to them. The office sees this as "Waiting on the teacher". |
| **Ready to check** | Built. Look through it, then approve it or ask for changes. |
| **Changes asked** | Your changes are with the builder. |
| **Done** | Approved. |
| **Cancelled** | Withdrawn. It can be sent again. |

- A teacher can cancel a request while it is Sent, and delete one they added while it is a Draft or Sent. Seth and Bowen can delete any.
- A teacher cannot mark their own request Building or Ready, fill in the links, claim it or hand it to another teacher. The database refuses it, not only the page.
- A Draft or Cancelled request can only be sent once it has something to build from and at least one thing ticked to make.
- Nobody outside the staff sees a request, even when their address is on it: a student login (PRA Learn), a mistyped address or a teacher who has left gets nothing.

## The office's view

Office accounts and head teachers open on the **Queue**, with tabs **To build** (sent and changes asked), **Building**, **Questions**, **Ready to check** and **Done**, sorted by teaching date and then number. Those with classes of their own switch to **My classes** with the button above the list.

In a request window the office can set any status, **Fill in the links** by hand (when a lesson was made outside the script) and **Ask the teacher a question**, which sets Question for you.

## Running the queue

Whoever runs PRA's Claude account works the requests in a Claude session. The `teacher-lessons` skill holds the steps; the script that reads and updates the requests is:

```
python C:\Users\sbowe\pra-triage\the_current_lessons.py list
```

It signs in with the triage login, like `the_current_todos.py`, and can read requests, profiles, files and the book catalogue, claim a request, ask a question, add a note, mark it ready with the links, and add books to the catalogue. It cannot delete anything, and it cannot change what the teacher asked for: the database lets the triage login change only the status, the links and who is building it.

> **Ask Claude:** "Work the lesson requests."

> **Ask Claude:** "Build lesson request 12."

- Claude reads the requests in teaching-date order, asks the teacher (through the request) when something it needs is missing, builds the pack, and sets Ready to check with the links. The teacher approves it; Claude never sets Done.
- The book catalogue (Workbooks now, Learner's Books later) comes from the shared drive's ACADEMIC/CURRICULUM/Workbooks folder and is loaded by the same script.
- Teachers get an email when their lesson is ready and when Claude asks them something, and the queue address gets one when a request comes in or changes are asked ([Emails](#/handbook/lessons?s=emails)). Until the emails file has run, tell teachers to look at the Lessons tab.
