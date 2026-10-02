import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ExternalLink, FileText, Headphones, BookOpen } from 'lucide-react'
import { useT } from '../lib/i18n'
import { useAuth } from '../lib/AuthContext'
import {
  KINDS, KIND_TONE, SUBJECTS, SUBJECT_LABEL, YEARS, label, loadCatalog, fileUrl, haystack, matches, myClasses, forClasses,
} from '../lib/assessments'
import { Card, Chip, Empty, PageHeader, SearchInput, Spinner } from '../components/ui'

// Filters are remembered on this device.
const PREFS_KEY = 'pra-admin-assessments'
const readPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {} } catch { return {} } }

// The types, in three families, in the order teachers meet them.
const TYPE_GROUPS = [
  { label: ['Through the year', 'Trong năm học'], kinds: ['diagnostic', 'end_of_unit', 'mid_year', 'end_of_year', 'progress_test'] },
  { label: ['PRA reviews', 'Đánh giá của PRA'], kinds: ['progress_review', 'baseline', 'review_packet'] },
  { label: ['Cambridge papers', 'Đề Cambridge'], kinds: ['progression_test', 'sample_paper', 'checkpoint'] },
]
// These come as numbered sets, so they show as a grid of tiles.
const TILED = new Set(['end_of_unit', 'progress_test'])

