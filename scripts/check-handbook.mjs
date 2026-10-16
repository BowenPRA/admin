// Checks the handbook chapters in src/handbook before a deploy:
//   node scripts/check-handbook.mjs
// - every chapter in index.js has its file, and every file is in the list
// - links to other chapters (#/handbook/<id>) and sections (?s=<slug>) point at something
// - links inside The Current (#/students …) are routes the app has
// - words the handbook never uses ("school", "report card", "grades", "trường", "học sinh")
// - anything that looks like a secret (a key, a token, a password, a long random string)
// A line that has to quote one of those words ends with <!-- allow -->, which is not shown on the page.
// Prints every problem with its file and line, and exits 1 if there is one.
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { headingSlug, scanSections } from '../src/handbook/markdown.js'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'handbook')
const indexSrc = readFileSync(join(dir, 'index.js'), 'utf8')
const chapters = [...indexSrc.matchAll(/\{ id: '([^']+)', file: '([^']+)'/g)].map((m) => ({ id: m[1], file: m[2] }))
const files = readdirSync(dir).filter((f) => f.endsWith('.md'))
const appSrc = readFileSync(join(dir, '..', 'App.jsx'), 'utf8')
const routes = [...appSrc.matchAll(/path="([^"]+)"/g)].map((m) => m[1])
const problems = []
const bad = (file, line, msg) => problems.push(`${file}${line ? `:${line}` : ''}  ${msg}`)

for (const c of chapters) if (!files.includes(`${c.file}.md`)) bad(`${c.file}.md`, 0, `listed in index.js but the file is missing`)
for (const f of files) if (!chapters.some((c) => `${c.file}.md` === f)) bad(f, 0, `not in the chapter list in index.js`)

const sectionsOf = {}
for (const c of chapters) {
  try { sectionsOf[c.id] = new Set(scanSections(readFileSync(join(dir, `${c.file}.md`), 'utf8')).map((s) => s.id)) } catch { sectionsOf[c.id] = new Set() }
}
const routeOk = (path) => routes.some((r) => {
  if (r === '*') return false
  const re = new RegExp(`^${r.replace(/:[^/]+/g, '[^/]+')}$`)
  return re.test(path)
})

const banned = [
  [/\bschools?\b/i, '"school"'],
  [/\breport cards?\b/i, '"report card"'],
  [/\bgrades?\b(?! \d)/i, '"grade"'],
  [/trường/i, '"trường"'],
  [/học sinh/i, '"học sinh"'],
]
const allowSchool = /previous school|other schools?|school year|school[- ]day|school calendar|school-day|international schools?|a school|the school'?s? (name|year|days)|schools? (they|the child) (attend|came)|homeschool/i
const secretish = [
  [/\b(sk|pk|rk|sb_secret|sb_publishable|eyJ)[A-Za-z0-9_-]{16,}/, 'looks like a key or token'],
  [/\bpassword\s*[:=]\s*\S+/i, 'a password written out'],
  [/\b[A-Za-z0-9_-]{32,}\b/, 'a long random string (a key?)'],
  [/\b\d{12,}\b/, 'a long number (an account number?)'],
]
const linkRe = /\]\((#\/[^)\s]+)\)/g

for (const c of chapters) {
  const file = `${c.file}.md`
  let text
  try { text = readFileSync(join(dir, file), 'utf8') } catch { continue }
  let fenced = false
  text.split('\n').forEach((line, i) => {
    const n = i + 1
    if (/^\s*```/.test(line)) fenced = !fenced
    if (/^#\s/.test(line)) bad(file, n, 'a "# " heading: the title comes from index.js, use "## "')
    for (const m of line.matchAll(linkRe)) {
      const href = m[1]
      if (href.startsWith('#/handbook/')) {
        const [idPart, query] = href.slice('#/handbook/'.length).split('?')
        if (!(idPart in sectionsOf) && idPart !== 'all') { bad(file, n, `link to unknown chapter "${idPart}"`); continue }
        const s = query && new URLSearchParams(query).get('s')
        if (s && !sectionsOf[idPart]?.has(s)) bad(file, n, `link to unknown section "${s}" in chapter "${idPart}" (slug of a heading: ${[...(sectionsOf[idPart] || [])].slice(0, 3).join(', ')}…)`)
      } else {
        const path = href.slice(1).split('?')[0]
        if (!routeOk(path)) bad(file, n, `link to a page The Current does not have: ${href}`)
      }
    }
    if (fenced || /<!--\s*allow\s*-->\s*$/.test(line)) return // a line that quotes a banned word on purpose ends with <!-- allow -->
    for (const [re, what] of banned) if (re.test(line) && !(what === '"school"' && allowSchool.test(line))) bad(file, n, `uses ${what}`)
    for (const [re, what] of secretish) if (re.test(line.replace(/https?:\/\/\S+/g, ''))) bad(file, n, what)
    if (/—/.test(line)) bad(file, n, 'an em-dash; use a full stop or a comma')
    if (/\b(simply|just|easily)\b/i.test(line)) bad(file, n, '"simply" / "just" / "easily"')
  })
}

if (problems.length) {
  console.log(`${problems.length} problem(s):\n` + problems.join('\n'))
  process.exit(1)
} else {
  console.log(`Handbook OK: ${chapters.length} chapters, ${files.length} files, ${Object.values(sectionsOf).reduce((a, s) => a + s.size, 0)} sections.`)
  // Unused: headingSlug is imported so a change to the slug rule breaks this script loudly.
  void headingSlug
}
