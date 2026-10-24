import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpRight, LoaderCircle, RefreshCw } from 'lucide-react'
import { useL } from '../components/newsletter/bits'
import { Card, Chip, Empty, PageHeader, Segmented } from '../components/ui'
import { PERIODS, COUNTING_SINCE, fetchWebStats, byDay, change, pageName, sources, countryName, vietnameseShare } from '../lib/webStats'

const CLOUDFLARE = 'https://dash.cloudflare.com/?to=/:account/web-analytics'
const SHORT_LIST = 8

/**
 * Who visits pra.edu.vn: visits and page views for the last 7, 30 or 90 days, by day,
 * and the most-read pages, where visitors came from, their countries and devices.
 * Counted by Cloudflare Web Analytics on the website; read through the web-stats function.
 */
export default function WebsiteStats() {
  const { L, lang } = useL()
  const [days, setDays] = useState(7)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const cache = useRef(new Map())

  const load = useCallback((d, fresh = false) => {
    if (!fresh && cache.current.has(d)) { setStats(cache.current.get(d)); setError(''); return }
    setLoading(true)
    fetchWebStats(d)
      .then((s) => { cache.current.set(d, s); setStats(s); setError('') })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load(days) }, [days, load])

  const fmt = (n, opts) => n.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-GB', opts)
  const nothing = stats && stats.totals.views === 0

  return (
    <div className="space-y-5">
      <PageHeader title={L('Website', 'Trang web')}
        subtitle={L('Who visits pra.edu.vn, counted by Cloudflare without cookies. Nobody is identified.', 'Lượt truy cập pra.edu.vn, do Cloudflare đếm mà không dùng cookie và không nhận diện ai.')}>
        <a className="btn-secondary" href={CLOUDFLARE} target="_blank" rel="noreferrer">Cloudflare<ArrowUpRight size={15} /></a>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={days} onChange={setDays} options={PERIODS.map((d) => ({ value: d, label: L(`Last ${d} days`, `${d} ngày qua`) }))} />
        <button type="button" className="btn-ghost" onClick={() => load(days, true)} disabled={loading} aria-label={L('Refresh', 'Làm mới')}>
          {loading ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}{L('Refresh', 'Làm mới')}
        </button>
      </div>

      {stats?.sample && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{L('Offline testing: these numbers are made up.', 'Đang thử ngoại tuyến: các số liệu này là giả.')}</p>}
      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!stats && loading && <div className="flex justify-center p-10"><LoaderCircle size={28} className="animate-spin text-slate-300" /></div>}

      {stats && (
        // While another period loads, the old numbers stay, dimmed, so nothing jumps.
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <Tiles stats={stats} L={L} fmt={fmt} />
          {nothing
            ? <Empty text={L(`Nothing counted in the last ${stats.days} days yet. The counter has been on the website since ${fmtDate(COUNTING_SINCE, 'en')}.`, `Chưa có lượt truy cập nào trong ${stats.days} ngày qua. Bộ đếm có trên trang web từ ngày ${fmtDate(COUNTING_SINCE, 'vi')}.`)} />
            : <>
              <DaysChart stats={stats} L={L} lang={lang} fmt={fmt} />
              <div className="grid gap-5 lg:grid-cols-2">
                <PagesCard stats={stats} L={L} fmt={fmt} />
                <SourcesCard stats={stats} L={L} fmt={fmt} />
                <ListCard title={L('Countries', 'Quốc gia')} subtitle={L('Page views', 'Lượt xem trang')} fmt={fmt}
                  rows={stats.countries.map((r) => ({ name: countryName(r.key, lang) || L('Not known', 'Không rõ'), value: r.views }))} />
                <ListCard title={L('Devices', 'Thiết bị')} subtitle={L('Page views', 'Lượt xem trang')} fmt={fmt}
                  rows={stats.devices.map((r) => ({ name: deviceName(r.key, L), value: r.views }))} />
              </div>
            </>}
          <About stats={stats} L={L} />
        </div>
      )}
    </div>
  )
}