// Assessment papers for Years 1-9 (Maths, Science, English): Cambridge GO's
// diagnostic, unit, mid-year and end-of-year tests, Cambridge progression and
// sample papers, Checkpoint, and PRA's own progress reviews. A teacher starts
// on their own classes. Every file opens on the shared Google Drive.
// See src/lib/assessments.js.
export default function Assessments() {
  const { t, lang } = useT()
  const { me } = useAuth()
  const classes = useMemo(() => myClasses(me?.subjects), [me])
  const [prefs] = useState(readPrefs)
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [mine, setMine] = useState(prefs.mine ?? true)
  const [cls, setCls] = useState(prefs.cls || '') // one of my classes: 'math:5'
  const [subject, setSubject] = useState(prefs.subject || '')
  const [year, setYear] = useState(prefs.year || '')
  const [kind, setKind] = useState(prefs.kind || '')
  const [toggled, setToggled] = useState({}) // section key -> open, when someone has clicked it

  useEffect(() => {
    let on = true
    loadCatalog().then((c) => on && setCatalog(c)).catch((e) => on && setError(e.message))
    return () => { on = false }
  }, [])
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ mine, cls, subject, year, kind })) } catch { /* ignore */ }
  }, [mine, cls, subject, year, kind])

  const indexed = useMemo(() => (catalog?.items || []).map((item) => ({ item, hay: haystack(item) })), [catalog])
  const scoped = mine && classes.length > 0
  const oneClass = scoped && cls ? classes.find((c) => `${c.subject}:${c.year}` === cls) : null

  // Everything but the type, so each type button can say how many it would show.
  const inScope = indexed.filter(({ item, hay }) => (oneClass ? forClasses(item, [oneClass]) : !scoped || forClasses(item, classes))
    && (scoped || !subject || item.subject === subject)
    && (scoped || !year || item.years.includes(Number(year)))
    && (!q.trim() || matches(item, q, hay))).map((r) => r.item)
  const kindCount = inScope.reduce((m, i) => ({ ...m, [i.kind]: (m[i.kind] || 0) + 1 }), {})
  const rows = kind ? inScope.filter((i) => i.kind === kind) : inScope

  // One card per class (year and subject); a teacher's own classes come in the order they teach them.
  const sections = []
  const bySection = new Map()
  // A paper for two years (a PRA "Year 3-4" review) goes under the year being looked at.
  const yearFor = (item) => {
    const wanted = oneClass ? [oneClass.year] : scoped ? classes.filter((c) => c.subject === item.subject).map((c) => c.year) : year ? [Number(year)] : []
    return item.years.find((y) => wanted.includes(y)) ?? item.years[0]
  }
  for (const item of rows) {
    const y = yearFor(item)
    const k = `${item.subject}:${y}`
    if (!bySection.has(k)) { const s = { key: k, year: y, subject: item.subject, items: [] }; bySection.set(k, s); sections.push(s) }
    bySection.get(k).items.push(item)
  }
  const rank = (s) => {
    const i = classes.findIndex((c) => c.subject === s.subject && c.year === s.year)
    return i < 0 ? 1000 : i
  }
  sections.sort((a, b) => (scoped ? rank(a) - rank(b) : 0) || a.year - b.year || SUBJECTS.indexOf(a.subject) - SUBJECTS.indexOf(b.subject))
  // A teacher's own classes, a short list, or a search open by default; a long list shows as cards to pick from.
  const openByDefault = scoped || sections.length <= 3 || !!q.trim() || !!kind
  const isOpen = (key) => toggled[key] ?? openByDefault

  const clear = () => { setQ(''); setSubject(''); setYear(''); setKind(''); setCls('') }
  const filtered = q || kind || (scoped ? cls : subject || year)

  if (!catalog && !error) return <Spinner />

  return (
    <div className="space-y-4">
      <PageHeader title={t('asNav')} subtitle={t('asSubtitle')} />

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {catalog && (
        <Card className="space-y-3 !p-4">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={q} onChange={setQ} placeholder={t('asSearch')} className="min-w-0 flex-1 basis-60" />
            {classes.length > 0 && (
              <div className="seg" role="group">
                <button type="button" aria-pressed={mine} onClick={() => setMine(true)}>{t('asMine')}</button>
                <button type="button" aria-pressed={!mine} onClick={() => setMine(false)}>{t('asAll')}</button>
              </div>
            )}
          </div>

          {scoped ? (
            classes.length > 1 && (
              <ChipRow label={t('asClass')}>
                <Pill on={!cls} onClick={() => setCls('')}>{t('asAllMine')}</Pill>
                {classes.map((c) => {
                  const k = `${c.subject}:${c.year}`
                  return <Pill key={k} on={cls === k} onClick={() => setCls(cls === k ? '' : k)}>{t('asYearN', { n: c.year })} {label(SUBJECT_LABEL[c.subject], lang)}</Pill>
                })}
              </ChipRow>
            )
          ) : (
            <>
              <ChipRow label={t('asYear')}>
                <Pill on={!year} onClick={() => setYear('')}>{t('asAllShort')}</Pill>
                {YEARS.map((y) => <Pill key={y} on={String(year) === String(y)} onClick={() => setYear(String(year) === String(y) ? '' : String(y))}>{y}</Pill>)}
              </ChipRow>
              <ChipRow label={t('asSubject')}>
                <Pill on={!subject} onClick={() => setSubject('')}>{t('asAllShort')}</Pill>
                {SUBJECTS.map((s) => <Pill key={s} on={subject === s} onClick={() => setSubject(subject === s ? '' : s)}>{label(SUBJECT_LABEL[s], lang)}</Pill>)}
              </ChipRow>
            </>
          )}

          <ChipRow label={t('asType')}>
            <Pill on={!kind} onClick={() => setKind('')}>{t('asAllShort')} <Count n={inScope.length} on={!kind} /></Pill>
            {TYPE_GROUPS.map((g) => {
              const present = g.kinds.filter((k) => kindCount[k] || kind === k)
              if (!present.length) return null
              return (
                <span key={g.label[0]} className="flex shrink-0 items-center gap-1.5 border-l border-slate-200 pl-2 sm:flex-wrap">
                  <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:inline">{label(g.label, lang)}</span>
                  {present.map((k) => (
                    <Pill key={k} on={kind === k} onClick={() => setKind(kind === k ? '' : k)}>{label(KINDS[k], lang)} <Count n={kindCount[k] || 0} on={kind === k} /></Pill>
                  ))}
                </span>
              )
            })}
          </ChipRow>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {scoped && <span className="hidden sm:inline">{t('asMineHint', { list: classes.map((c) => `${label(SUBJECT_LABEL[c.subject], lang)} ${t('asYearN', { n: c.year })}`).join(', ') })}</span>}
            <span className="ml-auto">{t('asCount', { n: rows.length })}</span>
            {filtered && <button type="button" className="font-semibold text-pra-blue hover:underline" onClick={clear}>{t('asClear')}</button>}
          </div>
        </Card>
      )}

      {catalog && (rows.length === 0 ? (
        <Empty text={t('noMatches')}>
          {scoped && <p className="mt-2"><button type="button" className="font-semibold text-pra-blue hover:underline" onClick={() => setMine(false)}>{t('asTryAll')}</button></p>}
        </Empty>
      ) : (
        <div className="space-y-3">
          {sections.map((s) => (
            <Section key={s.key} s={s} open={isOpen(s.key)} onToggle={() => setToggled((m) => ({ ...m, [s.key]: !isOpen(s.key) }))}
              mineHere={!scoped && classes.some((c) => c.subject === s.subject && c.year === s.year)} lang={lang} t={t} />
          ))}
        </div>
      ))}

      {catalog && <p className="text-xs text-slate-400">{t('asFooter', { folder: catalog.folder.replace('/', ' › '), date: catalog.built })}</p>}
    </div>
  )
}

