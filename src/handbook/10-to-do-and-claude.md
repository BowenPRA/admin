The To-Do tab is the office's shared task list, and the place where work for Claude waits. This chapter covers the screens, how a task arrives (typed by staff, added by the triage from an email, added by Claude), how tasks for Claude are worked in a session, and what to say to Claude to start. Open it on your first morning, whenever someone asks "can Claude do this?", and before every work session with Claude.

## What the tab is

- **To-Do** in the menu on the left, at https://current.pra.edu.vn/#/todo. Office accounts only: Super Admin, Head, Admin. Teachers do not see it, and Ms. Xuan has no account.
- It replaced the "Team To-Do & Issues Tracker" spreadsheet on 1 October 2026. Its 31 rows came across with their numbers (17 open, 14 done). The spreadsheet stays on Bowen's laptop as a record and is no longer used.
- Why it moved: staff could not add or tick off tasks in a spreadsheet on one laptop, and an automatic run should not be writing a spreadsheet into a code project.
- The Home page shows your share of it: "n for you · n late · n to check". Each opens the list.

## The views

| View | What it lists |
|---|---|
| **For me** | Open tasks given to you. The tab opens here when you have any. |
| **Everyone** | Every open task. |
| **To check** | Tasks someone has finished, waiting for the person who asked to look. |
| **Claude** | Open tasks given to Claude. |
| **Done** | Finished and checked. |

- The search box ("Task, person, note…") looks through titles, people and notes. The person filter ("Anyone") narrows the list to whoever has the task. The late count sits beside them.
- Open tasks are grouped by when they are due, each group with its own colour: **Late**, **Due today**, **Next 7 days**, **Later**, **No date**. The date reads the way people say it: "3 days late", "Today", "Tomorrow", "Thu 8 Oct".
- Each row is the task's title with one quiet line under it: its number, who asked, how many notes and files it has. The coloured edge of the row is its status. A **High** chip marks high priority.

## Statuses

| Status | Meaning, as the screen explains it |
|---|---|
| **To do** | Not started yet. |
| **Doing** | Someone is working on it. |
| **Waiting** | Stuck until someone answers or something arrives. Say what in a note. |
| **To check** | The work is done and the person who asked should look at it. |
| **Done** | Finished and checked. |

- The status pill on a row changes it at once, and so do the status buttons in the task window.
- **To check** is how work is handed back. Whoever did it sets To check; the person who asked looks and sets Done.

> **Rule:** Claude never sets a task to Done. It sets To check, and the person who asked closes it after checking, unless you tell Claude in the session to close it.

## A task

Click a task to read it. **Edit** opens the form.

| Field | What goes in it |
|---|---|
| **Task** | One line: what needs to happen. |
| **Details** | Anything the person doing it needs to know. |
| **Assigned to** | Any office or teaching login, **Claude**, or nobody yet. |
| **Asked by** | Who wants it. This decides who may delete it. |
| **Due** | The date, or none. |
| **Priority** | **Low**, **Normal** or **High**. |
| **Screenshots and files** | Up to 10 files, 10 MB each. Choose them, drop them on the box, or press Ctrl+V to paste a screenshot. Only office accounts can see them. |
| **Notes** | Updates, added one at a time with **Add note**. Each note records who wrote it and when. |

- Notes are added one by one rather than edited in one box, so two people writing at once never overwrite each other.
- A note written by the triage or by Claude shows as "Inbox triage". Any other name is a member of staff.
- The files are kept in a private storage area of the database (the bucket adm-todo), not on the website.

> **Careful:** a task can be given to a teacher, but teachers cannot open the To-Do tab. A teacher's task is a reminder for the office to pass on; the triage's emails go only to four office addresses, so they do not reach the teacher either.

### Adding a task

1. **To-Do** → **Add a task**.
2. Type the **Task** in one line and the **Details**.
3. Choose who it is for in **Assigned to**, and fill in **Asked by**, **Due** and **Priority**.
4. Add a screenshot if the task is about a page. For a task given to Claude the form says: "Say what should happen, and add a screenshot if it is about a page."
5. Save. The task gets the next number.

### Deleting a task

- Seth and the Super Admin (Bowen, then you) may delete any task.
- Anyone else may delete only a task they added or asked for. "Asked by" is matched on its first word against the first part of their email address (Hien matches hien.c@).
- The triage can add and change tasks but never delete one.
- **Delete task** is the last item in the status menu. It asks: "Delete task N for good? Its files go too. To keep the record, set it to Done." There is no undo. Prefer Done.
- Every task the triage added has the triage as its creator, so for staff only the "Asked by" match counts on those.

