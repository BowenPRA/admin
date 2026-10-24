import { plain, scanSections, splitSections } from './markdown'

// The admin handbook: how Palm River Academy is run, for whoever holds the
// admin role after Bowen. One Markdown file per chapter in this folder; the
// list below gives the order, the title shown in the Handbook page and the
// date the chapter was last gone through. To change a chapter, edit its file
// (or ask Claude to) and deploy; there is nothing to run in the database.
//
// Writing rules for a chapter: no "# Title" line (the title comes from this
// list); a short opening paragraph, then "## " sections and "### " parts; plain
// sentences; a page or button is named the way the screen names it; never a
// password, key or token, only where it is kept and who holds it.
export const CHAPTERS = [
  { id: 'start-here', file: '01-start-here', title: 'Start here', blurb: 'What this handbook is, the five rules that matter most, and your first week.', updated: '2026-10-24' },
  { id: 'the-year', file: '02-the-year', title: 'The year at PRA', blurb: 'Quarters, invoice runs, report periods, events, and the move to a new academic year.', updated: '2026-10-16' },
  { id: 'the-current', file: '03-the-current', title: 'The Current, tab by tab', blurb: 'Signing in, roles, and what every page is for.', updated: '2026-10-24' },
  { id: 'fees', file: '04-fees-and-invoices', title: 'Fees, invoices and receipts', blurb: 'The fee rules, how an invoice is made and sent, payments, receipts, proof and exports.', updated: '2026-10-20' },
  { id: 'students', file: '05-students-and-enrollment', title: 'Students, families and enrollment', blurb: 'From an enquiry to a complete student record: leads, forms, statuses, IDs, documents, the checklist.', updated: '2026-10-22' },
  { id: 'attendance', file: '06-attendance-and-schedule', title: 'Attendance and the schedule', blurb: 'Taking the register, partial-day and traveling students, ECAs, summaries and printouts.', updated: '2026-10-21' },
  { id: 'reports', file: '07-progress-reports', title: 'Progress reports', blurb: 'The five levels, the templates, who writes what, the writing rules, translation and printing.', updated: '2026-10-19' },
  { id: 'photos', file: '08-photos-and-facebook', title: 'Photos and Facebook', blurb: 'The photo library, albums, the Photos tab and posts.', updated: '2026-10-16' },
  { id: 'assessments', file: '09-assessments', title: 'Assessments library', blurb: 'The assessment papers on the shared drive and the Assessments tab.', updated: '2026-10-16' },
  { id: 'todo', file: '10-to-do-and-claude', title: 'The To-Do tab', blurb: 'Tasks for the team and for Claude, and how staff ask for things.', updated: '2026-10-20' },
  { id: 'website', file: '11-the-website', title: 'The website', blurb: 'pra.edu.vn in English and Vietnamese: where the text lives, how a change goes live, the forms.', updated: '2026-10-24' },
  { id: 'inbox', file: '12-inbox-and-triage', title: 'The inbox and the triage', blurb: 'The shared admin@ inbox, the automatic sorting that runs each weekday, and its rules.', updated: '2026-10-22' },
  { id: 'google', file: '13-google-workspace', title: 'Google Workspace and domains', blurb: 'Staff and student accounts, parent groups, the admin addresses, the domains.', updated: '2026-10-16' },
  { id: 'behind', file: '14-behind-the-scenes', title: 'Behind the scenes', blurb: 'Where the code and the data live, how a change is deployed, database updates, backups, local testing.', updated: '2026-10-24' },
  { id: 'claude', file: '15-working-with-claude', title: 'Working with Claude', blurb: 'How the work gets done: sessions, skills, memory, agents and routines; what Claude may and may not do.', updated: '2026-10-24' },
  { id: 'rules', file: '16-rules-and-wording', title: 'Rules and wording', blurb: 'The standing rules: never "school", one-page reports, plain copy, natural Vietnamese, and the rest.', updated: '2026-10-20' },
  { id: 'open', file: '17-known-problems', title: 'Known problems and open items', blurb: 'What is fragile, what is unfinished, and what to watch.', updated: '2026-10-22' },
  { id: 'glossary', file: '18-glossary-and-people', title: 'Glossary and who is who', blurb: 'The words used here and the people behind the names.', updated: '2026-10-24' },
  { id: 'updating', file: '19-keeping-this-handbook', title: 'Keeping this handbook up to date', blurb: 'How a chapter is changed and when to go through it.', updated: '2026-10-20' },
]

// Every chapter file, read at build time; a chapter with no file yet shows as empty.
const files = import.meta.glob('./*.md', { query: '?raw', import: 'default', eager: true })

export const chapterText = (c) => files[`./${c.file}.md`] || ''
export const chapterSections = (c) => scanSections(chapterText(c))
export const chapterIndex = (c) => CHAPTERS.findIndex((x) => x.id === c.id)

// Sections whose text has every word of the query, with a snippet around the first hit.
export function searchHandbook(query) {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const out = []
  for (const c of CHAPTERS) {
    for (const block of splitSections(chapterText(c))) {
      const text = plain(block.text)
      const hay = `${block.title} ${text}`.toLowerCase()
      if (!words.every((w) => hay.includes(w))) continue
      const at = text.toLowerCase().indexOf(words[0])
      const start = Math.max(0, at - 70)
      const snippet = (start > 0 ? '…' : '') + text.slice(start, start + 180).trim() + (text.length > start + 180 ? '…' : '')
      out.push({ chapter: c, id: block.id, title: block.title || c.title, snippet })
    }
  }
  return out
}
