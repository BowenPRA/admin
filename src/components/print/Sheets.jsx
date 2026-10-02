/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Printer, Check } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { longDate } from '../../lib/printFormat'
import { Spinner, Empty } from '../ui'

// The printed summaries (attendance, fees, class lists, admissions) share this:
// A4 sheets laid out here page by page from blocks of known height in mm, so
// what is on screen is exactly what prints. A page builds its blocks, `layout`
// puts them on sheets, and <PrintShell> draws the toolbar, the sheets, a running
// head from the second sheet on and the footer with page numbers.

export const SHEET = { landscape: { w: 297, h: 210 }, portrait: { w: 210, h: 297 } }
const TOP = 10, BOTTOM = 8, SIDE = 12, FOOT = 8
/** The running head on the second sheet and after. */
export const RUN = 12
/** Heights, in mm, of the pieces every printout uses. */
export const H = { masthead: 31, kpis: 26.5, gap: 6, title: 7, listHead: 5.5, listRow: 5.6, tableHead: 6, tableRow: 6.2 }
export const bodyHeight = (orientation) => SHEET[orientation].h - TOP - BOTTOM - FOOT
export const bodyWidth = (orientation) => SHEET[orientation].w - 2 * SIDE
export const mm = (n) => `${n}mm`

export const GREEN = '#16a34a'
export const AMBER = '#f59e0b'
export const RED = '#dc2626'
export const BLUE = '#1a7bc4'
export const BLUE_SOFT = '#9cc5ea'
export const SLATE = '#94a3b8'

/**
 * Puts blocks onto sheets. A block is either fixed ({ h }) or a list
 * ({ rows, head(first), row, tail(last), min }) that may run over onto the next
 * sheet, repeating a short head there; `row` is a height, or a function giving
 * each row's height. A list that fits on a fresh sheet moves over whole when it
 * is short (or `keep` is set, as for a class register) or when little room is
 * left; a long list starts where it is and runs on, leaving at least `min` rows
 * for the next sheet. `newSheet: true` keeps a block off the first sheet;
 * `newSheet: 'always'` starts it on a fresh one.
 */
export function layout(blocks, orientation = 'landscape') {
  const full = bodyHeight(orientation)
  const later = full - RUN
  const sheets = [[]]
  let used = 0
  const cap = () => (sheets.length === 1 ? full : later)
  const turn = () => { sheets.push([]); used = 0 }
  const put = (b) => { sheets.at(-1).push(b); used += b.h }
  const busy = () => sheets.at(-1).length > 0
  for (const b of blocks) {
    if (busy() && (b.newSheet === 'always' || (b.newSheet && sheets.length === 1))) turn()
    if (!b.rows) { if (used + b.h > cap() && busy()) turn(); put(b); continue }
    const { rows, head, tail, min = 3 } = b
    const hs = rows.map(typeof b.row === 'function' ? b.row : () => b.row)
    const sum = (i, j) => hs.slice(i, j).reduce((a, x) => a + x, 0)
    const whole = head(true) + sum(0, rows.length) + tail(true)
    const keep = b.keep || rows.length <= 10 || cap() - used < 0.35 * later
    if (used + whole > cap() + 1e-6 && whole <= later && busy() && keep) turn()
    let i = 0
    while (i < rows.length) {
      const first = i === 0
      const left = rows.length - i
      const room = cap() - used - head(first)
      let n = 0
      if (sum(i, rows.length) + tail(true) <= room + 1e-6) n = left
      else {
        let acc = 0
        while (n < left - 1 && acc + hs[i + n] + tail(false) <= room + 1e-6) { acc += hs[i + n]; n++ }
        n = Math.min(n, Math.max(0, left - min)) // the part carried over is never a lone row or two
      }
      if (n < Math.min(min, left) && busy()) { turn(); continue }
      n = Math.max(1, n)
      const last = i + n >= rows.length
      put({ ...b, rows: rows.slice(i, i + n), first, last, h: head(first) + sum(i, i + n) + tail(last) })
      i += n
    }
  }
  return sheets
}

