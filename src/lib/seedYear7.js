import { db, genId } from './db'
import { ROSTER } from '../data/roster'
import { TEACHER_SCHEDULE } from '../data/staff'
import { normalizeCode } from './studentIds'
import { buildReport, buildSections } from './report/utils'

const SCORES = {
  'Amada':  { math: { raw: '40/50', pct: 80, level: 3 }, english: { raw: '43/50', pct: 86, level: 3 }, science: { raw: '38/50', pct: 76, level: 2 } },
  'Lily':   { math: { raw: '44/50', pct: 88, level: 4 }, english: { raw: '41/50', pct: 82, level: 3 }, science: { raw: '46/50', pct: 92, level: 4 } },
  'Oliver': { math: { raw: '32/50', pct: 64, level: 2 }, english: { raw: '28/50', pct: 56, level: 2 }, science: { raw: '35/50', pct: 70, level: 2 } },
  'Goku':   { math: { raw: '38/50', pct: 76, level: 3 }, english: { raw: '30/50', pct: 60, level: 2 }, science: { raw: '42/50', pct: 84, level: 3 } },
  'Su':     { math: { raw: '35/50', pct: 70, level: 2 }, english: { raw: '33/50', pct: 66, level: 2 }, science: { raw: '37/50', pct: 74, level: 3 } },
  'Ana':    { math: { raw: '29/50', pct: 58, level: 2 }, english: { raw: '36/50', pct: 72, level: 2 }, science: { raw: '31/50', pct: 62, level: 2 } },
  'Hunter': { math: { raw: '42/50', pct: 84, level: 3 }, english: { raw: '39/50', pct: 78, level: 3 }, science: { raw: '44/50', pct: 88, level: 3 } },
  'Erica':  { math: { raw: '36/50', pct: 72, level: 2 }, english: { raw: '38/50', pct: 76, level: 3 }, science: { raw: '33/50', pct: 66, level: 2 } },
  'Carrot': { math: { raw: '33/50', pct: 66, level: 2 }, english: { raw: '31/50', pct: 62, level: 2 }, science: { raw: '36/50', pct: 72, level: 2 } },
  'Nấm':   { math: { raw: '37/50', pct: 74, level: 3 }, english: { raw: '35/50', pct: 70, level: 2 }, science: { raw: '39/50', pct: 78, level: 3 } },
  'Tess':   { math: { raw: '30/50', pct: 60, level: 2 }, english: { raw: '34/50', pct: 68, level: 2 }, science: { raw: '32/50', pct: 64, level: 2 } },
}

const VOCATIONAL_LEVELS = {
  'Amada':  { art_of_science: 3, history: 2, executive_function: 2, technology: 3, wellbeing: 3 },
  'Lily':   { art_of_science: 3, history: 3, executive_function: 3, technology: 4, wellbeing: 4 },
  'Oliver': { art_of_science: 2, history: 2, executive_function: 2, technology: 2, wellbeing: 2 },
  'Goku':   { art_of_science: 3, history: 2, executive_function: 2, technology: 3, wellbeing: 2 },
  'Su':     { art_of_science: 2, history: 2, executive_function: 2, technology: 2, wellbeing: 3 },
  'Ana':    { art_of_science: 2, history: 2, executive_function: 1, technology: 2, wellbeing: 2 },
  'Hunter': { art_of_science: 3, history: 3, executive_function: 3, technology: 3, wellbeing: 3 },
  'Erica':  { art_of_science: 2, history: 2, executive_function: 2, technology: 2, wellbeing: 3 },
  'Carrot': { art_of_science: 2, history: 2, executive_function: 2, technology: 2, wellbeing: 2 },
  'Nấm':   { art_of_science: 3, history: 2, executive_function: 2, technology: 3, wellbeing: 3 },
  'Tess':   { art_of_science: 2, history: 2, executive_function: 1, technology: 2, wellbeing: 2 },
}

function teacherFor(subjectKey) {
  const t = TEACHER_SCHEDULE.find((t) => t.subjects.includes(`${subjectKey}:Year 7`))
  return t ? `${t.title} ${t.name}` : ''
}

