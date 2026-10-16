// The academic calendar and The Palm Press posts, as the website publishes them
// (pra.edu.vn/data/calendar.json and /data/writing.json), so the editor can offer
// them without anyone typing them again. While the website does not have them
// yet, or cannot be reached, the copy below (from the 2026-2027 calendar on the
// website, 16 October 2026) is used.

import { SITE } from './constants.js'

// tag: off = no classes, fees = money due, event = something families come to or should know.
const CALENDAR_2026_27 = [
  { id: 'first-day', iso: '2026-08-04', en: 'First day of the academic year', vi: 'Ngày đầu tiên của năm học', tag: '' },
  { id: 'independence', iso: '2026-08-31', end: '2026-09-02', en: 'Independence Day holiday', vi: 'Nghỉ lễ Quốc khánh 2/9', tag: 'off' },
  { id: 'q1-end', iso: '2026-10-08', en: 'End of Quarter 1. Quarter 2 tuition due', vi: 'Kết thúc Quý 1. Hạn đóng học phí Quý 2', tag: 'fees' },
  { id: 'fall-break', iso: '2026-10-09', end: '2026-10-14', en: 'Fall break', vi: 'Kỳ nghỉ thu', tag: 'off' },
  { id: 'q2-start', iso: '2026-10-15', en: 'Quarter 2 begins', vi: 'Quý 2 bắt đầu', tag: '' },
  { id: 'closed-nov24', iso: '2026-11-24', en: 'PRA closed', vi: 'Trung tâm nghỉ', tag: 'off' },
  { id: 'q2-end', iso: '2026-12-17', en: 'End of Quarter 2. Quarter 3 tuition due', vi: 'Kết thúc Quý 2. Hạn đóng học phí Quý 3', tag: 'fees' },
  { id: 'winter', iso: '2026-12-18', end: '2027-01-04', en: 'Winter holiday', vi: 'Kỳ nghỉ đông', tag: 'off' },
  { id: 'q3-start', iso: '2027-01-05', en: 'Quarter 3 begins', vi: 'Quý 3 bắt đầu', tag: '' },
  { id: 'makeup-jan29', iso: '2027-01-29', en: 'Make-up day if weather has closed PRA earlier in the year', vi: 'Ngày học bù, nếu trước đó trung tâm phải nghỉ vì thời tiết', tag: 'event' },
  { id: 'makeup-feb', iso: '2027-02-01', end: '2027-02-02', en: 'Make-up days if weather has closed PRA earlier in the year', vi: 'Ngày học bù, nếu trước đó trung tâm phải nghỉ vì thời tiết', tag: 'event' },
  { id: 'tet', iso: '2027-02-03', end: '2027-02-15', en: 'Tết holiday', vi: 'Nghỉ Tết Nguyên Đán', tag: 'off' },
  { id: 'q4-fees', iso: '2027-03-22', en: 'Quarter 4 tuition due', vi: 'Hạn đóng học phí Quý 4', tag: 'fees' },
  { id: 'q3-end', iso: '2027-03-24', en: 'End of Quarter 3', vi: 'Kết thúc Quý 3', tag: '' },
  { id: 'closed-mar26', iso: '2027-03-26', en: 'PRA closed', vi: 'Trung tâm nghỉ', tag: 'off' },
  { id: 'hung-kings', iso: '2027-04-16', en: "Hùng Kings' Commemoration Day", vi: 'Giỗ Tổ Hùng Vương', tag: 'off' },
  { id: 'spring', iso: '2027-04-26', end: '2027-04-30', en: 'Spring break and Reunification Day', vi: 'Kỳ nghỉ xuân và lễ 30/4', tag: 'off' },
  { id: 'last-day', iso: '2027-06-04', en: 'Last day of the academic year', vi: 'Ngày cuối cùng của năm học', tag: '' },
]
const WRITING = [
  { title: 'The First 20 of the Periodic Table Project', author: 'Amada', url: `${SITE}/writing/the-first-20-of-the-periodic-table/`, date: '2026-10-10', blurb_en: 'Amada, Year 7, on making a periodic table poster in Art of Science.', blurb_vi: 'Amada, lớp 7, kể về tấm áp phích bảng tuần hoàn trong giờ Art of Science.' },
]

const TAGS = { 'no classes': 'off', fees: 'fees', 'make-up days': 'event' }
const normEvent = (e, i) => ({
  id: String(e.id || `${e.iso}-${i}`), iso: String(e.iso || '').slice(0, 10), end: e.end ? String(e.end).slice(0, 10) : null,
  en: String(e.en || e.what || ''), vi: String(e.vi?.what ?? e.vi ?? ''), tag: TAGS[e.tag] ?? (['off', 'fees', 'event', ''].includes(e.tag) ? e.tag : ''),
})

let calendarPromise = null
/** The academic calendar's events: [{ id, iso, end, en, vi, tag }], oldest first. */
export function academicCalendar() {
  calendarPromise ||= fetch(`${SITE}/data/calendar.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((j) => {
      const list = (Array.isArray(j) ? j : j.events || []).map(normEvent).filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.iso))
      return list.length ? list : CALENDAR_2026_27
    })
    .catch(() => CALENDAR_2026_27)
    .then((list) => [...list].sort((a, b) => a.iso.localeCompare(b.iso)))
  return calendarPromise
}

let writingPromise = null
/** The Palm Press posts, newest first: [{ title, author, url, date, blurb_en, blurb_vi }]. */
export function palmPressPosts() {
  writingPromise ||= fetch(`${SITE}/data/writing.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((j) => { const list = Array.isArray(j) ? j : j.posts || []; return list.length ? list : WRITING })
    .catch(() => WRITING)
    .then((list) => [...list].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))))
  return writingPromise
}

/** Calendar events from `from` up to `days` days later (a holiday that has started counts). */
export function upcoming(events, from, days = 70) {
  const until = new Date(Date.UTC(...from.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n)))) + days * 864e5).toISOString().slice(0, 10)
  return events.filter((e) => (e.end || e.iso) >= from && e.iso <= until)
}
