Almost everything in this handbook was built, and is still run, by Bowen working with Claude. This chapter says what Claude is at PRA, how a working session goes, how to ask for things, and what Claude may do on its own and what always waits for you. Read it before your first session, and again whenever Claude does something you did not expect.

## What Claude is here

- Claude is an AI assistant made by Anthropic. At PRA it runs in the **Claude** desktop app on the admin laptop, in the **Code** tab, on a Claude Pro plan.
- In a session it reads and changes files on the laptop: The Current's code, the website's code, the triage scripts, the photo library, the database update files. It runs commands, starts offline copies of The Current and the website to test a change, and drives a browser pane inside the app.
- It reads the admin@ inbox and saves drafts there through the Gmail connector. It never presses Send on mail to anyone outside PRA.
- It is not a person. It has no login of its own to The Current, the Supabase dashboard or the Google Admin console, and it cannot type a password. Where a screen needs one, you sign in and Claude carries on, or you do that step.
- It does nothing between sessions, with one exception: the triage routines, which run in Anthropic's cloud on a timetable (see [The cloud routines](#/handbook/claude?s=the-cloud-routines) below).
- It forgets the conversation when a session ends. What carries over is its memory folder, its skills and the files it wrote.

## The setup on the laptop

### The session folder

Every session starts in one folder: `C:\Users\sbowe\Desktop\Admin Email`.

1. Open the **Claude** app and go to the **Code** tab.
2. Start a new session and pick `C:\Users\sbowe\Desktop\Admin Email` in the folder picker. Do not pick an older entry whose path goes through `OneDrive`: it is the same folder under an old name, and file links in Claude's replies break.
3. Type what you want in the message box.

Why this folder and no other:

