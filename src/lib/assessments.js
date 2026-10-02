// The Assessments tab: Cambridge and PRA assessment papers for Years 1-9 in
// Maths, Science and English.
//
// The PDFs are on the shared Google Drive, in Program curricula › Assessments
// Library (Subject › Year › type), so only members of the PRA shared drive can
// open them. The Current only holds the list: public/assessments/catalog.json,
// built by scripts/assessments/build_catalog.py. Nothing in it is a paper, so
// it can sit on the public site.

import { splitSubjectKey } from '../data/staff.js'

export const SUBJECTS = ['math', 'science', 'english']
export const SUBJECT_LABEL = { math: ['Maths', 'Toán'], science: ['Science', 'Khoa học'], english: ['English', 'Tiếng Anh'] }
// In the order teachers meet them through the year.
export const KINDS = {
  diagnostic: ['Diagnostic', 'Kiểm tra đầu vào'],
  end_of_unit: ['End of unit', 'Cuối bài'],
  mid_year: ['Mid-year', 'Giữa năm'],
  end_of_year: ['End of year', 'Cuối năm'],
  progress_test: ['Progress test', 'Kiểm tra tiến bộ'],
  progress_review: ['PRA progress review', 'Đánh giá tiến bộ PRA'],
  baseline: ['Baseline', 'Kiểm tra đầu khóa'],
  progression_test: ['Progression test', 'Progression Test'],
  sample_paper: ['Sample paper', 'Đề mẫu'],
  checkpoint: ['Checkpoint', 'Checkpoint'],
  // PRA's own practice packets that go home before an assessment (the Year 7 Quarter 1 reviews).
  review_packet: ['Review packet', 'Đề ôn tập'],
}
export const KIND_TONE = {
  diagnostic: 'sky', end_of_unit: 'slate', mid_year: 'amber', end_of_year: 'amber', progress_test: 'slate',
  progress_review: 'green', baseline: 'green', progression_test: 'navy', sample_paper: 'navy', checkpoint: 'red',
  review_packet: 'green',
}
export const YEARS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
export const label = (pair, lang) => (pair ? pair[lang === 'vi' ? 1 : 0] : '')

let catalogPromise = null
/** The list of assessments ({ built, folder, items }). Fetched once per page load. */
export function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(`${import.meta.env.BASE_URL}assessments/catalog.json`, { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(`The assessments list could not be loaded (${r.status}).`); return r.json() })
      .catch((e) => { catalogPromise = null; throw e })
  }
  return catalogPromise
}

/**
 * Where a file opens: the file itself on Google Drive once its id is in the catalog,
 * otherwise a Drive search for its name (each name in the library is unique).
 */
export function fileUrl(file) {
  if (file.id) return `https://drive.google.com/file/d/${file.id}/view`
  const name = file.drive.split('/').pop().replace(/\.pdf$/i, '')
  return `https://drive.google.com/drive/search?q=${encodeURIComponent(`"${name}"`)}`
}

// ---------------------------------------------------------------- finding things

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

/** Everything a search can match for one item, in English and Vietnamese. */
export function haystack(item) {
  // Years only as "y5" (the query turns "year 5" / "stage 5" / "lớp 5" into that), so a bare "3" means unit or paper 3.
  const years = item.years.map((y) => `y${y}`).join(' ')
  const subj = { math: 'maths math mathematics toan', science: 'science khoa hoc', english: 'english global english tieng anh esl' }[item.subject]
  const kind = KINDS[item.kind]?.join(' ') || ''
  const extra = {
    end_of_unit: 'end-of-unit unit test eou', mid_year: 'mid-year midpoint mid-point', end_of_year: 'end-of-year eoy final',
    progress_review: 'semester review exam', review_packet: 'review packet revision practice quarter q1 on tap', diagnostic: 'diagnostic check', progression_test: 'progression', checkpoint: 'checkpoint',
  }[item.kind] || ''
  const files = item.files.map((f) => f.label).join(' ')
  return norm([item.title, years, subj, kind, extra, item.course, item.session, item.note, item.source, files].filter(Boolean).join(' '))
}

/** Every word typed must match: "y5 unit 3", "science mid", "checkpoint 2024". */
export function matches(item, query, hay = haystack(item)) {
  const words = norm(query).replace(/\b(?:year|y|lop|stage)\s+(\d)\b/g, 'y$1').split(/\s+/).filter(Boolean)
  return words.every((w) => {
    const yr = /^y(\d)$/.exec(w)
    if (yr) return item.years.includes(Number(yr[1]))
    if (/^\d+$/.test(w)) return new RegExp(`(^|[^a-z0-9])${w}([^0-9]|$)`).test(hay)
    return hay.includes(w)
  })
}

/**
 * The (subject, year) pairs a teacher teaches, from their subjects in The Current
 * ('math:Year 5'). Subjects outside Maths, Science and English are ignored.
 */
export function myClasses(subjects) {
  const out = []
  for (const k of subjects || []) {
    const [subject, group] = splitSubjectKey(k)
    const y = /^Year (\d)$/.exec(group || '')
    if (SUBJECTS.includes(subject) && y) out.push({ subject, year: Number(y[1]) })
  }
  return out
}

export const forClasses = (item, classes) => classes.some((c) => c.subject === item.subject && item.years.includes(c.year))
