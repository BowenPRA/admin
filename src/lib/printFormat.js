// Dates, numbers and plurals for the printed summaries (pages/Print*.jsx), in the
// printout's own language, which can differ from the app's.

import { fmt } from './money'

export const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTHS_LONG_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAY = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] }

export const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
/** 'YYYY-MM-DD' of a date column or a timestamp, in local time. */
export const dayKey = (v) => (!v ? '' : String(v).length > 10 ? isoOf(new Date(v)) : String(v).slice(0, 10))
export const dayOf = (d) => Number(d.slice(8, 10))
export const monthOf = (d) => Number(d.slice(5, 7))
export const weekday = (d, lang) => WEEKDAY[lang][new Date(`${d.slice(0, 10)}T00:00:00`).getDay()]
/** '3 Sep' / '3/9' */
export const shortDate = (d, lang) => (!d ? '' : lang === 'vi' ? `${dayOf(d)}/${monthOf(d)}` : `${dayOf(d)} ${MONTHS_EN[monthOf(d) - 1]}`)
/** '3 Sep 2026' / '3/9/2026' */
export const fullDate = (d, lang) => (!d ? '' : `${shortDate(d, lang)}${lang === 'vi' ? '/' : ' '}${d.slice(0, 4)}`)
/** 'Sep' / 'Th9' (chart labels) */
export const monthShort = (key, lang) => (lang === 'vi' ? `Th${Number(key.slice(5, 7))}` : MONTHS_EN[Number(key.slice(5, 7)) - 1])
/** 'September' / 'Tháng 9' */
export const monthLong = (key, lang) => (lang === 'vi' ? `Tháng ${Number(key.slice(5, 7))}` : MONTHS_LONG_EN[Number(key.slice(5, 7)) - 1])
/** 'September 2026' / 'Tháng 9/2026' */
export const monthYear = (key, lang) => (lang === 'vi' ? `Tháng ${Number(key.slice(5, 7))}/${key.slice(0, 4)}` : `${MONTHS_LONG_EN[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`)
/** First and last day of a 'YYYY-MM' month. */
export const monthRange = (key) => {
  const [y, m] = key.split('-').map(Number)
  return { from: `${key}-01`, to: isoOf(new Date(y, m, 0)) }
}
/** 'Sep 3, 4, 17 · Oct 2' / '3, 4, 17/9 · 2/10' */
export const dateList = (dates, lang) => {
  const byMonth = new Map()
  dates.forEach((d) => { const k = d.slice(0, 7); byMonth.set(k, [...(byMonth.get(k) || []), dayOf(d)]) })
  return [...byMonth].map(([k, days]) => (lang === 'vi' ? `${days.join(', ')}/${Number(k.slice(5))}` : `${MONTHS_EN[Number(k.slice(5)) - 1]} ${days.join(', ')}`)).join(' · ')
}
/** '1 October 2026' / '1/10/2026' */
export const longDate = (d, lang) => (lang === 'vi' ? `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}` : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))
export const num = (n, lang) => Number(n || 0).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')
/** "1 student", "3 students": English needs the singular key (<key>One); Vietnamese has one form. */
export const many = (T, key, n, lang) => T(n === 1 ? `${key}One` : key, { n: num(n, lang) })
/** Whole dong, as on the invoices: 12,500,000. */
export const vnd = (n) => fmt(n)
/** Short amounts for chart labels: '125.5M' / '125,5 tr', '850K' / '850 n'. */
export const vndShort = (n, lang) => {
  const v = Number(n) || 0
  const one = (x) => (Math.abs(x) >= 100 ? Math.round(x) : Math.round(x * 10) / 10).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')
  if (Math.abs(v) >= 1e9) return lang === 'vi' ? `${one(v / 1e9)} tỷ` : `${one(v / 1e9)}B`
  if (Math.abs(v) >= 1e6) return lang === 'vi' ? `${one(v / 1e6)} tr` : `${one(v / 1e6)}M`
  if (Math.abs(v) >= 1e3) return lang === 'vi' ? `${one(v / 1e3)} n` : `${one(v / 1e3)}K`
  return String(Math.round(v))
}