const FULL_COMMENTS = {
  Amada: {
    math: { comment: 'Amada demonstrates a solid understanding of mathematical concepts and approaches problem-solving with growing confidence. She has shown particular strength in algebraic reasoning and is developing fluency with fraction operations. Amada actively participates in collaborative tasks and explains her thinking clearly to peers.', next_focus: 'Strengthening multi-step problem solving and applying mathematical reasoning to real-world contexts.' },
    english: { comment: 'Amada is a thoughtful and expressive writer who consistently crafts well-structured pieces with a strong personal voice. Her reading comprehension is excellent, and she engages deeply with texts during class discussions. Amada has developed confidence in presenting her ideas orally and supporting her arguments with evidence.', next_focus: 'Expanding use of literary techniques and developing critical analysis of more complex texts.' },
    science: { comment: 'Amada approaches scientific inquiry with curiosity and is building a strong foundation in experimental design. She records observations carefully and is learning to draw conclusions from data. While she sometimes needs prompting to connect concepts across topics, her effort and willingness to ask questions are commendable.', next_focus: 'Developing skills in forming and testing hypotheses independently.' },
    art_of_science: { comment: 'Amada brings creativity and precision to her scientific art projects, producing detailed and visually engaging work. She takes care to research her subjects thoroughly and has developed a strong eye for colour and composition in her illustrations.' },
    history: { comment: 'Amada is developing her ability to analyse historical sources and form opinions supported by evidence. She participates well in discussions about Vietnamese and world history and is learning to compare perspectives across time periods.' },
    executive_function: { comment: 'Amada is building organisational skills and learning to manage her time across multiple tasks effectively. She has made good progress with her planner and is beginning to break larger assignments into manageable steps independently.' },
    technology: { comment: 'Amada shows confidence with digital tools and applies her skills creatively in project-based learning. She has been particularly engaged with presentation software and is developing her understanding of responsible digital citizenship.' },
    wellbeing: { comment: 'Amada is a positive presence who supports her peers and demonstrates strong self-awareness. She contributes thoughtfully to our wellbeing circles and is developing strategies to manage her emotions during challenging moments.' },
    report: {
      glance: 'Amada has settled in well this quarter and approaches her learning with enthusiasm and determination. She is a kind and supportive member of our learning community who contributes positively to class discussions.',
      homeroom_note: 'Amada has had a wonderful start to the year. She brings a positive attitude to every session and is always willing to help her classmates. Her organisational skills have improved significantly, and she is becoming more independent in managing her learning. Amada\'s creativity shines through in group projects, and she is a valued member of our community.',
      skills: { ready: 3, instructions: 3, creativity: 3, grasps: 3, persists: 3, emotions: 3, relationships: 3, identity: 3, motivation: 3, adaptability: 2 },
      experiences: ['Participated in the community garden project', 'Led a group presentation on Vietnamese cultural heritage', 'Contributed to the Quarter 1 science fair'],
      student_voice: 'I really enjoyed the science experiments this quarter, especially when we got to work together in teams.',
    },
  },
  Lily: {
    math: { comment: 'Lily has shown exceptional mathematical ability this quarter, consistently demonstrating deep understanding of complex concepts. She works efficiently and accurately, often finishing tasks ahead of her peers and eagerly taking on extension challenges. Lily explains her reasoning with clarity and serves as a strong mathematical role model for the class.', next_focus: 'Exploring advanced problem-solving strategies and mathematical proofs at a higher level.' },
    english: { comment: 'Lily is a confident communicator who expresses her ideas with clarity and maturity. Her written work is well-organised and demonstrates a strong command of grammar and vocabulary. Lily participates actively in literature discussions and shows genuine engagement with the texts we explore in class.', next_focus: 'Developing persuasive writing techniques and expanding her use of figurative language.' },
    science: { comment: 'Lily is an outstanding science learner who approaches every investigation with genuine curiosity and rigour. She designs thorough experiments, analyses data critically, and draws well-supported conclusions. Lily frequently makes insightful connections between topics and asks thoughtful questions that deepen the learning for everyone.', next_focus: 'Pursuing independent research projects and presenting scientific findings to wider audiences.' },
    art_of_science: { comment: 'Lily combines scientific accuracy with artistic creativity, producing work that is both informative and visually striking. Her detailed diagrams and scientific illustrations demonstrate a deep understanding of the concepts she is representing.' },
    history: { comment: 'Lily engages thoughtfully with historical topics and contributes well-reasoned arguments in class discussions. She shows a genuine interest in understanding different perspectives and connects historical events to present-day issues with maturity.' },
    executive_function: { comment: 'Lily demonstrates strong organisational skills and manages her time effectively across all learning areas. She sets clear goals for herself, uses her planner consistently, and is a role model for self-directed learning in the classroom.' },
    technology: { comment: 'Lily is a confident and creative user of technology who often helps peers and explores new tools independently. She has taken a lead role in collaborative digital projects and shows excellent judgement in evaluating online sources.' },
    wellbeing: { comment: 'Lily is emotionally mature and a compassionate leader who actively supports the wellbeing of her peers. She facilitates group discussions with empathy and is always the first to check in on classmates who may be having a difficult day.' },
    report: {
      glance: 'Lily has had an outstanding quarter, excelling across all her learning areas while remaining a supportive and humble member of our community. Her dedication and curiosity are truly inspiring.',
      homeroom_note: 'Lily continues to impress with her dedication, curiosity, and kindness. She approaches every challenge with a positive mindset and consistently produces work of the highest standard. Beyond her academic achievements, Lily is a natural leader who lifts those around her. She volunteers to help classmates, asks thoughtful questions, and brings joy to our learning environment every day.',
      skills: { ready: 4, instructions: 4, creativity: 4, grasps: 4, persists: 4, emotions: 4, relationships: 4, identity: 3, motivation: 4, adaptability: 3 },
      experiences: ['Represented the learning community in the inter-school mathematics competition', 'Led the design team for the Quarter 1 science fair display', 'Mentored younger learners during buddy reading sessions'],
      student_voice: 'I loved the science fair project because I got to research something I was really passionate about and share it with everyone.',
    },
  },
}

