// Offline preview only (`npm run dev -- --mode offline`): a few made-up lesson requests and
// class profiles, and part of the real book catalogue (lessonsSeedSources.js, from
// pra-triage/lessons/sources.json), so the Lessons page can be tried without the database.
// The page imports this file only in offline mode. No student names. Runs once per browser; delete
// localStorage 'pra-admin-lessons-seeded' to seed again.

import { db, dbMode } from './db'
import { SEED_SOURCES } from './lessonsSeedSources'

const SEEDED_KEY = 'pra-admin-lessons-seeded'

const PROFILES = [
  { class_key: 'math:Year 5', profile: { english_level: 'Most around A2; two newer students need key words in Vietnamese', vietnamese_support: true, devices_at_home: 'most', example_name: 'Mr. David', book_ids: ['wb-y5-math', 'lb-y5-math', 'tf-david-y5-math'], notes: 'Likes a short game at the end. Number lines on the board work well.' } },
  { class_key: 'science:Year 5', profile: { english_level: 'A2 to B1', vietnamese_support: false, devices_at_home: 'all', example_name: 'Ms. Kiu', book_ids: ['wb-y5-science', 'lb-y5-science', 'tf-kiu-y5-science'] } },
]

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const at = (n, h = 9) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.toISOString() }
const DAVID = 'david@pra.edu.vn'
const KIU = 'kiu@pra.edu.vn'
const status = (text, n, by = 'triage@pra.edu.vn', name = 'Lesson builder') => ({ at: at(n, 10), by, name, kind: 'status', text })

function requests() {
  const first = '5e550000-0000-4000-8000-000000000001'
  return [
    { id: first, number: 1, class_key: 'math:Year 5', teacher_email: DAVID, created_by: DAVID, created_at: at(-12), status: 'done', wants: ['slides', 'review', 'practice'],
      source: { book_id: 'wb-y5-math', unit: '4' }, details: { teach_on: day(-6), length_min: 45, homework_amount: 'small' },
      outputs: { slides: 'https://classroom.pra.edu.vn/david-y5-math/4/', plan: 'https://classroom.pra.edu.vn/david-y5-math/4/plan.pdf', review: 'https://learn.pra.edu.vn/y5-math/4/review', practice: 'https://learn.pra.edu.vn/y5-math/4/practice' },
      updates: [status('building', -10), status('ready', -8), { at: at(-7), by: DAVID, name: 'Mr. David', kind: 'comment', text: 'The number line warm-up worked well. Thank you.' }, status('done', -7, DAVID, 'Mr. David')], done_at: at(-7) },
    { id: '5e550000-0000-4000-8000-000000000002', number: 2, previous_id: first, class_key: 'math:Year 5', teacher_email: DAVID, created_by: DAVID, created_at: at(-4), status: 'ready', wants: ['slides', 'review', 'practice', 'worksheet'],
      source: { book_id: 'wb-y5-math', unit: '5', topic: 'Adding and subtracting with negative numbers', links: ['https://drive.google.com/file/d/sample-number-line-warm-up'] },
      details: { teach_on: day(2), length_min: 45, key_words: 'negative, positive, temperature, below zero, number line', hard: 'Subtracting a negative number. They mix up which way to move on the number line.', ideas: 'Temperatures in Hội An and Sa Pa in winter', homework_amount: 'medium', homework_due: day(5) },
      outputs: { slides: 'https://classroom.pra.edu.vn/david-y5-math/5/', plan: 'https://classroom.pra.edu.vn/david-y5-math/5/plan.pdf', review: 'https://learn.pra.edu.vn/y5-math/5/review', practice: 'https://learn.pra.edu.vn/y5-math/5/practice', worksheet: 'https://classroom.pra.edu.vn/david-y5-math/5/worksheet.pdf', note: 'The practice has 24 problems in three steps. The worksheet answers are on page 2.' },
      claimed_by: 'Bowen', updates: [status('building', -3), status('ready', -1)] },
    { id: '5e550000-0000-4000-8000-000000000003', number: 3, class_key: 'science:Year 5', teacher_email: KIU, created_by: KIU, created_at: at(-2), status: 'building', wants: ['slides', 'review', 'game'],
      source: { book_id: 'wb-y5-science', unit: '2', topic: 'How sound travels', links: ['https://drive.google.com/drive/folders/sample-string-telephone'] },
      details: { teach_on: day(4), length_min: 60, ideas: 'The string telephone experiment from last year' }, claimed_by: 'Bowen', updates: [status('building', -1)] },
    { id: '5e550000-0000-4000-8000-000000000004', number: 4, class_key: 'science:Year 5', teacher_email: KIU, created_by: KIU, created_at: at(-1), status: 'question', wants: ['slides', 'review', 'practice'],
      source: { topic: 'Why the Moon seems to change shape' }, details: { teach_on: day(7) },
      updates: [{ at: at(0, 8), by: 'triage@pra.edu.vn', name: 'Lesson builder', kind: 'question', text: 'Should this follow the Workbook unit on the Earth and Moon, or stand alone? Do the students already know that the Moon reflects light from the Sun?' }, status('question', 0)] },
    { id: '5e550000-0000-4000-8000-000000000005', number: 5, class_key: 'english:Year 7', teacher_email: DAVID, created_by: DAVID, created_at: at(0, 7), status: 'sent', wants: ['slides', 'worksheet'],
      source: { topic: 'Writing a persuasive paragraph: claim, reason, example', links: ['https://drive.google.com/file/d/sample-model-paragraph'] }, details: { teach_on: day(3), length_min: 45, avoid: 'Long reading texts' }, updates: [] },
    { id: '5e550000-0000-4000-8000-000000000006', number: 6, class_key: 'math:Year 3', teacher_email: 'caleb@pra.edu.vn', created_by: 'caleb@pra.edu.vn', created_at: at(-5), status: 'changes', wants: ['slides', 'practice'],
      source: { topic: 'Telling the time to five minutes' }, details: { teach_on: day(1) },
      outputs: { slides: 'https://classroom.pra.edu.vn/caleb-y3-math/time/', practice: 'https://learn.pra.edu.vn/y3-math/time/practice' },
      updates: [status('building', -4), status('ready', -2), { at: at(-1), by: 'caleb@pra.edu.vn', name: 'Mr. Caleb', kind: 'comment', text: 'Please use analogue clocks only, and fewer problems with quarter past.' }, status('changes', -1, 'caleb@pra.edu.vn', 'Mr. Caleb')] },
    { id: '5e550000-0000-4000-8000-000000000007', number: 7, class_key: 'science:Year 5', teacher_email: KIU, created_by: KIU, created_at: at(0, 8), status: 'draft', wants: ['slides', 'review', 'practice'],
      source: { book_id: 'wb-y5-science', unit: '3' }, details: {}, updates: [] },
  ]
}

/** Seeds the offline database once. Resolves true when it added anything. */
export async function seedLessonsOffline() {
  if (dbMode !== 'local') return false
  try { if (localStorage.getItem(SEEDED_KEY)) return false } catch { return false }
  const [rows, books, profiles] = await Promise.all([db.lessons.list(), db.lessons.sources.list(), db.lessons.profiles.list()])
  if (!books.length) await db.lessons.sources.saveMany(SEED_SOURCES)
  if (!profiles.length) for (const p of PROFILES) await db.lessons.profiles.save({ ...p, updated_by: 'david@pra.edu.vn' })
  if (!rows.length) for (const r of requests()) await db.lessons.save(r)
  try { localStorage.setItem(SEEDED_KEY, new Date().toISOString()) } catch { /* ignore */ }
  return true
}