// Short dates are "24 Oct" in English and "24/10" in Vietnamese ("24 thg 10" reads oddly).
const fmtDate = (iso, lang, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB',
    { ...opts, ...(lang === 'vi' && opts.month === 'short' ? { month: 'numeric' } : {}), timeZone: 'UTC' })

function deviceName(key, L) {
  if (key === 'mobile') return L('Phone', 'Điện thoại')
  if (key === 'desktop') return L('Computer', 'Máy tính')
  if (key === 'tablet') return L('Tablet', 'Máy tính bảng')
  return key || L('Not known', 'Không rõ')
}

// ---------------- the four numbers at the top ----------------

function Tiles({ stats, L, fmt }) {
  const { totals, before, days } = stats
  const perVisit = totals.visits ? fmt(totals.views / totals.visits, { maximumFractionDigits: 1 }) : null
  const vi = vietnameseShare(stats.pages)
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label={L('Visits', 'Lượt truy cập')} value={fmt(totals.visits)} delta={<Delta now={totals.visits} before={before.visits} days={days} L={L} />} />
      <Tile label={L('Page views', 'Lượt xem trang')} value={fmt(totals.views)} delta={<Delta now={totals.views} before={before.views} days={days} L={L} />} />
      <Tile label={L('Pages per visit', 'Số trang mỗi lượt')} value={perVisit ?? '–'} note={L('How far people read', 'Mỗi lượt xem bao nhiêu trang')} />
      <Tile label={L('Read in Vietnamese', 'Đọc bằng tiếng Việt')} value={vi === null ? '–' : `${vi}%`} note={L('Of page views', 'Trên tổng lượt xem trang')} />
    </div>
  )
}

function Tile({ label, value, delta, note }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black tracking-tight text-slate-800">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{delta || note}</p>
    </div>
  )
}

function Delta({ now, before, days, L }) {
  const pct = change(now, before)
  if (pct === null) return now ? L(`None in the ${days} days before`, `${days} ngày trước đó: chưa có`) : null
  if (pct === 0) return L(`Same as the ${days} days before`, `Bằng ${days} ngày trước đó`)
  const up = pct > 0
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span>
      <span className={`inline-flex items-center gap-0.5 align-bottom font-semibold ${up ? 'text-green-700' : 'text-red-600'}`}><Icon size={12} />{Math.abs(pct)}%</span>
      {' '}{L(`on the ${days} days before`, `so với ${days} ngày trước đó`)}
    </span>
  )
}

// ---------------- visits per day ----------------

/** Clean steps for the side of the chart: 0, 5, 10, 15 rather than 0, 4.3, 8.6. */
function ticks(max) {
  if (max <= 0) return [0, 1]
  const raw = max / 3
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
}

