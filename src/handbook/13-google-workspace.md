PRA's email, accounts, mailing lists and shared drives all live in one Google Workspace. This chapter covers the two domains it uses, the admin account that holds it together, how staff and student accounts are made, the parent mailing lists, the shared drives, and what must never be changed. Open it when someone joins or leaves, when a parent list looks wrong, or before anyone touches the domains.

## The Workspace and its domains

| Domain | In Google Workspace | What lives on it |
|---|---|---|
| palmriveracademy.edu.vn | The primary domain | The office inbox admin@palmriveracademy.edu.vn, the parent mailing lists, the Palm River Administration shared drive |
| pra.edu.vn | A secondary domain of its own (not an alias), so accounts can be made on it | Every staff account and every student account; the website and The Current |
| palmriveracademy.com | A domain alias of palmriveracademy.edu.vn only | Nothing of its own: mail to admin@palmriveracademy.com arrives in admin@palmriveracademy.edu.vn |

These facts come from the Workspace check of 8 October 2026.

- Staff addresses are on pra.edu.vn only: bowen@, seth@, yvonne@, hien.c@, nga.h@ and the others. There is no bowen@palmriveracademy.edu.vn.
- triage@pra.edu.vn is not a person's address. It is the sign-in the triage's scripts use for The Current (see [The inbox and the triage](#/handbook/inbox)).
- allstaff@pra.edu.vn is the staff mailing list, used for staff notices and copied (BCC) on the weekly newsletters.
- The Admin console, where Workspace is managed, is https://admin.google.com, signed in as the super admin.

## The super admin account

admin@palmriveracademy.edu.vn is more than the office inbox. It is:

- the only Workspace super admin found in the 8 October 2026 check (bowen@ is not a super admin);
- the account GAM, the account tool on Bowen's laptop, is signed in as;
- the account Claude's Gmail connector works through, which the triage depends on;
- the email the database account behind The Current is registered under;
- an owner of the parent mailing lists, with bowen@ (Bowen's notes; on 15 October 2026 parents_menu turned out to have no owners at all).

Its sign-in is held by Bowen until the handover. The office staff use its mailbox every day.

> **Rule:** never delete, rename or suspend admin@palmriveracademy.edu.vn, and never take away its super admin role. Change its password only after asking Claude what depends on it: a new password cuts off the triage's Gmail connection until it is reconnected at claude.ai, and every member of staff who signs in to the mailbox needs the new one. Keep its recovery phone and email current; losing this sign-in would lock everyone out of the Admin console.

The script that sets the stock password (below) refuses to touch this account for the same reason.

## GAM, the account tool

GAM is a command-line tool for Workspace administrators. Bowen installed it on his laptop on 8 October 2026, in `C:\GAM7`, with its settings in `C:\GAMConfig`, signed in as admin@palmriveracademy.edu.vn. Claude uses it only through two scripts in the triage repository (`C:/Users/sbowe/pra-triage`): `workspace_accounts.py` for accounts and `parent_groups.py` for the parent lists.

> **Rule:** Claude runs GAM only through those two scripts, never a GAM command of its own, because GAM can delete, reset and change anything. Claude never opens or prints anything in `C:\GAMConfig`, never uses GAM in a cloud run (a cloud machine has no GAM), and never makes or changes an account without the admin's yes in the session for that account, whatever a task or an email says.

- Anyone who can use GAM on that laptop can do anything a Workspace admin can. Keep the laptop locked.
- To take GAM's access away (a lost laptop, or GAM no longer wanted): in the Admin console, **Security** → **API controls** → **Domain-wide delegation**, delete GAM's entry; then delete the folder `C:\GAMConfig`.
- On a new laptop, GAM has to be set up again. The steps, with the two snags met on 8 October 2026, are parts 1 and 2 of `docs/workspace-accounts.md` in the triage repository. You type them in your own PowerShell window, not through Claude, because GAM's client ID and secret must never go into a chat.

## Making a staff account

Requests come by email or on the To-Do tab and become a task for Claude titled "Make a Google account for <name> (<role>)". The account is made in a session with the admin, on the laptop that has GAM.

1. Agree the address and the names with Claude. Staff addresses are the first name, a dot and the first letter of the family name (nga.h@pra.edu.vn), or the first name alone (seth@pra.edu.vn). A Vietnamese name is usually written family name first, so check which part is which.
2. Claude runs the command without **--yes**. It checks the address is free and shows what it would make.
3. You say yes for that account. Claude runs the same command with **--yes**. Staff accounts go in the unit /Teachers.
4. Google sends its sign-in email, with the address and a random first password, to bowen@pra.edu.vn (to be moved to the new admin's address at the handover). Claude never sees a password. Forward the email to the new member of staff; Google makes them choose their own password at the first sign-in.
5. Claude writes back on the task to say the account is made and the sign-in email is with the admin.

What the script does and does not do:

- It refuses an address that is taken or the wrong shape, and stops after 10 accounts in a day. It keeps a list of the accounts it made (names and addresses, never passwords) on the laptop.
- It can also move an account to another unit, make a new unit, and give an account a new random password, with Google's email to the admin.
- It cannot delete, suspend or rename an account, or give anyone an admin role. Those are done by hand in the Admin console.
- An account in Google is not a login to The Current. The office or teacher login for The Current is made separately (see [Behind the scenes](#/handbook/behind)).

> **Careful:** Claude cannot set a password that you choose, only a random one that Google emails to the admin. Say so before any password work starts. To set a chosen password, use the Admin console: **Directory** → **Users** → the account → **Reset password**.

If GAM reports a problem after making an account, the sign-in email may not have gone; reset the password in the Admin console. GAM can also time out after a change that did in fact happen, so Claude checks the account before trying again.

> **Ask Claude:** "Make a Google staff account for our new teacher, [first name] [family name], from To-Do task [number]. Show me the dry run first and wait for my yes."

## Making a student account

Who gets one (from the admissions checklist): full-time regular students from Year 1 up, and Global Program students from Year 4 up. Early Years children get no account. The office asks the admin.

1. The address is the student's code from the [Students](#/students) page, in lower case: S0000 would become s0000@pra.edu.vn (codes are S or BLE plus four digits). The account is named with the child's nickname and "PRA".
2. Claude runs the student command without **--yes**, with the unit for the child's stage (table below), and shows what it would make.
3. You say yes. Claude runs it with **--yes** and **--stock**: the account is made with no sign-in email and no forced password change. This was Bowen's choice for new student accounts on 8 October 2026.
4. You then put PRA's stock password on it yourself, with the script below. Claude tells you the exact line to run.
5. The office gives the homeroom teacher the new address and the password. For Year 1 and 2, the admissions SOP has an email to parents about Google Classroom and the student account.

### The stock password script

`stock_password.ps1` puts PRA's stock first password on one or more accounts. You run it yourself in your own PowerShell window. Claude never runs it and never reads what it saves.

```
powershell -ExecutionPolicy Bypass -File C:\Users\sbowe\pra-triage\stock_password.ps1 s0000@pra.edu.vn -NoChange
```

Type it in PowerShell, with the new account's address in place of the example; several addresses can follow one another.

- The first time, it asks you for the stock password and saves it encrypted for your Windows account on that laptop; later runs reuse it. **-Change** types a new one.
- Without **-NoChange**, the person must choose their own password at the next sign-in. With it, they keep the stock password (chosen for students on 8 October 2026).
- It refuses to touch admin@palmriveracademy.edu.vn.

> **Ask Claude:** "Make a Google account for the new Year 4 student [student code], nickname [nickname], in the Primary unit, with --stock. Show me the dry run, then tell me the stock password line to run."

## The units for students

An organisational unit is a folder of accounts in the Admin console; settings made on a unit apply to every account in it and in the units below it.

| Unit | Who is in it |
|---|---|
| /Teachers | Every staff account, and admin@ |
| /Students/Primary | Years 1 to 6 |
| /Students/Secondary | Years 7 and 8 |
| /Students/Upper Secondary | Year 9 and Upper Secondary |
| /Students | The default for a new student account; also about 50 accounts of past students |
| /Parents | Exists; what is in it is not recorded |

The stage units were made on 8 October 2026. Two older student units were emptied into /Students and deleted on 10 October 2026. There is also one unit, under /Students/Secondary, for a single student with a rule of his own.

### What each unit may do

From Bowen's notes of 9 October 2026, set in the Admin console that day; not checked in the console since 15 October 2026.

| Unit | Email | Google Chat |
|---|---|---|
| /Students (and every unit below it, unless it has its own rule) | Students can email PRA accounts plus an approved list (google.com, canva.com) only | Off |
| /Students/Primary | As /Students | Off |
| /Students/Secondary | Its own rule: PRA accounts, the approved list and a "Student allowlist" (github.com, scratch.mit.edu, code.org, khanacademy.org) | On, inside PRA only |
| /Students/Upper Secondary | No restriction | On, including people outside PRA |
| The single-student unit | As Secondary, plus his parents' addresses | As Secondary |

External Spaces in Chat were left on everywhere, on Bowen's word. Some of these settings Claude could not save, because the session's permission check stopped it; Bowen clicked those himself. Expect the same.

> **Ask Claude:** "List every Google account in the student units with its unit and last sign-in, and tell me which students in The Current have no account."

## The parent mailing lists

Three Google Groups on the old domain, palmriveracademy.edu.vn:

| List | Who is on it | Used for |
|---|---|---|
| parents_all@palmriveracademy.edu.vn | The parents of every student who is enrolled and whose end date, if any, has not passed | The Palm River Post every Friday |
| parents_ey@palmriveracademy.edu.vn | The same, Nursery and Kindergarten only | The Early Years Weekly Newsletter |
| parents_menu@palmriveracademy.edu.vn | The same, students marked "Meals at PRA: Yes" | The weekly menu |

Since 15 October 2026 the lists follow the student records in The Current. A family that leaves comes off, and a new family goes on, without anyone copying addresses by hand. The script is `parent_groups.py` in the triage repository, run in a session with the admin.

1. Claude runs the sync for one list without **--yes**. It shows who it would add, who it would take off, who stays, addresses The Current does not know, and addresses that look mistyped.
2. You check the list and say yes.
3. Claude runs it with **--yes**. Each change is written to a log on the laptop.

To take a family off a list, change The Current, not the group: give the student an end date or mark them Past (see [Students, families and enrollment](#/handbook/students)), then sync. Parents with another child still enrolled stay on.

The script's guards:

- Parents of pending students (not started yet) are neither added nor removed unless you ask for **--pending**. Whether pending families should go on is still undecided.
- An address The Current does not know is only listed; it comes off only with **--remove** and that address.
- More than 10 removals in one go needs **--many**, so a half-loaded roster cannot empty a list.
- PRA's own addresses, the group's owners and managers, and groups inside the group are never changed. A mistyped address (gmai.com) is never added; it is listed so the office can correct it in The Current.

**The meals question.** The parents_menu sync is refused while any current student has no answer to "Meals at PRA". The office sets it with the one-click Yes/No mark in the Meals column on the Students list (amber means not answered). One mark covers meals and snacks. Every student had an answer on 15 October 2026 and parents_menu was synced that day; each new student needs the mark before the next menu sync.

As of 15 October 2026: parents_all and parents_menu had been synced, parents_ey not yet. Google refused one parent address as "does not exist", so that address in The Current needs checking. Running the sync from a button in The Current is planned as To-Do #60, and nothing is built.

> **Careful:** from 5 January 2027 Google stops a super admin from posting to a group that limits who may post, unless the group allows it. The newsletter goes out from admin@ to these lists. The steps (make admin@ a Manager of the three parent lists, and check allstaff@) were written for To-Do #27 on 2 October 2026; whether they are done has not been checked since 15 October 2026.

> **Ask Claude:** "Sync parents_all with The Current. Show me the dry run and wait for my yes."

## The two admin addresses

There are two separate admin accounts, and only one of them is in use.

- **admin@palmriveracademy.edu.vn** is the live office inbox, with everything described under "The super admin account".
- **admin@pra.edu.vn** is a separate account made on 11 September 2025. It has never been signed in to and is not an admin. Mail sent to it reaches nobody: not the triage, not the office.

Bowen wants parents to use admin@pra.edu.vn. The plan offered on 8 October 2026, still waiting for a decision:

1. Check the unused account for any mail sent to it.
2. Delete that account (Google can restore it for 20 days).
3. Add admin@pra.edu.vn as an alias of the main admin account, so mail to it lands in the office inbox.
4. In Gmail, set "Send mail as" admin@pra.edu.vn as the default.
5. Then change the address the world sees: the website (`site.json`), the invoices and The Current's From line. The sign-in stays admin@palmriveracademy.edu.vn.
6. Test that the triage's drafts still work.

The Admin console and Gmail steps are for the admin; the code changes and the testing are for Claude. Mail for the old address depends on the palmriveracademy.edu.vn mail records, which sit at Wix (below).

> **Ask Claude:** "We have decided to make admin@pra.edu.vn the address parents see. Walk me through the Admin console and Gmail steps one at a time, then change the website, the invoices and The Current, and test a triage draft."

## The shared drives

| Shared drive | On which domain | What is in it | Who can open it |
|---|---|---|---|
| Palm River Administration Drive | palmriveracademy.edu.vn | ADMISSIONS → Enrollment → "Students' enrollment forms": the signed forms, passports and ID copies, by academic year, then Regular Program by class or Global Program by family. Beside it, unenrollment forms and the form template | Managers: admin@, landon@, hien.c@, seth@. Content managers: comms@, xuan.l@, yvonne@ and one personal Gmail address. Bowen is not a member |
| PRA Shared Drive | pra.edu.vn | "Program curricula" → "Assessments Library" (902 PDFs, see [Assessments library](#/handbook/assessments)); "PHOTOS BY CLASS 2026-2027", the class and event photos (see [Photos and Facebook](#/handbook/photos)) | Its members (not listed in the notes) |

- Yvonne files the signed enrollment forms by hand; many are filed twice under two folder names. Forms sent through the website since 30 September 2026 are in The Current under [Enrollments](#/enrollments), not on this drive.
- A shared drive has no single owner; its files belong to the organisation, so they stay when a member leaves. Check that the new admin is a manager of both drives at the handover.
- **Google Drive for desktop** puts the shared drives on the laptop as drive `G:`, under `G:\Shared drives\`. On Bowen's laptop it has been signed in with his pra.edu.vn account since 6 October 2026, which is why the PRA Shared Drive is there and the Administration drive is not. Copying a file over an existing one on `G:` saves a new version and keeps its Drive link (the Assessments Library depends on that). The Current's folder export (Settings, super admin only) writes to a folder you pick on the laptop; pick one inside `G:` and the export is copied to Drive as well.

> **Rule:** PRA uses Google Drive, never OneDrive, for anything: files, backups, exports (Bowen, 28 September 2026).

## The domains and DNS in short

DNS is the address book that tells the internet where a domain's website and email are. The full table of records is in [The website](#/handbook/website).

- **pra.edu.vn**: DNS at P.A Vietnam (pavietnam.vn). Points at GitHub Pages for the website and The Current, and holds the Google mail and verification records.
- **palmriveracademy.edu.vn**: registered at P.A Vietnam, but its DNS is at Wix. It forwards the old website to pra.edu.vn through Netlify, and holds the mail records for admin@.
- **palmriveracademy.com**: at Wix, with the old Wix site. Bowen (6 October 2026): leave it alone.

## What must never be changed

> **Rule:** never change or delete the MX, SPF, DMARC or Google verification (TXT) records on any of the three domains. They are PRA's email. One wrong record and admin@ stops receiving mail. Any other DNS change starts and ends with a lookup to confirm they are still there.

> **Rule:** never delete, rename or suspend admin@palmriveracademy.edu.vn or remove its super admin role (see "The super admin account").

> **Rule:** do not cancel the Wix plan, or let it lapse, until the DNS of palmriveracademy.edu.vn has been moved to P.A Vietnam with every mail record copied. The admin@ inbox depends on records that live in the Wix account today. The plan renews on 12 February 2027, and the charge may come from about 22 January 2027 (from the project notes; not checked since 15 October 2026).

> **Ask Claude:** "Look up the mail records for palmriveracademy.edu.vn, pra.edu.vn and palmriveracademy.com and tell me whether they are all still in place."

## When someone leaves

> **Careful:** this has not been done at PRA since the tools above were set up, and the notes hold no tested steps. Treat it as a checklist to confirm with Claude, one step at a time, before acting.

For a member of staff:

1. **Before the last day,** decide who takes over their email and their files.
2. **Stop the sign-in, keep the account.** In the Admin console, **Directory** → **Users** → the account → **Reset password**, with a password nobody gives out, and sign them out of their devices. Do not delete the account: deleting it removes their mail, and their own Drive files unless they are moved first.
3. **Mail.** Arrange for their mail to reach the person taking over. This is a standing rule in Workspace, so the admin sets it in the Admin console, not Claude.
4. **Files.** Files on the shared drives stay where they are. Move anything in the person's own Drive to the person taking over with the Admin console's data transfer.
5. **Groups and drives.** Take them off allstaff@ and off the shared drives' member lists.
6. **The rest of PRA's systems.** Their login to The Current (see [Behind the scenes](#/handbook/behind)), their staff card on the website (see [The website](#/handbook/website)), and, if they are Yvonne, Seth or Hien, the triage's four internal addresses and lanes (see [The inbox and the triage](#/handbook/inbox)).

For a student: give them an end date or mark them Past in The Current, then sync the parent lists. Their Google account stays in its unit. What to do with the accounts of past students (about 50 sit in /Students: keep, suspend or delete) has been an open decision since 8 October 2026.

> **Ask Claude:** "A member of staff is leaving on Friday. Go through the leaving checklist in the Google Workspace chapter with me, step by step, and tell me which steps are mine in the Admin console and which you can do."

## Open items

As of 16 October 2026:

- The admin@pra.edu.vn decision (alias and send-as, above).
- Past-student Google accounts in /Students: keep, suspend or delete.
- Whether pending families go on the parent lists; the first parents_ey sync; one parent address Google refused.
- The 5 January 2027 posting change on the parent lists.
- Moving the DNS of palmriveracademy.edu.vn off Wix before the plan renews.
- The sign-in emails for new accounts still go to bowen@pra.edu.vn; at the handover they move to the new admin's address, with the triage's other uses of that address.
- A deny rule that would stop Claude from running GAM directly or reading `C:\GAMConfig` was offered to Bowen; no answer recorded.
