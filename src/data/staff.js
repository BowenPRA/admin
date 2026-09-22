// PRA staff for 2026-2027 and the classes each teacher teaches (Schedule
// 2026-2027). Subject keys are `learningArea:Year group`. The same list is in
// supabase/updates-2026-09-15.sql and scripts/create-staff-accounts.mjs; the
// Teachers page can add any of these rows that are missing.

export const ACCESS_ROLES = {
  super_admin: { label: 'Super Admin', label_vi: 'Quản trị cấp cao', tone: 'navy', summary: 'Everything, including fees, teachers and report settings.' },
  head: { label: 'Head Teacher', label_vi: 'Trưởng chuyên môn', tone: 'navy', summary: 'Everything, including fees, teachers and report settings.' },
  admin: { label: 'Admin', label_vi: 'Văn phòng', tone: 'sky', summary: 'Invoices, students, families, fees and attendance. Reports only where a learning area is assigned.' },
  teacher: { label: 'Teacher', label_vi: 'Giáo viên', tone: 'green', summary: 'Their own learning areas and homeroom parts of reports, and attendance for the year groups they teach.' },
  viewer: { label: 'View only', label_vi: 'Chỉ xem', tone: 'slate', summary: 'Signed in but not linked to any class yet.' },
}

export const OFFICE_ACCOUNTS = [
  { email: 'bowen@pra.edu.vn', name: 'Bowen', access: 'super_admin' },
  { email: 'seth@pra.edu.vn', name: 'Seth', access: 'head' },
  { email: 'yvonne@pra.edu.vn', name: 'Yvonne', access: 'admin' },
  { email: 'hien.c@pra.edu.vn', name: 'Hien', access: 'admin' },
  { email: 'duyen.n@pra.edu.vn', name: 'Duyen', access: 'admin' },
]

const years = (subject, groups) => groups.map((g) => `${subject}:${g}`)
// Years 2 to 5 share their afternoon classes (Art, Craft, Wellbeing, Everyday Experts, Cooking, Technology).
const Y2_5 = ['Year 2', 'Year 3', 'Year 4', 'Year 5']
// Nursery and Kindergarten homeroom teachers write every Early Years area except
// Applied English, which the class's English teacher writes (Ms. Solo teaches the
// Nursery afternoon session, Ms. Kiu Kindergarten Literacy).
const EARLY_YEARS_AREAS = ['communication', 'math', 'understanding_world', 'physical', 'expressive_arts']
const earlyYears = (group) => EARLY_YEARS_AREAS.map((k) => `${k}:${group}`)

export const TEACHER_SCHEDULE = [
  { email: 'seth@pra.edu.vn', name: 'Seth', title: 'Mr.', role: 'head', subjects: ['art_of_science:Year 7', ...years('cooking', ['Year 1', ...Y2_5])], homeroom_groups: ['*'] },
  { email: 'bowen@pra.edu.vn', name: 'Bowen', title: 'Mr.', role: 'head', subjects: ['math:Year 7', 'science:Year 7'], homeroom_groups: ['Year 7'] },
  { email: 'david@pra.edu.vn', name: 'David', title: 'Mr.', role: 'teacher', subjects: ['english:Year 7', 'math:Year 5'], homeroom_groups: ['Upper Secondary'] },
  { email: 'solo@pra.edu.vn', name: 'Solo', title: 'Ms.', role: 'teacher', subjects: years('english', ['Year 1']).concat(years('math', ['Year 1']), years('science', ['Year 1']), years('presentation_play', ['Year 1']), ['applied_english:Nursery']), homeroom_groups: ['Year 1'] },
  { email: 'caleb@pra.edu.vn', name: 'Caleb', title: 'Mr.', role: 'teacher', subjects: [...years('english', ['Year 2', 'Year 3']), ...years('math', ['Year 2', 'Year 3']), ...years('science', ['Year 2', 'Year 3']), ...years('technology', Y2_5), ...years('art_craft', Y2_5), ...years('everyday_experts', Y2_5), 'movement:Year 7'], homeroom_groups: ['Year 2', 'Year 3'] },
  { email: 'kiu@pra.edu.vn', name: 'Kiu', title: 'Ms.', role: 'teacher', subjects: ['english:Year 5', 'science:Year 5', 'history:Year 7', 'executive_function:Year 7', ...years('wellbeing', Y2_5), 'wellbeing:Year 7', 'wellbeing:Upper Secondary', 'applied_english:Kindergarten'], homeroom_groups: ['Year 5'] },
  { email: 'thanh.n@pra.edu.vn', name: 'Thanh', title: 'Ms.', role: 'teacher', subjects: earlyYears('Kindergarten'), homeroom_groups: ['Kindergarten'] },
  { email: 'duyen.n@pra.edu.vn', name: 'Duyen', title: 'Ms.', role: 'teacher', subjects: ['technology:Year 1', 'art_craft:Year 1'], homeroom_groups: [] },
  { email: 'tham.n@pra.edu.vn', name: 'Tham N', title: 'Ms.', role: 'teacher', subjects: earlyYears('Nursery'), homeroom_groups: ['Nursery'] },
  { email: 'tham.v@pra.edu.vn', name: 'Thắm V', title: 'Ms.', role: 'teacher', subjects: [...years('technology', Y2_5), ...years('art_craft', Y2_5)], homeroom_groups: [] },
]

/** 'english:Year 7' -> ['english', 'Year 7'] (old flat keys give a null year group). */
export const splitSubjectKey = (k) => {
  const i = String(k).indexOf(':')
  return i < 0 ? [k, null] : [k.slice(0, i), k.slice(i + 1)]
}
