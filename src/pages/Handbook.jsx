import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookMarked, ChevronRight, Printer } from 'lucide-react'
import { useT } from '../lib/i18n'
import { CHAPTERS, chapterIndex, chapterSections, chapterText, searchHandbook } from '../handbook'
import { renderMarkdown } from '../handbook/markdown'
import { PageHeader, SearchInput } from '../components/ui'

const fmtDate = (iso, lang) => {
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// The admin handbook: chapters down the side, one chapter at a time in the
// middle, a search over every section, and print. /handbook/all shows every
// chapter in order for printing the whole thing. The text is Markdown in
// src/handbook/ (see index.js there).
export default function Handbook() {
  const { t, lang } = useT()
  const { chapter: wantedId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const all = wantedId === 'all'
  const chapter = all ? null : CHAPTERS.find((c) => c.id === wantedId) || CHAPTERS[0]
  const results = q.trim().length >= 2 ? searchHandbook(q) : null

  // /handbook and an unknown id both show the first chapter, at its own address.
  useEffect(() => {
    if (!all && chapter && wantedId !== chapter.id) navigate(`/handbook/${chapter.id}`, { replace: true })
  }, [all, chapter, wantedId, navigate])

  const open = (c, sectionId) => { setQ(''); navigate(`/handbook/${c.id}${sectionId ? `?s=${encodeURIComponent(sectionId)}` : ''}`) }

  return (
    <div className="space-y-5">
      <PageHeader title={t('handbookTitle')} subtitle={t('handbookSubtitle')}>
        <SearchInput value={q} onChange={setQ} placeholder={t('hbSearch')} className="no-print w-64" />
        <button type="button" className="btn-secondary no-print" onClick={() => window.print()} title={all ? t('hbPrintAll') : t('hbPrint')}>
          <Printer size={16} /> <span className="hidden sm:inline">{all ? t('hbPrintAll') : t('hbPrint')}</span>
        </button>
      </PageHeader>

      {/* On a phone the chapters are a dropdown above the text. */}
      <div className="no-print lg:hidden">
        <select className="input" value={all ? 'all' : chapter?.id} onChange={(e) => (e.target.value === 'all' ? navigate('/handbook/all') : open(CHAPTERS.find((c) => c.id === e.target.value)))}>
          {CHAPTERS.map((c, i) => <option key={c.id} value={c.id}>{i + 1}. {c.title}</option>)}
          <option value="all">{t('hbAll')}</option>
        </select>
      </div>

      <div className="flex items-start gap-6">
        <aside className="no-print sticky hidden w-60 flex-none self-start lg:block" style={{ top: 'calc(var(--header-h, 56px) + 1rem)' }}>
          <div className="card max-h-[calc(100vh-var(--header-h,56px)-2.5rem)] overflow-y-auto p-2">
            <div className="flex items-center gap-2 px-2 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400"><BookMarked size={13} />{t('hbChapters')}</div>
            <ol className="space-y-0.5">
              {CHAPTERS.map((c, i) => {
                const on = !all && !results && chapter?.id === c.id
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => open(c)}
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] leading-snug transition-colors ${on ? 'bg-pra-blue font-semibold text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
                      <span className={`w-5 flex-none tabular-nums ${on ? 'text-white/70' : 'text-slate-400'}`}>{i + 1}</span>
                      <span>{c.title}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
            <div className="mt-2 border-t border-slate-100 pt-2">
              <Link to="/handbook/all" className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] ${all ? 'bg-slate-800 font-semibold text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Printer size={14} />{t('hbAll')}</Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {results ? <Results results={results} query={q} onOpen={open} t={t} />
            : all ? <AllChapters lang={lang} t={t} />
              : <Chapter chapter={chapter} section={params.get('s')} lang={lang} t={t} onOpen={open} />}
        </div>
      </div>
    </div>
  )
}

function Chapter({ chapter, section, lang, t, onOpen }) {
  const html = useMemo(() => renderMarkdown(chapterText(chapter)), [chapter])
  const sections = useMemo(() => chapterSections(chapter), [chapter])
  const ref = useRef(null)
  const i = chapterIndex(chapter)
  const prev = CHAPTERS[i - 1]
  const next = CHAPTERS[i + 1]

  // A ?s=… address scrolls to that heading; a new chapter starts at the top.
  useEffect(() => {
    const el = section && ref.current?.querySelector(`#${CSS.escape(section)}`)
    if (el) el.scrollIntoView({ block: 'start' })
    else window.scrollTo(0, 0)
  }, [chapter, section, html])

  const jump = (id) => {
    const el = ref.current?.querySelector(`#${CSS.escape(id)}`)
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  return (
    <article className="card hb-chapter p-6 sm:p-8">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-pra-blue">{t('hbChapterN', { n: i + 1 })}</div>
      <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{chapter.title}</h2>
      <p className="mt-1.5 text-sm text-slate-500">{chapter.blurb}</p>
      <div className="mt-1 text-xs text-slate-400">{t('hbUpdated', { date: fmtDate(chapter.updated, lang) })}</div>

      {sections.filter((s) => s.level === 2).length > 1 && (
        <nav aria-label={t('hbInThisChapter')} className="no-print mt-5 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('hbInThisChapter')}</div>
          <ol className="columns-1 gap-6 text-sm sm:columns-2">
            {sections.filter((s) => s.level === 2).map((s) => (
              <li key={s.id} className="break-inside-avoid">
                <button type="button" onClick={() => jump(s.id)} className="flex items-start gap-1 py-0.5 text-left text-slate-700 hover:text-pra-blue">
                  <ChevronRight size={14} className="mt-1 flex-none text-slate-300" />{s.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {html.trim()
        ? <div ref={ref} className="hb-prose mt-6" dangerouslySetInnerHTML={{ __html: html }} />
        : <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">{t('hbEmpty')}</p>}

      <div className="no-print mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-sm">
        {prev ? <button type="button" className="btn-ghost" onClick={() => onOpen(prev)}><ArrowLeft size={15} /> {prev.title}</button> : <span />}
        {next ? <button type="button" className="btn-ghost" onClick={() => onOpen(next)}>{next.title} <ArrowRight size={15} /></button> : <span />}
      </div>
    </article>
  )
}

// Every chapter in order, each on a new printed page.
function AllChapters({ lang, t }) {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return (
    <div className="space-y-6">
      {CHAPTERS.map((c, i) => (
        <article key={c.id} className="card hb-chapter p-6 sm:p-8">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-pra-blue">{t('hbChapterN', { n: i + 1 })}</div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">{c.title}</h2>
          <p className="mt-1.5 text-sm text-slate-500">{c.blurb}</p>
          <div className="mt-1 text-xs text-slate-400">{t('hbUpdated', { date: fmtDate(c.updated, lang) })}</div>
          <div className="hb-prose mt-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(chapterText(c)) }} />
        </article>
      ))}
    </div>
  )
}

function Results({ results, query, onOpen, t }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="text-sm text-slate-500">{results.length ? t('hbResults', { n: results.length, q: query.trim() }) : t('hbNoResults', { q: query.trim() })}</div>
      <ul className="mt-3 divide-y divide-slate-100">
        {results.map((r) => (
          <li key={`${r.chapter.id}:${r.id}`}>
            <button type="button" onClick={() => onOpen(r.chapter, r.id)} className="block w-full py-3 text-left hover:bg-sky-50/60">
              <div className="text-[11px] font-bold uppercase tracking-wider text-pra-blue">{r.chapter.title}</div>
              <div className="mt-0.5 font-semibold text-slate-800">{r.title}</div>
              <div className="mt-0.5 text-sm text-slate-500">{r.snippet}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