function DaysChart({ stats, L, lang, fmt }) {
  const [show, setShow] = useState('visits')
  const [hover, setHover] = useState(null)
  const rows = byDay(stats)
  const steps = ticks(Math.max(...rows.map((r) => r[show])))
  const top = steps[steps.length - 1]
  const every = rows.length <= 10 ? 1 : rows.length <= 31 ? 5 : 15
  const dayLabel = (d, opts) => fmtDate(d, lang, opts)
  const tip = hover !== null ? rows[hover] : null
  const what = show === 'visits' ? L('Visits per day', 'Lượt truy cập mỗi ngày') : L('Page views per day', 'Lượt xem trang mỗi ngày')

  return (
    <Card title={what} subtitle={L('Vietnam time. Point at a day for its numbers.', 'Theo giờ Việt Nam. Trỏ vào một ngày để xem số liệu.')}
      actions={<Segmented className="flex-none whitespace-nowrap" value={show} onChange={setShow} options={[{ value: 'visits', label: L('Visits', 'Truy cập') }, { value: 'views', label: L('Page views', 'Xem trang') }]} />}>
      <div className="mt-6 flex gap-2">
        {/* The side scale */}
        <div className="relative h-48 w-8 flex-none text-right text-[11px] tabular-nums text-slate-400">
          {steps.map((s) => <span key={s} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(s / top) * 100}%` }}>{fmt(s)}</span>)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-48" onPointerLeave={() => setHover(null)}>
            {steps.map((s) => <div key={s} className="absolute inset-x-0 border-t border-slate-100" style={{ bottom: `${(s / top) * 100}%` }} />)}
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {rows.map((r, i) => (
                <button key={r.date} type="button" className="group relative flex h-full min-w-0 flex-1 items-end justify-center focus:outline-none"
                  aria-label={`${dayLabel(r.date, { weekday: 'short', day: 'numeric', month: 'short' })}: ${r.visits} ${L('visits', 'lượt truy cập')}, ${r.views} ${L('page views', 'lượt xem trang')}`}
                  onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
                  <span className={`block w-full max-w-[24px] rounded-t-[4px] transition-colors ${hover === i ? 'bg-pra-navy' : 'bg-pra-blue'} group-focus-visible:ring-2 group-focus-visible:ring-pra-sky`}
                    style={{ height: r[show] ? `max(2px, ${(r[show] / top) * 100}%)` : 0 }} />
                </button>
              ))}
            </div>
            {tip && (
              <div className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg"
                style={{ left: `clamp(70px, ${((hover + 0.5) / rows.length) * 100}%, calc(100% - 70px))` }}>
                <p className="font-semibold">{dayLabel(tip.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                <p><b className="text-sm">{fmt(tip.visits)}</b> <span className="text-slate-300">{L('visits', 'lượt truy cập')}</span></p>
                <p><b className="text-sm">{fmt(tip.views)}</b> <span className="text-slate-300">{L('page views', 'lượt xem trang')}</span></p>
              </div>
            )}
          </div>
          {/* Dates under the bars */}
          <div className="relative mt-1 h-4 text-[11px] text-slate-400">
            {rows.map((r, i) => (i % every === 0 || i === rows.length - 1) && (rows.length - 1 - i >= every / 2 || i === rows.length - 1) && (
              // The first and last dates line up with the chart's edges so they are never cut off.
              <span key={r.date} className={`absolute whitespace-nowrap ${i === 0 && rows.length > 10 ? '' : i === rows.length - 1 && rows.length > 10 ? '-translate-x-full' : '-translate-x-1/2'}`}
                style={{ left: rows.length > 10 && (i === 0 || i === rows.length - 1) ? `${(i / (rows.length - 1)) * 100}%` : `${((i + 0.5) / rows.length) * 100}%` }}>
                {rows.length <= 10 && lang !== 'vi' ? dayLabel(r.date, { weekday: 'short', day: 'numeric' }) : dayLabel(r.date, { day: 'numeric', month: 'short' })}
              </span>
            ))}
          </div>
        </div>
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700">{L('Day by day as a table', 'Xem từng ngày dạng bảng')}</summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="px-3 py-1.5 font-semibold">{L('Day', 'Ngày')}</th><th className="px-3 py-1.5 text-right font-semibold">{L('Visits', 'Lượt truy cập')}</th><th className="px-3 py-1.5 text-right font-semibold">{L('Page views', 'Lượt xem trang')}</th></tr></thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.date} className="border-t border-slate-100"><td className="px-3 py-1.5">{dayLabel(r.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td><td className="px-3 py-1.5 text-right tabular-nums">{fmt(r.visits)}</td><td className="px-3 py-1.5 text-right tabular-nums">{fmt(r.views)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  )
}

// ---------------- the lists ----------------

/** A ranked list with a thin bar under each name: rows = [{ name, value, tag?, hint? }] */
function ListCard({ title, subtitle, rows, fmt, empty }) {
  const [all, setAll] = useState(false)
  const max = Math.max(1, ...rows.map((r) => r.value))
  const shown = all ? rows : rows.slice(0, SHORT_LIST)
  return (
    <Card title={title} subtitle={subtitle}>
      {!rows.length && <p className="text-sm text-slate-400">{empty}</p>}
      <ol className="space-y-2.5">
        {shown.map((r) => (
          <li key={`${r.name}-${r.hint || ''}`} title={r.hint}>
            <div className="flex items-baseline gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{r.name}</span>
              {r.tag}
              <span className="tabular-nums font-semibold text-slate-800">{fmt(r.value)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-pra-blue/10"><div className="h-full rounded-full bg-pra-blue" style={{ width: `${(r.value / max) * 100}%` }} /></div>
          </li>
        ))}
      </ol>
      {rows.length > SHORT_LIST && <ShowAll all={all} setAll={setAll} count={rows.length} />}
    </Card>
  )
}

function ShowAll({ all, setAll, count }) {
  const { L } = useL()
  return <button type="button" className="mt-3 text-xs font-semibold text-pra-blue hover:underline" onClick={() => setAll(!all)}>{all ? L('Show fewer', 'Thu gọn') : L(`Show all ${count}`, `Xem cả ${count}`)}</button>
}

function PagesCard({ stats, L, fmt }) {
  const rows = stats.pages.map((p) => {
    const { name, vi } = pageName(p.key, L('Home', 'Trang chủ'))
    return { name, hint: p.key, value: p.views, tag: vi ? <Chip tone="sky">VI</Chip> : null }
  })
  return <ListCard title={L('Most-read pages', 'Trang được xem nhiều nhất')} subtitle={L('Page views. VI is the Vietnamese page.', 'Lượt xem trang. VI là trang tiếng Việt.')} rows={rows} fmt={fmt} />
}

function SourcesCard({ stats, L, fmt }) {
  const rows = sources(stats.from, stats.host, L('Typed in, bookmarks or apps', 'Gõ địa chỉ, dấu trang hoặc ứng dụng')).map((s) => ({ name: s.name, value: s.visits }))
  return <ListCard title={L('Where visitors came from', 'Khách đến từ đâu')} subtitle={L('Visits', 'Lượt truy cập')} rows={rows} fmt={fmt}
    empty={L('No visits from outside yet.', 'Chưa có lượt truy cập nào từ bên ngoài.')} />
}

function About({ stats, L }) {
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-slate-500">
      <p>{L(
        'A visit is someone arriving at the website from somewhere else: a search, Facebook, a link in a message, or typing the address. Going on to other pages adds page views, not visits. Cloudflare counts without cookies and cannot tell who anyone is, so one parent on two days is two visits. People who block trackers are not counted, so the real numbers are a little higher.',
        'Một lượt truy cập là khi có người vào trang web từ nơi khác: từ Google, Facebook, một đường link trong tin nhắn, hoặc gõ địa chỉ. Xem tiếp các trang khác chỉ tăng lượt xem trang, không tăng lượt truy cập. Cloudflare đếm mà không dùng cookie và không biết ai là ai, nên một phụ huynh vào hai ngày khác nhau được tính là hai lượt. Người có chặn trình theo dõi sẽ không được đếm, nên số thật cao hơn một chút.',
      )}</p>
      <p>{L(
        `Counting started on ${fmtDate(COUNTING_SINCE, 'en')}. Cloudflare keeps about six months.`,
        `Bắt đầu đếm từ ngày ${fmtDate(COUNTING_SINCE, 'vi')}. Cloudflare lưu số liệu khoảng sáu tháng.`,
      )}{stats.sampled ? ` ${L('Some of these numbers are Cloudflare estimates.', 'Một số con số là ước tính của Cloudflare.')}` : ''}</p>
    </div>
  )
}