- Claude's memory for PRA is filed under this folder's name. A session started anywhere else does not load it unless told to read it.
- `.claude\launch.json` in this folder holds the launch configs for the offline copies (below).
- `.claude\agents\` in this folder holds the two PRA helper agents (see [Agents and big jobs](#/handbook/claude?s=agents-and-big-jobs)).
- It holds the working documents: plans, database files handed over, the To-Do plan output, the guide for Ms. Xuan, the newsletter set-up notes, the handbook's source notes.
- It holds a login file for the triage scripts. Claude never opens, prints or copies it, and nor should you.

The folder is not a git repository. Nothing in it is published.

### The repositories

The code lives in three repositories on the laptop, each with a copy on GitHub.

| What | Folder on the laptop | On GitHub | How a change goes live |
|---|---|---|---|
| The Current | `C:\Users\sbowe\admin` | BowenPRA/admin (public) | `npm run deploy` in that folder; live about two minutes later |
| The website | `C:\Users\sbowe\pra-website` | BowenPRA/website (public) | a push to `main`; GitHub builds and publishes it |
| The triage | `C:\Users\sbowe\pra-triage` | BowenPRA/triage (private) | a push to `main`; the next cloud run uses it |

A fourth, small repository, `C:\Users\sbowe\pra-redirect`, sends the old palmriveracademy.edu.vn addresses to pra.edu.vn through Netlify. It rarely changes. [Behind the scenes](#/handbook/behind) and [Google Workspace and domains](#/handbook/google) have the detail.

Other folders Claude works in:

- the photo library, `C:\Users\sbowe\PRA Photos` (see [the photos chapter](#/handbook/photos))
- the folder export, `C:\Users\sbowe\Desktop\PRA Admin`, synced to Google Drive
- Bowen's teaching material, `C:\Users\sbowe\lessons`, and the Year 7 assessment papers, `C:\Users\sbowe\Desktop\Y7Tests`
- Google Drive for desktop, which is the `G:` drive

### Memory

Claude keeps notes between sessions in this folder:

```
C:\Users\sbowe\.claude\projects\C--Users-sbowe-Desktop-Admin-Email\memory\
```

- `MEMORY.md` is the index: one line per note, with a short summary. Claude reads it at the start of every session opened in the Admin Email folder.
- Notes whose names start `feedback-` are rules Bowen gave, each with the reason and how to apply it. Claude follows them every time.
- Notes starting `pra-` hold the state of a project: what was built, what is live, what is still "on Bowen". Claude reads the ones that bear on the task.
- Notes starting `user-` are facts about the person Claude works for. Today there is one: Bowen has no OneDrive.
- The newest notes, of 16 October 2026, are the website clean-up (events split by academic year, the Student Blog), the Quarter 1 Showcase event and the Newsletter tab. Each says what was done, which commit holds it, and what still waits.
- Older notes from September 2026 are in a sister folder whose name contains `OneDrive` (fee rules, report wording, the database move). Claude reads them for larger work in The Current.
- The triage keeps its own memory in the `docs\` folder of its repository.

To add a rule, say it: "Remember that the newsletter goes out on Fridays at 16:30." Claude writes a note and adds a line to the index. To correct one: "Your memory says the menu list is not synced. It was synced on 15 October. Fix the note."

> **Careful:** a note is only as true as the day it was written, and an index line can lag behind its note. On 16 October 2026 the index still said the menu mailing list waited for the meals answers; the note itself said it had been synced on 15 October. Before acting on an old note, ask Claude to check it against the live system.

The rules notes, as of 16 October 2026:

| Note | The rule in one line |
|---|---|
| `feedback-never-a-school` | PRA is a language center, in English and in Vietnamese <!-- allow -->
| `feedback-one-page-reports` | A progress report is one A4 page; never lower a character limit |
| `feedback-plain-copy` | Say it once, plainly; no closing flourish |
| `feedback-vietnamese-natural` | Vietnamese as a front-desk colleague would say it; staff read it before it goes live |
| `feedback-website-program-copy` | What the website may and may not say about programs |
| `feedback-report-comments` | How Bowen's own report comments are written |
| `feedback-reviews-means-assessments` | "Reviews" means the assessment papers; ask when a request is unclear <!-- allow -->
| `feedback-powershell-commands` | A command for you is one line for Windows PowerShell 5.1, with full paths |
| `feedback-full-path-links` | Every file path outside the Admin Email folder is written in full from `C:/Users/sbowe/` |

[Rules and wording](#/handbook/rules) has the full rules.

### Connectors and the browser pane

- **Gmail connector.** Connected as admin@palmriveracademy.edu.vn, the office inbox. Claude reads threads, labels them and saves drafts. The connector rewrites every web address it saves into a Google redirect, and it cannot carry pictures: you drag a picture into the draft yourself. See [the inbox chapter](#/handbook/inbox).
- **Browser pane.** The browser inside the Claude app, signed in as admin@ for Google Drive, Gmail and the Google Admin console. When that sign-in expires, Claude asks and you sign in again. Claude does not sign in to your own Chrome.
- **The live Current.** Claude cannot sign in to https://current.pra.edu.vn. For a live screen, sign in yourself in the browser pane and Claude reads it, or take a screenshot (Win+Shift+S) and paste it into the chat.

### Offline copies for testing

- The launch configs in `.claude\launch.json` start a copy of The Current on the laptop in **Offline mode**. An amber band says so, the data lives only in that browser, and nothing reaches the real database. `admin-offline` uses port 5178; `admin-offline-2` to `admin-offline-5` are spares for when two sessions test at once; `admin-newsletter` is set up for the Newsletter tab.
- `pra-site` (port 8087) and its numbered spares serve the website from the laptop copy. `pra-photos` (port 8121) serves the photo library's review pages.
- Claude starts these itself. They show in the app's preview pane, where you can click around too. Offline mode is for trying things, never for real records.

## A normal session

1. **Open** the Admin Email folder in the Code tab, as above.
2. **Say what you want** in a plain sentence. Paste a screenshot when it shows the problem better than words.
3. **Claude looks around.** It reads its memory, the code, the live site or the inbox. When your sentence could mean two things, it asks one question.
4. **Claude shows a plan or a preview** for anything bigger than a small fix: what it will change, what it needs from you, what could go wrong. Then it waits.
5. **You answer.** "Yes", "yes, build it", "go with your ideas", or a correction.
6. **Claude builds** in the laptop copy of the code.
7. **Claude tests**: in the offline copy of The Current, in a preview of the website, with a PDF filled to its character limits, or with a dry run of a script. It says what it checked.
8. **If the database must change**, Claude writes an SQL file and asks you to run it (see [The handoff order](#/handbook/claude?s=the-handoff-order)). You reply "ran the sql".
9. **Claude deploys The Current** without asking. That is Bowen's standing rule. It then checks that the live site shows the new build. If the app's permission check blocks the deploy, Claude gives you the one-line command to run.
10. **Claude waits for your word to commit and push.** "Commit and push" is enough.
11. **Claude ends with a short report**: what changed, what was checked, and what is still on you.

### What "still on you" means

Most sessions end with a short list of things only you can do. Typical items:

- an SQL file to paste into Supabase
- a website push, once staff have read the new Vietnamese
- a click in the Google Admin console that Claude's permission check refused
- a decision ("BCC Hien on invoice emails or not?")
- a password to type

Claude writes the list into its memory too, so the next session starts from it. Do the items, then tell Claude they are done, so the memory stays true. Items nobody closes end up in [Known problems and open items](#/handbook/open).

### The handoff order

For The Current the order is always:

1. **SQL (you).** Claude writes a dated file in `C:\Users\sbowe\admin\supabase\`, made to be safe to run twice. In Supabase open **SQL Editor** → **New query**, paste the whole file, click **Run**. Tell Claude "ran the sql".
2. **Deploy (Claude).** It runs the deploy and checks the live site.
3. **Commit and push (on your word).**

The other systems:

- **The website**: a push is the deploy, so it waits for your word. New Vietnamese waits for a staff read as well.
- **The triage**: a push changes what the next cloud run does.
- **Google accounts**: Claude prepares each change, shows it, and acts on your yes for that one account.

The Current usually copes with a deploy that comes before the SQL: the new feature stays off and a message names the file to run.

If Claude is not at hand, the deploy is one line in PowerShell:

```
npm --prefix C:/Users/sbowe/admin run deploy
```

> **Ask Claude:** "I ran the sql. Deploy The Current, check the live site, then commit and push."

## How to ask

Bowen's requests are short, often one line with no capitals. A plain sentence is enough: Claude reads around and asks if it needs more. Correcting Claude is normal. Say what is wrong in one line ("No, I asked for the assessment papers, not the practice packets") and it redoes the work.

These are the kinds of sentences Bowen types, adapted so you can use them as they are.

### The Current

- "I ran the sql. Deploy it and commit."
- "On The Current, I want an easy mark on the student list for who gets meals."
- "A teacher can't sign in to The Current. Help me reset her password."

### The website

- "Look at pra.edu.vn and list any errors or small things to fix. Show me the list before you change anything."
- "Add this flyer to the Halloween notice on the website." (with the picture pasted in)
- "Staff say the Vietnamese on the admissions page is awkward. Make it natural, and don't push until they have read it."

### Progress reports

- "Give me a summary of who has finished their report comments and who still has comments to write."
- "Write drafts to the teachers saying comments are open, with the link to The Current."
- "Here are my notes on a student for Science. Turn them into a comment close to 750 characters."

### Invoices

- "Hien says this invoice is missing the sibling discount. Here's a screenshot. Find out why."
- "Compare the invoice email default with the fee announcements we sent last quarter, and make it match."

### Photos and Facebook

- "The Halloween photos are on the shared drive. Make an album."
- "What should we put on Facebook about the Showcase?"

### The inbox

- "Our email triage didn't run this morning because of usage. Can you run it now?"
- "Run the inbox clean up."

### Google accounts

- "Make Google accounts for the two new Year 4 students. Show me the dry run first."

### The to-do list

- "Read the to-do list." or "How's my to-do list looking?"
- "Check our sent messages and see which to-dos are finished."

### This handbook

- "The attendance chapter of the handbook no longer matches the Attendance page. Fix it and deploy."

### Big jobs

- "Give me a prompt for a new chat to go through all the event photos and build the events page."

Short replies work as well: "yes", "yes, build it", "do what you think is best", "signed in" (after Claude asks you to sign in to a site in the browser pane), or a screenshot with "what does this mean?".

## Skills

A skill is a written procedure Claude follows for one kind of job. You use one by describing the job ("make an album from these photos") or by typing its name after a slash, for example `/photo-album`. Claude picks the right skill itself when the job matches.

### The skills on the laptop

These are in `C:\Users\sbowe\.claude\skills\` and work from any folder.

| Skill | What it does | What to say |
|---|---|---|
| claude-todos | Works the To-Do tab: lists the tasks given to Claude and staff comments nobody has answered, fixes the small ones, plans the larger ones with you, builds after your answers, writes back on each task | "Read the to-do list", "work Claude's to-dos", or a task number |
| inbox-cleanup | Tidies admin@ with you: lists groups of old Claude drafts and finished threads with counts and examples, then acts only on the groups you say yes to. It archives and moves Claude's own drafts to Trash; it never deletes for good | "Run the inbox clean up" |
| photo-album | Turns a folder of event photos into a chosen, edited album in the photo library, with a review page for your decisions | "Make an album from these photos" |
| photo-search | Finds photos in the library by what is in them; for anything public, only photos signed off against the no-photo list | "Find me a photo of ..." |
| social-post | Prepares a Facebook post: photos chosen and cropped, a caption of 50 to 90 words, alt text, a suggested time. A person publishes it | "What should we put on Facebook about ...?" |

[The To-Do tab](#/handbook/todo) and [the photos chapter](#/handbook/photos) say more about how these jobs run.

### The triage skills

The triage repository has its own skills in `C:\Users\sbowe\pra-triage\.claude\skills\`: early-check, morning-update, inbox-sort, day-recap and evening-check, plus copies of claude-todos and inbox-cleanup. The cloud routines run the first five. You can run any of them in a session by name, for example the morning update when a cloud run was missed.

### Retired skills

Three account-level skills from the time the triage ran in Cowork (an earlier Claude product) still appear in the app: inbox-triage-daily, inbox-status-check and team-todo-resolver. They write to spreadsheets PRA no longer uses. Ignore them. Turning them off is on the open list. If Claude reaches for one, say "use the morning-update skill from the triage repository instead". An account skill called "morning" makes a personal morning brief and has nothing to do with the triage's morning update.

## Agents and big jobs

### Helper agents

In a big job Claude can hand parts of the work to helper agents: other Claude instances that work at the same time, each on one written brief, and report back. You do not start them; the session does.

- Two are written for PRA, in `.claude\agents\` of the Admin Email folder. **pra-opus-high** runs Opus at high effort, for checks, drafts and smaller builds. **pra-opus-xhigh** runs Opus at extra-high effort, for builds in The Current that touch attendance, fees or reports for everyone; it reads the code before changing it and proves each change in the offline copy.
- Their standing rules outrank any brief: never commit, push or deploy; never run SQL on the live database; never send, delete or archive mail; never write to the To-Do tab; never print a login; parent and student details stay in the folder the brief names; stop and say what is in the way when the brief cannot be done as written.
- Each ends with a report: every file it changed, what it could not do, what you must do next. The coordinating session checks their work, often with a separate read-only reviewer, before anything is deployed.
- A session only sees the agent definitions that existed when it started.
- Claude also uses general helpers to search and read, which keeps the main session focused. Cheaper, faster helpers suit bulk work such as sorting photos or a bug sweep.

### Plan, then build

For anything larger than a fix:

1. The request arrives on the To-Do tab or in chat.
2. Claude writes a plan in plain words: what it will change, its own answer to each open question, the questions for you, what can go wrong, and what you must prepare first.
3. You answer. "Go with your ideas" is a fair answer to the questions you have no view on.
4. The agreed plan is saved on the task, and the build begins, sometimes in waves of agents.
5. Tests, a review, then the handoff order above.

The example is `todo-plan-2026-10-02.md` in the Admin Email folder. On 2 October 2026 it took thirteen To-Do tasks, grouped them into three waves of agents, asked Bowen nine questions, and named ten minutes of preparation for him first (commit the code, export the student list). He answered the same day. Wave 1 was five agents at once; wave 2 waited for two of them; wave 3 was a review, his SQL and the deploy.

### A prompt for a fresh chat

A long job often starts with "give me a prompt for a new chat to ...". Claude writes a complete brief, you open a new session and paste it in. The new session starts clean, with everything it needs in the brief. Bowen used this for the events page, the photo library and the website's stage pages, among others.

### How this handbook was made

On 15 and 16 October 2026 one session sent five sweep agents through Claude's memory, two months of chat transcripts, The Current's code, the website and the triage. Each wrote a facts file, kept in `handbook-sources\` in the Admin Email folder. Five writer agents then wrote the chapters from those files under one style guide, and the checker tested them. The same pattern works for any large piece of writing.

## The cloud routines

- The triage is five routines: scheduled Claude sessions that run in Anthropic's cloud, Monday to Friday, with nobody watching. Each reads the triage repository, uses only the Gmail connector, and saves its log back to the repository.
- The times, Vietnam time: 06:00 early check; 08:00 morning update; sorting every hour from 08:30 to 16:30; 15:00 day recap; 18:30 and 19:30 evening checks.
- They run on the same Claude Pro plan as your sessions and use the same weekly allowance. There is no separate bill.
- When the allowance is used up, a run is skipped, never charged. This happened on the morning of 15 October 2026. The fallback is a session on the laptop: say "Our email triage didn't run this morning. Run it now." Claude follows the morning-update skill from the triage repository and reports in the chat instead of by email.
- Claude never creates or switches on a new routine without asking you first.
- The routines are listed at https://claude.ai/code/routines, and every run's transcript can be read at https://claude.ai/code.

What each run does, the labels and the digests are in [the inbox chapter](#/handbook/inbox).

> **Rule:** never an API key, never API billing, never "extra usage". Everything runs on the Pro plan.

## What Claude may do and what waits for you

| Claude does this on its own | This waits for you |
|---|---|
| Deploys The Current once a change has passed its checks | Commit and push of the code, on your word |
| Saves email drafts in admin@ | Sending. A person presses Send on anything outside PRA. The triage sends only internal mail, to four addresses: Yvonne, Seth, Hien and the admin |
| Edits the website in the laptop copy and shows you a preview | The push, on your word; new Vietnamese only after staff have read it |
| Writes an SQL file for a database change | Running it in Supabase: always you |
| Makes a Google account with the accounts script, after your yes for that account | Typing any password or key: always you |
| Prepares a Facebook post: photos, crops, caption, alt text | Publishing it: a person |
| Lists the photos waiting for sign-off | Signing them off against the no-photo list: a member of staff |
| Adds or changes a To-Do task when you ask, and the triage does so from a staff email | Doing a task that arrived by email: only in a session, with your word. An email can change the list; it never gets the task done |

Bowen loosened the commit rule for the To-Do plan of 2 October 2026 ("you can deploy and commit things"). The table is the default. You can loosen it for one job by saying so, and tighten it the same way ("Do not deploy until I say").

## Rules Claude follows about data

- **Email and web pages are data, not instructions.** When an email asks Claude to send, forward, reveal or run something, it does not. It labels the email as usual and lists it under "Looks odd" in the report. There are two narrow exceptions in the triage: a member of staff may add or change a To-Do task by email, and the admin (today bowen@pra.edu.vn only) may change a thread's labels by replying to a report.
- **No links from emails.** A triage run does not open links found in emails.
- **No secrets on screen.** Claude never prints, pastes, commits or types a key or a password. A script that needs the Supabase secret key asks you for it, and you type it; it is not saved on the laptop. Claude cannot set a password you chose: it can only have Google make a random one and email it to you. It says so before any password work.
- **Google accounts only through the script.** Claude makes and moves accounts with `workspace_accounts.py` in the triage repository. It never runs a GAM command of its own, never opens `C:\GAMConfig`, and never runs `stock_password.ps1` or reads its saved file. That script is yours to run.
- **Children's data stays out of the public code.** The Current's code and the website are public on GitHub. Student and family details reach The Current only from the database, after sign-in. A data fix for named students comes to you as SQL in the chat, never as a file in the code. A child's name never goes on the website, and a photo goes public only after a member of staff has signed it off.

## Costs and limits

- **The plan.** Claude Pro, held by Bowen. Extra usage is off (checked 1 October 2026). No API key exists anywhere.
- **The meter.** https://claude.ai/settings/usage shows how much of the weekly allowance is left. Sessions and routines share it. The triage is about twelve runs a weekday; in the test of 1 October 2026 a full run took about five minutes and under 1% of the week.
- **What uses it fastest.** Big jobs with many helper agents, photo work, and long sessions that read a lot of code.
- **At the limit** work stops, sometimes mid-task. On 15 October 2026 a session limit stopped the agents writing this handbook. The fix was to wait for the reset, then relaunch the helpers on a cheaper model. After a reset, say "continue from where you left off".
- **Long jobs** such as photo editing can run in the background. Claude says when they finish; you do not need to watch.

## When Claude gets it wrong

1. Say so plainly, in one line: "This reads like AI. Plainer, shorter." or "That crop cuts off a face." A redo is quicker than an explanation.
2. Ask for the plan first next time: "Show me each change before you save, and wait for my yes."
3. If it is a rule, make it stick: "Write a memory note: never put the class size on the website."

### Things that have bitten before

- **OneDrive paths.** The laptop once had OneDrive. Claude kept writing paths through it and links in the chat broke (28 September to 5 October 2026). Every path is now written in full from `C:/Users/sbowe/`, and sessions open in the real Admin Email folder.
- **PowerShell syntax.** Your terminal is Windows PowerShell 5.1, which does not understand `&&`. Bowen pasted that error five times in September 2026. A command for you is one line with full paths, for example `git -C C:/Users/sbowe/pra-website push`.
- **A deploy carries other work.** `npm run deploy` publishes everything in the admin folder, committed or not. If another session has unfinished work there, a deploy publishes that too. Claude checks first. On 16 October 2026 the Student Blog rename waited because the handbook's unfinished files were in the same folder.
- **Offline mode on the live site.** A deploy made without the `.env` file gave a live Current with no database, showing "Offline mode" (14 September 2026). The deploy must run on the laptop that has `.env`.
- **Two chats in one repository.** Two sessions changing the same code overwrite each other. Claude runs `git status` first and asks before touching files it did not change.
- **Google Admin saves.** Claude's permission check sometimes refuses a Save in the Google Admin console, or a label change in Gmail (9 October 2026). Claude prepares the change and shows it; you click Save.
- **A feature is not live until its SQL has run.** The receipt upload failed on 24 September 2026 for that reason.
- **GitHub Pages is slow.** A page can look unchanged or broken for a minute or two after a push or a deploy. Wait, then hard-refresh with Ctrl+F5.
- **Two readings of one request.** "Reviews" meant the assessment papers, not the practice packets (1 October 2026). Claude now asks one question when a request could mean two things.

## Taking over from Bowen

When the admin role changes hands, these must change too. Work through the list with Claude, one line at a time. [Start here](#/handbook/start-here) has the wider handover: people, the first week, the five rules.

### Accounts

- [ ] **Claude.** Your own Claude Pro plan, signed in to the desktop app on the admin laptop. The routines and the "PRA triage" cloud environment belong to Bowen's Claude account: recreate them under yours (the triage repository's `PLAN.md` and `routine\` folder hold the prompts and settings), connect GitHub at https://claude.ai/code, and connect Gmail as admin@palmriveracademy.edu.vn.
- [ ] **GitHub.** The account BowenPRA holds all four repositories. Take over the account, or have the repositories moved to one you hold. Sign in the `gh` command-line tool on the laptop.
- [ ] **Netlify.** The redirect for the old domain sits in a team under bowen@pra.edu.vn.
- [ ] **Cloudflare.** The website's visitor numbers, in an account under admin@palmriveracademy.edu.vn. Whoever holds the admin@ mailbox can sign in.
- [ ] **Supabase.** The project belongs to admin@palmriveracademy.edu.vn. You need that sign-in and the secret key, which is typed into scripts and never saved.
- [ ] **Google Workspace.** admin@palmriveracademy.edu.vn is the only super admin. Make a second one, your own account.
- [ ] **The Current.** Give your account the super admin role (`scripts/create-staff-accounts.mjs`, run with the secret key), and keep a second super admin so no one person is the only one.
- [ ] **Facebook.** Bowen is not the Page manager; the Meta app "The Current" is his. Get added to the app.
- [ ] **P.A Vietnam and Wix.** Who signs in to these is not written down. Find out before the Wix renewal on 12 February 2027.

### The code and the documents

- [ ] **The Current, `src/data/staff.js`, `OFFICE_ACCOUNTS`.** Add yourself. This list decides who can own a lead and who appears in the To-Do pickers.
- [ ] **The Current, `src/lib/AuthContext.jsx`, `ADMIN_EMAILS`.** A fallback that makes one address super admin. Today it is Bowen's personal Gmail. Replace it or remove it.
- [ ] **The triage, `CLAUDE.md`.** The four internal addresses the triage may send to (bowen@ is one), and the label-change exception ("from bowen@pra.edu.vn only"). `docs/handling.md` repeats that exception.
- [ ] **The triage skills.** The morning report goes to bowen@, the day recap copies bowen@, the early check writes to Seth and Bowen.
- [ ] **The triage scripts.** `the_current_leads.py` and `the_current_todos.py` map the name "bowen" to his address; `workspace_accounts.py` sends Google's sign-in emails to bowen@. `docs/workspace-accounts.md` says the same.
- [ ] **Parent Google Groups.** admin@ and bowen@ are the owners.
- [ ] **The Teachers page.** Bowen's own teacher rows (he teaches Year 7).
- [ ] **This handbook.** Every place that says "Bowen" where it means "the admin".

### The laptop

- [ ] **The laptop itself**, with the four repositories, GAM (`C:\GAM7`, its settings in `C:\GAMConfig`, signed in as admin@), the `.env` file in `C:\Users\sbowe\admin`, and the triage login file in the Admin Email folder. These never travel by email or inside the code.
- [ ] **Paths.** The skills, the agents, the launch configs and the memory notes name `C:\Users\sbowe\` in full. The simplest handover keeps the laptop and its Windows user as they are. On a new user or a new laptop, every one of those paths needs changing.
- [ ] **The stock password file** made by `stock_password.ps1` is tied to Bowen's Windows user and does not move. Run the script again as yourself.
- [ ] **Claude's memory and skills** are in `C:\Users\sbowe\.claude\`. They travel with the laptop's user profile. On a new profile, copy that folder and open the Admin Email folder at the same path, or the memory does not load.

> **Ask Claude:** "I am taking over from Bowen. Go through the handover list in the Working with Claude chapter and tell me, item by item, what is done and what is still to do."
