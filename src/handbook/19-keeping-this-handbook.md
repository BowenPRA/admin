The handbook is only useful while it is true. This chapter says what it is made of, how a chapter is changed, and when to go through it. Open it whenever something in the way PRA is run has changed, and before any handover.

## What the handbook is made of

- Each chapter is one text file, written in Markdown (plain text with `##` for headings and `-` for bullets), inside The Current's code at `src/handbook/`. The chapter list, with the order, the titles and the "Last gone through" dates, is `src/handbook/index.js` in the same folder.
- The **Handbook** page reads those files when The Current is built. Nothing about the handbook is stored in the database, so a change is a change to the code, followed by a deploy (see [Behind the scenes](#/handbook/behind)).
- Office accounts (Super Admin, Head Teacher, Admin) see the page under the gear icon, **Setup** → **Handbook**. Teachers do not see it: it covers fees and the inner workings.
- The handbook is written in English. The page title and buttons follow the EN/VI switch, the chapters do not.

## Changing a chapter

The usual way is to ask Claude. Say which chapter, what is wrong or missing, and what is true now. Claude edits the file, runs the checker, deploys The Current and tells you when the live page shows the change. This takes a few minutes.

> **Ask Claude:** "In the handbook, open the fees chapter and change the transport rate for Da Nang to 4.2M a month from Quarter 3. Then deploy The Current."

What Claude does, so you can follow along:

1. Edits the chapter file in `C:\Users\sbowe\admin\src\handbook\` (on whichever laptop holds the code; see [Behind the scenes](#/handbook/behind) for where it is).
2. Changes that chapter's `updated` date in `index.js` to the day of the change.
3. Runs the checker (below). It stops a deploy that would publish a banned word, a broken link or anything that looks like a secret.
4. Runs `npm run deploy` in the `admin` folder. About two minutes later https://current.pra.edu.vn shows the new text. A hard refresh (Ctrl+F5) helps if the old page is still showing.
5. Commits the change to the code's history when you ask for a commit. Bowen's rule is that deploys happen without asking and commits wait for the word (see [Working with Claude](#/handbook/claude)).

If you prefer to edit the text yourself, any text editor opens the `.md` files. Keep the shape described under "How a chapter is written" below. Then ask Claude to check and deploy.

## How a chapter is written

- No `#` title line: the title comes from the chapter list. A short opening paragraph says what the chapter covers and when to open it. Then `##` sections and `###` parts, with plain noun-phrase headings.
- Plain sentences, one idea each, in the second person. Say it once. No aphorisms, no "simply" or "just". <!-- allow -->
- A procedure is a numbered list, each step starting with the thing you click, named as the screen names it, in bold the first time.
- Reference data goes in a table. A warning or a rule is a quote line starting with a bold word: **Careful:**, **Rule:**.
- Where a task needs the computer rather than the browser, the section ends with an **Ask Claude:** quote giving the exact sentence to say.
- Links inside The Current look like `[Students](#/students)`; to another chapter `[the fees chapter](#/handbook/fees)`; to a section `#/handbook/fees?s=sibling-discount`, where the part after `s=` is the heading in lower case with hyphens for spaces.
- The same word rules as everywhere at PRA: never "school", "report card" or "grades" in English, never "trường" or "học sinh" in Vietnamese. See [Rules and wording](#/handbook/rules). <!-- allow -->

## Adding a chapter

1. Ask Claude to add a chapter, giving the title and what it should cover. Claude writes a new file (the next number in the folder, for example `20-newsletter.md`) and adds one line to the chapter list in `index.js` with an `id` for links, the file name, the title, a one-line blurb and the date.
2. The new chapter appears in the sidebar at the position of its line in the list. Put it where a reader would look for it, not at the end because it is new.
3. Link to it from the chapters that mention the same work, so it is found from more than one place.

## The checker

`scripts/check-handbook.mjs` reads every chapter and reports:

- a chapter in the list with no file, or a file not in the list
- a link to a chapter or section that does not exist, or to a page The Current does not have
- the words the handbook never uses: "school", "report card", "grades", "trường", "học sinh" <!-- allow -->
- anything that looks like a key, a token, a written-out password, a long account number
- an em-dash, and the words "simply", "just" and "easily" <!-- allow -->

Claude runs it before every deploy that touches the handbook. To run it by hand, in PowerShell:

```
node C:\Users\sbowe\admin\scripts\check-handbook.mjs
```

It prints each problem with the file and line, or "Handbook OK".

## When to go through it

Go through the whole handbook, chapter by chapter, at these moments:

- **At the start of each quarter** (the quarter dates are in [The year at PRA](#/handbook/the-year)). Fees, the calendar and the report period change then, and so does what the Home page shows.
- **After any change to The Current, the website or the triage that changes how a task is done.** A new button, a renamed tab, a new rule in the triage. The chapter that describes that task is wrong the moment the change is live. Ask Claude to update the chapter in the same session as the change; it is quicker than finding it later.
- **Before a handover.** Read the whole thing as the new person would, with a copy of The Current open. Every step that no longer matches the screen is a line to fix. [Start here](#/handbook/start-here) has the handover list.
- **After the move to a new academic year.** The fee schedule, the invoice numbering prefix, the roster and the report periods all change; so do the examples in several chapters.

Going through a chapter means reading it against the real screen and the real files, fixing what has drifted, and then setting its "Last gone through" date even when nothing changed. A date more than a quarter old is itself a warning to the reader.

> **Ask Claude:** "Go through the attendance chapter of the handbook against the Attendance page and the code, fix anything that has drifted, and set its date to today."

## What never goes in

- A password, a key, a token, a recovery code or the contents of a login file. Write where the thing is kept and who holds it. The checker catches most of these, but not all.
- A child's or a parent's name, address, phone number or email. The handbook travels further than the database does: it is in the code and in printed copies.
- A guess written as a fact. If something has not been checked, write that it has not, with the date. If it is a problem, it belongs in [Known problems and open items](#/handbook/open).

## A printed copy

The **Print this chapter** button prints the chapter you are reading. **The whole handbook** at the bottom of the chapter list shows every chapter in order; the print button then prints all of them, each starting on a new page, with outside links written out in full. Save as PDF from the print dialog for a copy to keep off the computer. A printed copy is only as current as its date, so write the date on it.