/**
 * The page around the sheets: a toolbar (Back, the page's own pickers, English /
 * Tiếng Việt, Print), the sheets, and on each sheet the running head and footer.
 * `T` is the printout's translator; the toolbar follows the app's language.
 */
export function PrintShell({ T, lang, setLang, orientation = 'landscape', back, controls, docTitle, running, sheets, renderBlock, footLeft, loading, error, empty, by }) {
  const { t } = useT()
  const size = SHEET[orientation]
  useEffect(() => { if (docTitle) document.title = docTitle }, [docTitle])
  // On a screen narrower than the sheet, the sheets are shown smaller; printing is unaffected.
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const fit = () => setZoom(Math.min(1, (window.innerWidth - 24) / (size.w * 3.7795)))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [size.w])
  const printed = longDate(new Date(), lang)
  return (
    <div className="min-h-screen bg-slate-200 print:bg-white">
      <style>{`@page { size: A4 ${orientation}; margin: 0; }`}</style>
      <div className="no-print sticky top-0 z-10 border-b border-slate-300 bg-white/95 backdrop-blur">
        <div className="mx-auto flex flex-wrap items-center gap-2 px-3 py-2" style={{ maxWidth: mm(Math.max(size.w, 250)) }}>
          {back && <Link to={back} className="btn-secondary"><ArrowLeft size={16} /> {t('back')}</Link>}
          {controls}
          <div className="seg" role="group" aria-label={t('printLanguage')}>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
            <button type="button" aria-pressed={lang === 'vi'} onClick={() => setLang('vi')}>Tiếng Việt</button>
          </div>
          <div className="flex-1" />
          <span className="hidden text-xs text-slate-500 xl:inline">{orientation === 'portrait' ? t('printFitsPortrait') : t('printFits')}</span>
          <button className="btn-primary" disabled={loading || !sheets.length} onClick={() => window.print()}><Printer size={16} /> {t('print')}</button>
        </div>
      </div>
      {error && <p className="no-print mx-auto px-3 pt-3 text-sm text-red-600" style={{ maxWidth: mm(size.w) }}>{error}</p>}
      {loading ? <Spinner /> : !sheets.length ? <div className="p-6"><Empty text={empty || t('noData')} /></div> : (
        <div className="ps-zoom py-6 print:py-0" style={{ zoom }}>
          {sheets.map((blocks, i) => (
            <section key={i} className="ps-sheet" style={{ width: mm(size.w), height: mm(size.h) }}>
              {i > 0 && <RunningHead text={running} />}
              {blocks.map((b, j) => <div key={j}>{renderBlock(b)}</div>)}
              <div className="absolute inset-x-[12mm] bottom-[8mm] flex items-end justify-between gap-4 border-t border-slate-200 pt-[1.6mm] text-[6.5pt] text-slate-500" style={{ height: mm(6) }}>
                {footLeft?.(blocks) || <span>Palm River Academy  ·  The Current</span>}
                <span className="whitespace-nowrap">{T('printedOn', { date: printed })}{by ? `  ·  ${by}` : ''}  ·  {T('pageOf', { n: i + 1, total: sheets.length })}</span>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/** The printout language: ?lang=vi|en, else the app's. */
export function usePrintLang(params, setParams) {
  const { lang: appLang } = useT()
  const lang = params.get('lang') === 'vi' || (!params.get('lang') && appLang === 'vi') ? 'vi' : 'en'
  const setParam = (k, v) => setParams((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n }, { replace: true })
  return { lang, setLang: (l) => setParam('lang', l), setParam }
}

function RunningHead({ text }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200" style={{ height: mm(RUN - 4), marginBottom: mm(4) }}>
      <div className="truncate pr-4 text-[8pt] text-slate-500">{text}</div>
      <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" style={{ height: '5.5mm' }} />
    </div>
  )
}

/** Title block with the logo and the brand rule under it. */
export function Masthead({ overline, title, sub }) {
  return (
    <div className="flex flex-col" style={{ height: mm(H.masthead) }}>
      <div className="flex items-start justify-between gap-8">
        <div className="min-w-0">
          <div className="text-[7.5pt] font-bold uppercase tracking-[0.18em] text-pra-blue">{overline}</div>
          <div className="mt-[1mm] text-[21pt] font-black leading-none tracking-tight text-pra-navy">{title}</div>
          <div className="mt-[2.2mm] truncate text-[8.5pt] text-slate-500">{sub}</div>
        </div>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Palm River Academy" style={{ height: '13mm' }} className="flex-none" />
      </div>
      <div className="ps-rule mb-[5mm] mt-auto" />
    </div>
  )
}

/**
 * The row of headline figures. A tile: { label, value, tone, of, hint, warn,
 * mark (a colour square before the label), bar: { pct, color } }.
 */
export function KpiTiles({ tiles }) {
  return (
    <div className="grid gap-[3.5mm]" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))`, height: mm(H.kpis - 4.5), marginBottom: mm(4.5) }}>
      {tiles.map((x) => (
        <div key={x.label} className="flex min-w-0 flex-col rounded-[2.2mm] border border-slate-200 bg-white px-[3.5mm] py-[2.4mm]">
          <div className="flex items-center gap-[1.4mm] truncate text-[6.5pt] font-bold uppercase tracking-[0.08em] text-slate-500">
            {x.mark && <span className="inline-block h-[2.2mm] w-[2.2mm] flex-none rounded-[0.5mm]" style={{ background: x.mark }} />}{x.label}
          </div>
          <div className="flex items-baseline gap-[2mm]">
            <div className={`mt-[0.6mm] truncate font-black leading-none tabular-nums ${x.small ? 'text-[14pt]' : 'text-[18pt]'} ${x.tone || 'text-slate-800'}`}>{x.value}{x.of != null ? <span className="text-[10pt] font-bold text-slate-400"> / {x.of}</span> : null}</div>
            {x.bar && <div className="mb-[1mm] h-[1.4mm] min-w-[8mm] flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, x.bar.pct))}%`, background: x.bar.color }} /></div>}
          </div>
          <div className={`mt-auto text-[6.5pt] leading-[1.2] text-slate-500 ${x.warn ? 'truncate' : 'line-clamp-2'}`}>{x.hint}</div>
          {x.warn && <div className="truncate text-[6.5pt] font-semibold leading-tight text-amber-700">{x.warn}</div>}
        </div>
      ))}
    </div>
  )
}

