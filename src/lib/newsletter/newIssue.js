// Starting a new issue: next Friday's, from the same newsletter's last issue
// (the reminders marked "every week" carry over, and a class left out last
// week is left out again; everything else starts empty, the closing words too,
// since they usually speak of that week) or from nothing. Every class of the
// newsletter gets its corner. The dates come from the academic calendar.

import { EDITIONS } from './constants.js'
import { addDays, fridayOf, quarterWeek, slugFor, todayHoiAn } from './dates.js'
import { itemsOf, sortParts } from './payload.js'
import { upcoming } from './calendarFeed.js'
import { sameTeacher } from '../schedule.js'

// Where the fixed parts sit; the parts in between are numbered 100, 200, …
export const POS = { dates: -30, reminders: -20, opening: -10, first: 100, step: 100, closing: 1e6 }
const nid = () => Math.random().toString(36).slice(2, 8)

/** The first Friday from today on that this newsletter has no issue for yet. */
export function nextFreeFriday(issues, edition, today = todayHoiAn()) {
  let d = fridayOf(today)
  const taken = new Set(issues.filter((i) => i.edition === edition).map((i) => String(i.issue_date).slice(0, 10)))
  while (taken.has(d)) d = addDays(d, 7)
  return d
}

/** A class corner for one class of the schedule, with its homeroom teacher. */
export function classCorner(cls, teachers = []) {
  const t = teachers.find((x) => sameTeacher(`${x.title || ''} ${x.name}`, cls.homeroom) || sameTeacher(x.name, cls.homeroom))
  return {
    type: 'class',
    data: { class_key: cls.key, class: cls.name, year_groups: cls.yearGroups || [], teacher: cls.homeroom || '', teacher_email: String(t?.email || '').toLowerCase(), en: { body: '', ask: '' }, vi: { body: '', ask: '' }, words: {}, photos: [] },
  }
}

/**
 * The row and parts of a new issue (not saved yet).
 * @param {object} o
 * @param {'post'|'ey'} o.edition
 * @param {string} o.date  the Friday, 'YYYY-MM-DD'
 * @param {'last'|'empty'} o.from
 * @param {object|null} o.last  the newsletter's latest issue with its parts: { issue, parts }
 * @param {object} o.calendar  the app's calendar (quarters, schoolYear)
 * @param {Array} o.events  the academic calendar's events (calendarFeed)
 * @param {object} o.schedule  the weekly schedule (classes and their homeroom teachers)
 * @param {Array} o.teachers
 */
export function newIssue({ edition, date, from, last, calendar, events = [], schedule, teachers }) {
  const ed = EDITIONS[edition]
  const { quarter, week } = quarterWeek(date, calendar)
  const school_year = calendar?.schoolYear || '2026-2027'
  const issue = { edition, issue_date: date, school_year, quarter, week, status: 'draft', settings: {}, email: {} }
  issue.slug = slugFor(issue)

  const lastParts = from === 'last' && last ? sortParts(last.parts) : []
  const lastOf = (type) => lastParts.find((p) => p.type === type)

  // Dates: the calendar's next ten weeks; the first three weeks are ticked.
  const soon = addDays(date, 21)
  const items = {}
  upcoming(events, date, 70).forEach((e, i) => {
    items[nid()] = { cal: e.id, iso: e.iso, end: e.end || null, en: e.en, vi: e.vi, tag: e.tag, on: e.iso <= soon, pos: i, vi_from: e.en }
  })

  const reminders = {}
  itemsOf(lastOf('reminders')).filter((it) => it.repeat).forEach((it, i) => {
    reminders[nid()] = { en: it.en || '', vi: it.vi || '', vi_from: it.vi_from ?? null, repeat: true, pos: i }
  })

  const classes = (schedule?.classes || []).filter((c) => ed.classes.includes(c.key))
  const corners = classes.map((c) => {
    const corner = classCorner(c, teachers)
    const was = lastParts.find((p) => p.type === 'class' && p.data?.class_key === c.key)
    if (was?.data?.skip) corner.data.skip = true
    return corner
  })

  const parts = [
    { type: 'dates', position: POS.dates, data: { items } },
    { type: 'reminders', position: POS.reminders, data: { items: reminders } },
    { type: 'opening', position: POS.opening, data: { en: { heading: '', body: '' }, vi: { heading: '', body: '' } } },
    ...corners.map((c, i) => ({ ...c, position: POS.first + i * POS.step })),
    { type: 'story', position: POS.first + corners.length * POS.step, data: { icon: 'book-open', en: { heading: '', when: '', body: '' }, vi: { heading: '', when: '', body: '' }, photos: [] } },
    { type: 'closing', position: POS.closing, data: { en: { body: '' }, vi: { body: '' } } },
  ]
  return { issue, parts }
}

/** The data a part starts with when it is added with "+ Add". */
export function blankPart(type) {
  switch (type) {
    case 'story': return { icon: 'book-open', en: { heading: '', when: '', body: '' }, vi: { heading: '', when: '', body: '' }, photos: [] }
    case 'photos': return { icon: 'camera', en: { heading: '' }, vi: { heading: '' }, photos: [] }
    case 'quote': return { en: { text: '', who: '' }, vi: { text: '', who: '' }, photos: [] }
    case 'press': return { title: '', author: '', url: '', en: { blurb: '' }, vi: { blurb: '' } }
    case 'welcome': return { en: { heading: 'Welcome to our new families', body: '' }, vi: { heading: 'Chào mừng các gia đình mới', body: '' }, names: [], vi_from: 'Welcome to our new families' }
    default: return {}
  }
}

/** The position between two neighbours (or after the last). */
export function positionBetween(before, after) {
  if (before == null && after == null) return POS.first
  if (before == null) return after - POS.step
  if (after == null || after >= POS.closing) return before + POS.step
  return (before + after) / 2
}