function ChipRow({ label: text, children }) {
  return (
    // One line that scrolls sideways on a phone; wraps on wider screens.
    <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      <span className="w-14 shrink-0 text-xs font-semibold text-slate-500">{text}</span>
      {children}
    </div>
  )
}

function Pill({ on, onClick, children }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${on ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'}`}>
      {children}
    </button>
  )
}

const Count = ({ n, on }) => <span className={`text-xs font-medium ${on ? 'text-white/70' : 'text-slate-400'}`}>{n}</span>

function Section({ s, open, onToggle, mineHere, lang, t }) {
  const courses = [...new Set(s.items.filter((i) => i.source === 'Cambridge GO').map((i) => i.course))]
  const groups = Object.keys(KINDS).map((k) => ({ kind: k, items: s.items.filter((i) => i.kind === k) })).filter((g) => g.items.length)
  return (
    <Card className="overflow-hidden !p-0">
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-slate-50">
        <span className="text-base font-bold text-slate-800">{t('asYearN', { n: s.year })} · {label(SUBJECT_LABEL[s.subject], lang)}</span>
        {mineHere && <Chip tone="sky">{t('asYourClass')}</Chip>}
        {courses.length > 0 && <span className="text-xs text-slate-500">{courses.join(', ')}</span>}
        <span className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          {!open && <span className="hidden sm:inline">{groups.map((g) => `${label(KINDS[g.kind], lang)} ${g.items.length}`).join(' · ')}</span>}
          <span className="sm:hidden">{s.items.length}</span>
          <ChevronDown size={18} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-3">
          {groups.map((g) => (
            <div key={g.kind}>
              <h3 className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {label(KINDS[g.kind], lang)} <span className="font-medium text-slate-400">{g.items.length}</span>
              </h3>
              {TILED.has(g.kind) && g.items.every((i) => i.unit) ? (
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
                  {g.items.map((item) => <Tile key={item.slug} item={item} t={t} />)}
                </ul>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {g.items.map((item) => <Row key={item.slug} item={item} t={t} />)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// A numbered unit or progress test: "Unit 3", with its paper and mark scheme.
function Tile({ item, t }) {
  const quiz = /quiz/i.test(item.title)
  const name = item.kind === 'end_of_unit' ? t('asUnitN', { n: item.unit }) : t(quiz ? 'asQuizN' : 'asTestN', { n: item.unit })
  const part = item.title.split(' · ')[1]
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-2.5">
      <div className="text-sm font-bold text-slate-800">{name}{part && <span className="font-medium text-slate-500"> · {part}</span>}</div>
      <div className="flex flex-wrap gap-1">
        {item.files.map((f) => <FileLink key={f.drive} f={f} t={t} short />)}
      </div>
    </li>
  )
}

function Row({ item, t }) {
  const years = item.years.length > 1 ? t('asYearsN', { a: item.years[0], b: item.years[item.years.length - 1] }) : null
  // A progression test or Checkpoint already has its session in the title.
  const session = item.kind !== 'progression_test' && item.kind !== 'checkpoint' ? item.session : null
  const course = item.source === 'Cambridge GO' ? null : item.course
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2">
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-800">{item.title}</span>
          {session && <Chip tone={KIND_TONE[item.kind] === 'green' ? 'green' : 'slate'}>{session}</Chip>}
        </div>
        {(years || course || item.note) && <div className="mt-0.5 text-xs text-slate-500">{[years, course, item.note].filter(Boolean).join(' · ')}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {item.files.map((f) => <FileLink key={f.drive} f={f} t={t} />)}
      </div>
    </li>
  )
}

// Papers are the main button; mark schemes and the rest are quieter.
function FileLink({ f, t, short }) {
  const text = short ? (f.part === 'test' ? t('asPaper') : f.part === 'mark_scheme' ? t('asMarkScheme') : f.label) : f.label
  const Icon = f.part === 'audioscript' ? Headphones : f.part === 'insert' ? BookOpen : f.part === 'mark_scheme' ? ExternalLink : FileText
  const style = f.part === 'test'
    ? 'border border-pra-blue/30 bg-pra-blue/5 text-pra-navy hover:bg-pra-blue/10'
    : 'text-slate-600 hover:bg-slate-100'
  return (
    <a href={fileUrl(f)} target="_blank" rel="noreferrer" title={`${f.label}${f.pages ? ` · ${f.pages} ${t('asPages')}` : ''} · ${t('asOnDrive')}`}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${style}`}>
      <Icon size={13} /> {text}
    </a>
  )
}
