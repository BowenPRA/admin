# CLAUDE.md

The Current is the admin app of Palm River Academy (PRA), an English language center in
Hội An: https://current.pra.edu.vn, from the GitHub repo BowenPRA/admin. React, Vite,
Tailwind and Supabase. The office and the teachers use it for students and enrollment,
fees and invoices, attendance and the schedule, progress reports, photos, leads, the
newsletter, emails, the To-Do list and teachers' lesson requests.

## Read first

- **`FEATURES.md`**: one line per feature, with its file and handbook chapter. Read it
  before saying something is new or missing, and before building.
- **`src/handbook/`**: the documentation, 20 chapters, shown in the app under Setup >
  Handbook. `19-keeping-this-handbook.md` says how a chapter is written and changed.
- `README.md` covers invoices and the first set-up only; it is older than most of the app.

## Rules

- **PRA is a language center.** Never "school", "report card" or "grades" in anything
  staff or families read; in Vietnamese never "trường" or "học sinh".
- **Other sessions leave unfinished work in this folder.** Touch only the files your
  task owns. Never stage, revert, format or commit someone else's changes.
- **Commit and push only when Bowen asks.** SQL files in `supabase/` are run by Bowen in
  the Supabase editor; a file being here does not mean it has run.
- **Deploy from a clean copy** while this folder holds other sessions' work: the recipe
  is in `C:\Users\sbowe\Desktop\Admin Email\deploy-kit\`. A build without `.env` puts
  the live site in offline mode; `vite.config.js` refuses it. `public/CNAME` and
  `base: '/'` belong together. After a deploy, check the live site has no "Offline
  mode" band.
- **Progress reports are one A4 page.** Never lower character limits to get there.
- A change to what the app does is finished only when `FEATURES.md` and the handbook
  chapter say so, with that chapter's date changed in `src/handbook/index.js`. Run
  `node scripts/check-handbook.mjs`.
- Never open `.env`.

## PRA Learn

The students' site (learn.pra.edu.vn, `C:\Users\sbowe\learn`) uses this app's Supabase
project. Everything the two share is listed in `C:\Users\sbowe\learn\docs\THE-CURRENT.md`:
the `learn_*` tables, the `learn-accounts` function, the staff-check functions, the
class rule (`isLessonClass` in `src/lib/lessons.js`), and the Lessons tab
(`src/pages/Lessons.jsx`, `src/components/lessons/`, `src/components/learn/`, handbook
chapter 20). Read it before changing any of those.

## Testing

Offline mode keeps everything in the browser: `npx vite --mode offline --port <port>`.
`npm run lint` and `npm run build` before calling anything done.