export function SectionTitle({ children, right }) {
  return (
    <div className="flex items-baseline justify-between gap-4" style={{ height: mm(H.title) }}>
      <h2 className="truncate text-[9.5pt] font-extrabold text-slate-800">{children}</h2>
      {right && <div className="flex-none text-[7pt] text-slate-500">{right}</div>}
    </div>
  )
}

/**
 * A list that can run over several sheets: a title, column heads, rows and, on
 * the last part, an optional total line. `cols`: [{ label, w (grid track),
 * right, cell(row) }]; `foot`: cells for the total line, one per column.
 */
export const listBlock = ({ type, rows, title, cols, foot, empty, row = H.listRow, min = 3, newSheet, ...rest }) => (rows.length
  ? { type, rows, title, cols, foot, row, min, newSheet, ...rest, head: () => H.title + H.listHead, tail: (last) => (last && foot ? H.listRow : 0) + H.gap }
  : { type, rows: null, title, empty, newSheet, ...rest, h: H.title + 6 + H.gap })

export function ListBlock({ b, T }) {
  const template = b.cols?.map((c) => c.w).join(' ')
  return (
    <div style={{ height: mm(b.h - H.gap), marginBottom: mm(H.gap) }}>
      <SectionTitle right={b.first !== false ? b.right : null}>{b.title}{b.rows && !b.first && <span className="font-normal text-slate-400"> ({T('continued')})</span>}</SectionTitle>
      {!b.rows ? (
        <div className="flex items-center gap-[1.5mm] text-[8pt] text-slate-500"><Check size={13} className="text-green-600" /> {b.empty}</div>
      ) : (<>
        <div className="ps-thead grid items-end" style={{ gridTemplateColumns: template, height: mm(H.listHead) }}>
          {b.cols.map((c, i) => <span key={i} className={`truncate ${c.right ? 'text-right' : ''}`}>{c.label}</span>)}
        </div>
        {b.rows.map((r, k) => (
          <div key={k} className="ps-row grid items-center" style={{ gridTemplateColumns: template, height: mm(typeof b.row === 'function' ? b.row(r) : b.row) }}>
            {b.cols.map((c, i) => <span key={i} className={`min-w-0 truncate ${c.right ? 'text-right tabular-nums' : ''} ${c.className || ''}`}>{c.cell(r)}</span>)}
          </div>
        ))}
        {b.last && b.foot && (
          <div className="ps-row ps-total grid items-center" style={{ gridTemplateColumns: template, height: mm(H.listRow) }}>
            {b.foot.map((f, i) => <span key={i} className={`min-w-0 truncate ${b.cols[i]?.right ? 'text-right tabular-nums' : ''}`}>{f}</span>)}
          </div>
        )}
      </>)}
    </div>
  )
}