export async function seedYear7() {
  const settings = await db.getReportSettings()
  const period = settings.periods[0]
  const template = settings.templates.lower_secondary

  // 1. Ensure Year 7 students are in the database
  let students = await db.students.list()
  const y7Roster = ROSTER.filter((r) => r.class_group === 'Year 7')
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
  const missing = y7Roster.filter((r) => !students.find((s) => normalizeCode(s.student_code) === normalizeCode(r.student_code) || norm(s.full_name) === norm(r.full_name)))
  if (missing.length) {
    const rows = missing.map((r) => ({ ...r, id: genId(), active: true }))
    await db.students.saveMany(rows)
    students = await db.students.list()
  }
  // Sync key fields from roster to all existing student records
  const rosterUpdates = []
  for (const r of ROSTER) {
    const existing = students.find((s) => normalizeCode(s.student_code) === normalizeCode(r.student_code) || norm(s.full_name) === norm(r.full_name))
    if (!existing) continue
    let changed = false
    for (const k of ['photo', 'level', 'class_group']) {
      if (r[k] && existing[k] !== r[k]) { existing[k] = r[k]; changed = true }
    }
    if (changed) rosterUpdates.push(existing)
  }
  if (rosterUpdates.length) await db.students.saveMany(rosterUpdates)

  const y7Students = students.filter((s) => s.class_group === 'Year 7' || y7Roster.some((r) => normalizeCode(r.student_code) === normalizeCode(s.student_code)))

  // 2. Create teachers
  const existing = await db.teachers.list()
  for (const t of TEACHER_SCHEDULE) {
    if (!existing.find((e) => e.email === t.email)) {
      await db.teachers.save({ ...t, id: genId(), active: true })
    }
  }

  // 3. Check for existing Q1 reports
  const existingReports = await db.reports.list({ school_year: settings.schoolYear, period_label: period.label })

  // 4. Build reports and sections
  const allReports = []
  const allSections = []
  const classAvgs = {}

  // Compute class averages from our scores
  for (const [, scores] of Object.entries(SCORES)) {
    for (const [subj, data] of Object.entries(scores)) {
      classAvgs[subj] = classAvgs[subj] || { sum: 0, n: 0 }
      classAvgs[subj].sum += data.pct
      classAvgs[subj].n++
    }
  }
  for (const k of Object.keys(classAvgs)) classAvgs[k] = Math.round(classAvgs[k].sum / classAvgs[k].n)

  const updatedReports = []
  const updatedSections = []

  for (const student of y7Students) {
    const nick = student.nickname
    const scores = SCORES[nick]
    if (!scores) continue

    const existingReport = existingReports.find((r) => r.student_id === student.id)
    let report, secs

    if (existingReport) {
      report = existingReport
      secs = await db.sections.list({ report_id: report.id })
    } else {
      report = buildReport(student, period, template, settings, 'Mr. Bowen')
      secs = buildSections(report.id, template, settings)
    }

    report.year_group = 'Year 7'

    // Fill in academic scores
    for (const sec of secs) {
      if (scores[sec.subject_key]) {
        const s = scores[sec.subject_key]
        sec.score_raw = s.raw
        sec.score_pct = s.pct
        sec.class_avg = classAvgs[sec.subject_key]
        sec.level = s.level
        sec.teacher_name = teacherFor(sec.subject_key)
      }
      const vocLevels = VOCATIONAL_LEVELS[nick]
      if (vocLevels && vocLevels[sec.subject_key] != null) {
        sec.level = vocLevels[sec.subject_key]
        sec.teacher_name = teacherFor(sec.subject_key)
      }
      const full = FULL_COMMENTS[nick]
      if (full && full[sec.subject_key]) {
        sec.comment = full[sec.subject_key].comment
        if (full[sec.subject_key].next_focus) sec.next_focus = full[sec.subject_key].next_focus
      }
    }

    // Homeroom data for Amada and Lily
    const full = FULL_COMMENTS[nick]
    if (full) {
      report.glance = full.report.glance
      report.homeroom_note = full.report.homeroom_note
      report.skills = full.report.skills
      report.experiences = full.report.experiences
      report.student_voice = full.report.student_voice
      report.report_date = '2026-10-08'
      report.homeroom_teacher = 'Mr. Bowen'
      report.signatures = [{ role: 'Homeroom Teacher', name: 'Mr. Bowen' }, { role: 'Head Teacher', name: 'Mr. Seth' }]
    }

    if (existingReport) {
      updatedReports.push(report)
      updatedSections.push(...secs)
    } else {
      allReports.push(report)
      allSections.push(...secs)
    }
  }

  if (allReports.length) {
    await db.reports.saveMany(allReports)
    await db.sections.saveMany(allSections)
  }
  if (updatedReports.length) {
    await db.reports.saveMany(updatedReports)
    await db.sections.saveMany(updatedSections)
  }

  // 5. Create course notes (topics covered this quarter)
  const COURSE_NOTES = {
    math: 'Algebraic expressions and equations; operations with fractions and decimals; ratio and proportion; introduction to geometry and area; data handling and basic statistics.',
    science: 'Scientific method and experimental design; properties of matter and states of matter; forces and motion; introduction to ecosystems and food chains; laboratory safety and equipment.',
    english: 'Narrative writing and short stories; reading comprehension strategies; grammar and sentence structure; oral presentation skills; vocabulary development through literature circles.',
  }
  const existingNotes = await db.courseNotes.list({ school_year: settings.schoolYear, period_label: period.label, year_group: 'Year 7' })
  for (const [key, description] of Object.entries(COURSE_NOTES)) {
    if (!existingNotes.find((n) => n.subject_key === key)) {
      await db.courseNotes.save({ id: genId(), school_year: settings.schoolYear, period_label: period.label, year_group: 'Year 7', subject_key: key, description, description_vi: '', teacher_name: teacherFor(key) })
    }
  }

  const total = allReports.length + updatedReports.length
  return { created: total, msg: `Created ${allReports.length} and updated ${updatedReports.length} Quarter 1 reports for Year 7 with scores, levels and comments.` }
}