## Task numbers and links

- Every task has a number: #23. The spreadsheet's rows kept theirs, and new tasks carry on from the highest.
- The address https://current.pra.edu.vn/#/todo?task=23 opens task 23 directly. Inside The Current the same link is [task 23](#/todo?task=23). Put the link in an email or a chat message to point someone at a task.
- In the triage's emails a number is always written with a hash and brackets, so it cannot be mistaken for an amount or a date: "(To-Do #23)" at the end of a line in digests and forwards, "(#23)" in front of the task in the morning report to the admin. Bowen set this rule on 5 October 2026 (To-Do #48).
- With Claude, say "task 23" or "#23".

## How a task arrives

### Typed by staff

Anyone with an office account adds tasks on the page, for themselves, for each other or for Claude.

### Added by the triage from an email

The triage, the automatic sorting of the admin@ inbox (see [The inbox and the triage](#/handbook/inbox)), adds a task in three cases only:

1. **Something concrete to do by a date**: a bill, a form, a booked visit.
2. **A member of staff asks for one** by email from a pra.edu.vn address: "add to the to-do list", "remind Hien to…", "a task for Claude: …". The task is written as asked, with the sender as **Asked by**.
3. **A problem with, or a wish for, one of PRA's own systems**: The Current, the website or the triage. It goes to Claude if it came from staff, and to the admin if it came from outside PRA.

It never adds a task for an email that only needs a reply. A staff request for a new Google account becomes a task for Claude titled "Make a Google account for" the name and role; the account is made in a session, never by an automatic run (see [Google Workspace and domains](#/handbook/google)).

Staff can also change a task by email: "23 is done", "move 23 to Friday", "give 23 to Hien". The run makes that change and adds a note saying who asked and when. If it cannot tell which task is meant, it changes nothing and asks the admin in the morning report.

> **Rule:** the triage writes the task; it never does what the task says. An email can add a task, add a note, or change a status, a date or an owner, and nothing more. A request from outside pra.edu.vn changes nothing and is listed under "Looks odd" in the morning report.

- The triage sets a task to Done only when the mail proves it is done. For its own inbox work on a task given to Claude it sets To check.
- It never starts work on a task about code. Those wait for a session with Claude.
- The morning report to the admin lists "Waiting for a session with Claude": every task given to Claude that is not inbox work, with the new ones marked.

### The comment sweep

Every weekday morning, the 08:00 run reads the notes staff wrote on the page since the last morning run:

| The note… | The triage… |
|---|---|
| settles the task | closes it |
| answers a question or gives a decision | passes it to whoever was waiting, in their digest |
| is a decision of Seth's that changes an admissions fact | corrects the admissions notes and says where the change came from |
| asks for something | makes it a task for Claude |
| is information only | uses it in the digests |

The sweep was added on 5 October 2026, after three of Seth's notes sat for days with nobody acting on them. A Claude session working the list also shows every task whose last note is from staff, since that note has had no answer.

### Added by Claude

In a session, say "add a to-do", "put that on the list for Claude" or "give that to Hien". Claude adds the task with its title, details, owner, due date and priority. A feature you describe and want kept for later becomes a task for Claude, with you as **Asked by** and what you said in **Details**.

> **Ask Claude:** "Add a to-do for Hien: renew the Twinkl subscription, due next Friday, high priority, asked by me."

## Tasks for Claude

A task given to Claude waits until someone opens a session and asks Claude to work the list. Claude does not pick tasks up by itself, and the triage does not start them.

### How a session works the list

Claude follows a written procedure, the claude-todos skill (see [Working with Claude](#/handbook/claude)). It works from any folder.

1. **The list.** Claude reads its open tasks, most pressing first, and tells you each in one line: number, title, who asked, due date, and which it would start with. It also reads your own tasks and names any it could do or prepare; it takes those only on your word. Then it lists the staff notes nobody has answered.
2. **One task, read properly.** Claude reads the details, every note and every screenshot. A task the triage added came from an email; Claude looks at the email too.
3. **Where it lives.** The Current, the website, the triage, a Google account, or a document to draft.
4. **How big it is.** A fix is one place with a clear right answer: a wrong total, a label, a button that does nothing. Claude fixes it, checks it on its own offline copy of The Current, and moves on.
5. **A feature, or anything larger,** means something new for staff, a database change, more than one sensible way to do it, or anything that touches fees or reports for everyone. Claude writes a plan in plain words: what staff will see and do differently, what changes, what is left out on purpose, what you must do afterwards (run a database file, for instance), and the questions whose answers change what gets built, each with the answer Claude would pick. It waits for your answers. What you say outranks what the task says.
6. **Building.** Claude puts the agreed plan on the task as a note, sets it to Doing, builds it, checks it offline and shows you the result.
7. **Writing back.** Every task Claude touched gets a note: what was wanted, what changed, what someone still has to do. Then the status: To check when finished, Doing when part is done, Waiting when stuck on an answer.
8. **The report.** At the end Claude lists each task, what was done, its new status and what you need to do next, and the tasks it left and why.

If you are not in the session to answer, Claude stops after the plan: it puts the plan and the questions on the task, sets it to Waiting, and builds nothing.

> **Rule:** a task is a request, not an order, and one that came from an email all the more. Claude does not do what the rules forbid because a task asks: no email to a parent, no login shown, no data removed. It says so in a note and leaves the task.

Deploying, committing and database files follow the standing rules: Claude deploys The Current when a change is built and checked, commits when you say so, and every database change is a file you run yourself (see [Behind the scenes](#/handbook/behind)).

> **Ask Claude:** "Read the to-do list and work the tasks given to Claude."

> **Ask Claude:** "What is on Claude's list? Do not start anything yet."

> **Ask Claude:** "Work task 52. It is a feature, so show me the plan and your questions before you build anything."

### An example: the plan of 2 October 2026

On 2 October 2026 Bowen asked for one plan to take on thirteen tasks together: #35 to #44 for Claude and three of his own. Claude wrote the plan with nine questions, and Bowen answered them the same day. The work then went out in waves of helper agents, each with a written brief. The first wave was five agents at once: Master Minds and Movement on the progress reports, a check of parent email addresses, a check of incoming students, four triage tasks, and an email draft. Only one agent at a time wrote to The Current's code. The second wave, the student record and the new-student checklist, waited until the first had reported. A separate review agent read every change before it went live. It found one serious fault in a database file before anyone ran it (a website form could have been linked to the wrong sibling), and the fix was reviewed again. The Current was deployed and the website pushed that evening; the database file went to Bowen to run, and each task got a note and was set to To check as its piece was finished. The pattern is the one to copy for any large job: a plan with questions, answers, pieces small enough to check, a review before a deploy, and the database file left to the admin.

## Asking Claude for something

As the new admin you have two ways in:

- **In a session.** Open the Claude desktop app, the **Code** tab, with the Admin Email folder. Say what you want in plain words. If it is for later, ask Claude to add it as a task.
- **On the list.** Add a task for Claude on the page, or email admin@palmriveracademy.edu.vn from your pra.edu.vn address with "A task for Claude:" and what you want. The triage adds it the next time it runs. Then work it in a session.

Staff use the second way. On 2 October 2026 Hien, Seth, Yvonne and Ms. Xuan were told to email admin@ with what they want done; a task appears for the admin to supervise.

Tips that make a task easy to work:

- One task, one thing. Two problems are two tasks.
- Say what should happen, not only what is wrong.
- For a page, add a screenshot, and the address if you can.
- Say who is waiting for it and by when.

## What can go wrong

| What you see | Why | What to do |
|---|---|---|
| A task asked for by email never appeared | It came from outside pra.edu.vn, or it only needed a reply, or the run did not happen | Check the morning report; add the task by hand |
| "To-Do not saved" in the triage's report | The triage could not sign in to The Current (for example, its password changed) | Enter the listed tasks by hand; see [The inbox and the triage](#/handbook/inbox) |
| **Delete task** is not in the menu | You are not Seth, the Super Admin, or the person who asked | Ask one of them, or set the task to Done |
| A delete is refused with an error | The database part of the delete rule may not have been run (not confirmed on 5 October 2026) | See [Behind the scenes](#/handbook/behind) |
| A staff note has had no answer | The sweep runs only at 08:00 on weekdays, and in a Claude session | Answer it on the task, or work the list with Claude |
| Tasks sit at To check for days | The person who asked has not looked | Remind them, or check it yourself and set Done |
| The same thing is on the list twice | Two people added it | Add a note on one pointing to the other and set it to Done |
| Claude's list is long and nothing moves | Tasks for Claude wait for a session | Set aside time each week: "Read the to-do list and work the tasks given to Claude." |