/** Horizontal bars, one per row: [{ label, sub, value, shown, color }]. */
export function HBars({ rows, max, labelW = 34, valueW = 20, rowH = H.tableRow }) {
  const top = max || Math.max(1, ...rows.map((r) => r.value))
  return (
    <div>
      {rows.map((r) => (
        <div key={r.label} className="grid items-center gap-[2mm] border-b border-slate-100 text-[8pt]" style={{ gridTemplateColumns: `${labelW}mm minmax(0,1fr) ${valueW}mm`, height: mm(rowH) }}>
          <span className="truncate"><b className="text-slate-700">{r.label}</b>{r.sub && <span className="text-slate-400">  ·  {r.sub}</span>}</span>
          <span className="h-[1.8mm] overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full" style={{ width: `${(r.value / top) * 100}%`, background: r.color || BLUE }} /></span>
          <b className="text-right tabular-nums text-slate-700">{r.shown ?? r.value}</b>
        </div>
      ))}
    </div>
  )
}

const topRounded = (x, y, w, h, r) => {
  const q = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + q}Q${x},${y} ${x + q},${y}H${x + w - q}Q${x + w},${y} ${x + w},${y + q}V${y + h}Z`
}

/**
 * Columns for a few series over time. `bins`: [{ key, label, values: [n…] }];
 * `series`: [{ label, color }] in the same order. Stacked puts each series on the
 * one before (the first on the baseline); otherwise they stand side by side.
 * `labels`: 'all' writes each column's total above it, 'max' only the largest.
 * `strong`: the key of a column to keep at full colour while the rest fade.
 */
export function ColumnChart({ bins, series, width, height, stacked = false, labels = 'all', format = String, strong, emptyText }) {
  const totals = bins.map((b) => (stacked ? b.values.reduce((a, v) => a + v, 0) : Math.max(...b.values)))
  const max = Math.max(0, ...totals)
  if (!bins.length || !max) {
    return (
      <div className="flex items-center justify-center gap-[2mm] rounded-[2mm] border border-dashed border-slate-200 text-[8pt] text-slate-500" style={{ height: mm(height) }}>
        <Check size={14} className="text-green-600" /> {emptyText}
      </div>
    )
  }
  // Gridlines on round numbers: 1, 2, 5, 10, 20, 50…
  const raw = max / 4
  const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)))
  const step = [1, 2, 5, 10].map((f) => f * mag).find((v) => v >= raw) || 10 * mag
  const top = step * Math.ceil(max / step)
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const pad = { l: Math.max(6, Math.max(...ticks.map((v) => format(v).length)) * 1.3 + 1.5), r: 1, t: series.length > 1 ? 9 : 5, b: 6 }
  const pw = width - pad.l - pad.r, ph = height - pad.t - pad.b
  const slot = pw / bins.length
  const y = (v) => pad.t + ph - (v / top) * ph
  const most = totals.indexOf(max)
  const font = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
  const groupW = Math.min(stacked ? 4.6 : 9, slot * (stacked ? 0.64 : 0.72))
  const barW = stacked ? groupW : (groupW - 0.5 * (series.length - 1)) / series.length
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: mm(width), height: mm(height), display: 'block' }} fontFamily={font}>
      {series.length > 1 && (
        <g fontSize="2.3" fill="#64748b">
          {series.map((s, i) => {
            const x = width - (series.length - i) * 22
            return <g key={s.label}><rect x={x} y="0.6" width="2.4" height="2.4" rx="0.4" fill={s.color} /><text x={x + 3.2} y="2.6">{s.label}</text></g>
          })}
        </g>
      )}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke={v ? '#eef2f6' : '#cbd5e1'} strokeWidth={v ? 0.18 : 0.25} />
          <text x={pad.l - 1.4} y={y(v) + 0.8} fontSize="2.2" textAnchor="end" fill="#94a3b8">{format(v)}</text>
        </g>
      ))}
      {bins.map((b, i) => {
        const x0 = pad.l + i * slot + (slot - groupW) / 2
        const faded = strong && b.key !== strong ? 0.45 : 1
        let marks
        if (stacked) {
          let acc = 0
          const shown = b.values.map((v, k) => ({ v, k })).filter((s) => s.v > 0)
          marks = shown.map(({ v, k }, j) => {
            const y1 = y(acc + v), y0 = y(acc)
            acc += v
            const gap = j > 0 ? 0.45 : 0
            const h = Math.max(0.3, y0 - y1 - gap)
            return j === shown.length - 1
              ? <path key={k} d={topRounded(x0, y1, groupW, h, 0.7)} fill={series[k].color} />
              : <rect key={k} x={x0} y={y1} width={groupW} height={h} fill={series[k].color} />
          })
        } else {
          marks = b.values.map((v, k) => (v > 0 ? <path key={k} d={topRounded(x0 + k * (barW + 0.5), y(v), barW, y(0) - y(v), 0.6)} fill={series[k].color} /> : null))
        }
        const total = totals[i]
        // Side by side, each bar carries its own figure: only on the column in focus (or on few columns), so they never collide.
        const ownLabels = !stacked && labels !== 'none' && ((strong && b.key === strong) || (!strong && bins.length <= 6))
        return (
          <g key={b.key} opacity={faded}>
            {marks}
            {stacked && total > 0 && (labels === 'all' || (labels === 'max' && i === most)) && <text x={x0 + groupW / 2} y={y(total) - 1} fontSize="2.1" textAnchor="middle" fill="#475569" fontWeight="700">{format(total)}</text>}
            {ownLabels && (() => {
              // Two figures at about the same height would overlap: the later one moves up a line.
              const ly = []
              return b.values.map((v, k) => {
                if (!(v > 0)) return null
                ly[k] = y(v) - 1
                const prev = ly.slice(0, k).filter((n) => n != null).pop()
                if (prev != null && Math.abs(ly[k] - prev) < 2.6) ly[k] = Math.min(ly[k], prev) - 2.6
                return <text key={`l${k}`} x={x0 + k * (barW + 0.5) + barW / 2} y={ly[k]} fontSize="2.1" textAnchor="middle" fill="#475569" fontWeight="700">{format(v)}</text>
              })
            })()}
            {b.label && <text x={x0 + groupW / 2} y={height - 2} fontSize="2.1" textAnchor="middle" fill={strong && b.key === strong ? '#1f2937' : '#64748b'} fontWeight={strong && b.key === strong ? '700' : '400'}>{b.label}</text>}
          </g>
        )
      })}
    </svg>
  )
}
