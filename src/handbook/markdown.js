import { Marked } from 'marked'

// The handbook chapters are Markdown files in this folder, written by Claude
// and Bowen and shipped with the app. They are trusted text from the repo, so
// the HTML they turn into is put on the page as it is (no sanitizer).

// A heading's id, used for the "In this chapter" list, search results and
// ?s=… links. The same function serves the renderer and the section scanner,
// so the ids always agree.
export const headingSlug = (raw) => String(raw)
  .replace(/[*_`~[\]]/g, '')
  .replace(/\([^)]*\)/g, (m) => (m.startsWith('(#') || m.startsWith('(http') ? '' : m))
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, '-')
  .replace(/^-+|-+$/g, '') || 'section'

// Gives each heading an id (made unique within one chapter) and opens outside
// links in a new tab. Links inside The Current (#/students, #/handbook/fees) stay
// in this tab.
function makeRenderer(seen) {
  return {
    heading({ tokens, depth, text }) {
      const inner = this.parser.parseInline(tokens)
      let id = headingSlug(text)
      if (seen.has(id)) { let n = 2; while (seen.has(`${id}-${n}`)) n++; id = `${id}-${n}` }
      seen.add(id)
      return `<h${depth} id="${id}">${inner}</h${depth}>\n`
    },
    link({ href, title, tokens }) {
      const inner = this.parser.parseInline(tokens)
      const t = title ? ` title="${title}"` : ''
      const outside = /^https?:\/\//i.test(href)
      return `<a href="${href}"${t}${outside ? ' target="_blank" rel="noopener"' : ''}>${inner}</a>`
    },
  }
}

export function renderMarkdown(md) {
  const m = new Marked({ gfm: true, breaks: false })
  m.use({ renderer: makeRenderer(new Set()) })
  return m.parse(md || '')
}

// Section list of one chapter: its ## and ### headings, in order, with the ids
// the renderer gives them. Fenced code blocks are skipped.
export function scanSections(md) {
  const out = []
  const seen = new Set()
  let fenced = false
  for (const line of String(md || '').split('\n')) {
    if (/^\s*```/.test(line)) { fenced = !fenced; continue }
    if (fenced) continue
    const h = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!h) continue
    let id = headingSlug(h[2])
    if (seen.has(id)) { let n = 2; while (seen.has(`${id}-${n}`)) n++; id = `${id}-${n}` }
    seen.add(id)
    out.push({ id, level: h[1].length, title: h[2].replace(/[*_`~]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') })
  }
  return out
}

// The chapter cut into blocks of text, one per ## section (the intro before the
// first ## is its own block), for search.
export function splitSections(md) {
  const blocks = []
  const seen = new Set()
  let cur = { id: '', title: '', text: '' }
  let fenced = false
  for (const line of String(md || '').split('\n')) {
    if (/^\s*```/.test(line)) fenced = !fenced
    const h = !fenced && /^##\s+(.+?)\s*#*\s*$/.exec(line)
    if (h) {
      blocks.push(cur)
      let id = headingSlug(h[1])
      if (seen.has(id)) { let n = 2; while (seen.has(`${id}-${n}`)) n++; id = `${id}-${n}` }
      seen.add(id)
      cur = { id, title: h[1].replace(/[*_`~]/g, ''), text: '' }
      continue
    }
    if (/^###\s+/.test(line)) { // a ### heading's id is taken too, so numbering stays in step with scanSections
      let id = headingSlug(line.replace(/^###\s+/, ''))
      if (seen.has(id)) { let n = 2; while (seen.has(`${id}-${n}`)) n++; id = `${id}-${n}` }
      seen.add(id)
    }
    cur.text += `${line}\n`
  }
  blocks.push(cur)
  return blocks.filter((b) => b.text.trim() || b.title)
}

// Plain words from Markdown, for snippets.
export const plain = (md) => String(md || '')
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/^#+\s+/gm, '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/[*_`>|]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
