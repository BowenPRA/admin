import { db, genId } from './db'
import { TEACHER_SCHEDULE } from '../data/staff'
import { buildReport, buildSections, buildSection, missingAreas } from './report/utils'

const SCORES = {
  A: { math: { raw: '40/50', pct: 80, level: 3 }, english: { raw: '43/50', pct: 86, level: 3 }, science: { raw: '38/50', pct: 76, level: 2 } },
  B: { math: { raw: '44/50', pct: 88, level: 4 }, english: { raw: '41/50', pct: 82, level: 3 }, science: { raw: '46/50', pct: 92, level: 4 } },
  C: { math: { raw: '32/50', pct: 64, level: 2 }, english: { raw: '28/50', pct: 56, level: 2 }, science: { raw: '35/50', pct: 70, level: 2 } },
  D: { math: { raw: '38/50', pct: 76, level: 3 }, english: { raw: '30/50', pct: 60, level: 2 }, science: { raw: '42/50', pct: 84, level: 3 } },
  E: { math: { raw: '35/50', pct: 70, level: 2 }, english: { raw: '33/50', pct: 66, level: 2 }, science: { raw: '37/50', pct: 74, level: 3 } },
  F: { math: { raw: '29/50', pct: 58, level: 2 }, english: { raw: '36/50', pct: 72, level: 2 }, science: { raw: '31/50', pct: 62, level: 2 } },
  G: { math: { raw: '42/50', pct: 84, level: 3 }, english: { raw: '39/50', pct: 78, level: 3 }, science: { raw: '44/50', pct: 88, level: 3 } },
  H: { math: { raw: '36/50', pct: 72, level: 2 }, english: { raw: '38/50', pct: 76, level: 3 }, science: { raw: '33/50', pct: 66, level: 2 } },
  I: { math: { raw: '33/50', pct: 66, level: 2 }, english: { raw: '31/50', pct: 62, level: 2 }, science: { raw: '36/50', pct: 72, level: 2 } },
  J: { math: { raw: '37/50', pct: 74, level: 3 }, english: { raw: '35/50', pct: 70, level: 2 }, science: { raw: '39/50', pct: 78, level: 3 } },
  K: { math: { raw: '30/50', pct: 60, level: 2 }, english: { raw: '34/50', pct: 68, level: 2 }, science: { raw: '32/50', pct: 64, level: 2 } },
}

const OTHER_LEVELS = {
  A: { art_of_science: 3, history: 2, movement: 3, executive_function: 2, technology: 3, wellbeing: 3 },
  B: { art_of_science: 3, history: 3, movement: 4, executive_function: 3, technology: 4, wellbeing: 4 },
  C: { art_of_science: 2, history: 2, movement: 3, executive_function: 2, technology: 2, wellbeing: 2 },
  D: { art_of_science: 3, history: 2, movement: 3, executive_function: 2, technology: 3, wellbeing: 2 },
  E: { art_of_science: 2, history: 2, movement: 2, executive_function: 2, technology: 2, wellbeing: 3 },
  F: { art_of_science: 2, history: 2, movement: 2, executive_function: 1, technology: 2, wellbeing: 2 },
  G: { art_of_science: 3, history: 3, movement: 3, executive_function: 3, technology: 3, wellbeing: 3 },
  H: { art_of_science: 2, history: 2, movement: 2, executive_function: 2, technology: 2, wellbeing: 3 },
  I: { art_of_science: 2, history: 2, movement: 3, executive_function: 2, technology: 2, wellbeing: 2 },
  J: { art_of_science: 3, history: 2, movement: 2, executive_function: 2, technology: 3, wellbeing: 3 },
  K: { art_of_science: 2, history: 2, movement: 2, executive_function: 1, technology: 2, wellbeing: 2 },
}

function teacherFor(subjectKey) {
  const t = TEACHER_SCHEDULE.find((t) => t.subjects.includes(`${subjectKey}:Year 7`))
  return t ? `${t.title} ${t.name}` : ''
}

const FULL_COMMENTS = {
  A: {
    math: { comment: '{name} demonstrates a solid understanding of mathematical concepts and approaches problem-solving with growing confidence. She has shown particular strength in algebraic reasoning and is developing fluency with fraction and decimal operations. {name} actively participates in collaborative tasks, explains her thinking clearly to peers and is beginning to check her answers by estimating first. Her written working is more organised this quarter. She has also started using diagrams to explain her reasoning when a problem feels unfamiliar.', next_focus: 'Strengthening multi-step problem solving and applying mathematical reasoning to real-world contexts.' },
    english: { comment: '{name} is a thoughtful and expressive writer who consistently crafts well-structured pieces with a strong personal voice. Her reading comprehension is excellent, and she engages deeply with texts during class discussions, often noticing details others miss. {name} has grown in confidence when presenting her ideas orally and supporting her arguments with evidence. She is now trying varied sentence openings so her writing flows. Her journal entries show a growing awareness of audience and purpose in her writing.', next_focus: 'Expanding her use of literary techniques and developing critical analysis of more complex texts.' },
    science: { comment: '{name} approaches scientific inquiry with curiosity and is building a strong foundation in experimental design. She records observations carefully, presents data in clear tables and is learning to draw conclusions from her results. While she sometimes needs prompting to connect concepts across topics, her effort and willingness to ask questions are commendable. She worked safely and responsibly in every practical session. Her poster on food chains explained energy transfer clearly for younger learners.', next_focus: 'Forming and testing her own hypotheses, and explaining results that do not match her predictions.' },
    art_of_science: { comment: '{name} brings creativity and precision to her scientific art projects, producing detailed and visually engaging work. She researches her subjects thoroughly and has developed a strong eye for colour and composition. Her labelled drawing of a plant cell was a highlight of our class display this quarter. She shares ideas generously.' },
    history: { comment: '{name} is developing her ability to analyse historical sources and form opinions supported by evidence. She participates well in discussions about Vietnamese and world history and is learning to compare perspectives across time periods. Her timeline project showed careful, patient research. She enjoys debating different viewpoints.' },
    movement: { comment: '{name} joins every Movement session with energy and a willingness to try new activities. She is building coordination and balance in our circuits and cooperative games, and she encourages teammates warmly. She is learning to pace herself so her effort stays steady to the end of each session. She shows good sportsmanship in every game.' },
    report: {
      glance: '{name} has settled in well this quarter and approaches her learning with enthusiasm and determination. She is a kind and supportive member of our learning community who contributes positively to class discussions.',
      homeroom_note: '{name} has had a wonderful start to the year. She brings a positive attitude to every session and is always willing to help her classmates. Her organisational skills have improved significantly, and she is becoming more independent in managing her learning. {name}\'s creativity shines through in group projects, and she is a kind, valued member of our learning community. She has formed warm friendships and greets each day with enthusiasm.',
      skills: { ready: 3, instructions: 3, creativity: 3, grasps: 3, persists: 3, emotions: 3, relationships: 3, identity: 3, motivation: 3, adaptability: 2 },
      experiences: ['Participated in the community garden project', 'Led a presentation on Vietnamese heritage', 'Contributed to the Quarter 1 science fair', 'Joined the class recycling team', 'Read eight books in the reading challenge'],
      student_voice: 'I really enjoyed the science experiments this quarter, especially when we got to work together in teams. Next I want to get better at explaining my maths answers out loud.',
    },
  },
  B: {
    math: { comment: '{name} has shown exceptional mathematical ability this quarter, consistently demonstrating a deep understanding of complex concepts. She works efficiently and accurately, often finishing tasks ahead of her peers and eagerly taking on extension challenges. {name} explains her reasoning with clarity and is a strong mathematical role model for the class. She also supports classmates patiently without simply giving them the answer. Her solutions are neat, logical and often show more than one way to reach the answer.', next_focus: 'Exploring advanced problem-solving strategies and beginning to write simple mathematical proofs.' },
    english: { comment: '{name} is a confident communicator who expresses her ideas with clarity and maturity. Her written work is well organised and shows a strong command of grammar and vocabulary. {name} participates actively in literature discussions and shows genuine engagement with the texts we explore in class. Her persuasive letter about protecting local wildlife was thoughtful, well argued and a real pleasure to read. She now reads widely beyond our class texts. She edits her drafts carefully and responds well to feedback.', next_focus: 'Developing her persuasive writing techniques further and expanding her use of figurative language.' },
    science: { comment: '{name} is an outstanding science learner who approaches every investigation with genuine curiosity and rigour. She designs thorough experiments, analyses data critically and draws well-supported conclusions. {name} frequently makes insightful connections between topics and asks thoughtful questions that deepen the learning for everyone. She has started a science journal of questions she wants to explore further at home with her family. Her fair test on plant growth was carefully controlled and well explained.', next_focus: 'Pursuing an independent research project and presenting her findings to a wider audience.' },
    art_of_science: { comment: '{name} combines scientific accuracy with artistic creativity, producing work that is both informative and visually striking. Her detailed diagrams and illustrations show a deep understanding of the concepts she represents. She gives kind, useful feedback to classmates during our gallery walks. She is proud of her detailed insect studies.' },
    history: { comment: '{name} engages thoughtfully with historical topics and contributes well-reasoned arguments in class discussions. She shows a genuine interest in different perspectives and connects past events to present-day issues with maturity. Her questions often lead the whole class into deeper discussion. Her research on the Silk Road was especially thorough.' },
    movement: { comment: '{name} moves with control and confidence and shows real body awareness in balance and agility tasks. She listens carefully to feedback, refines her technique quickly and often demonstrates skills for the group. {name} plays fairly, includes others in team games and is a positive influence on the class. She encourages others to keep trying.' },
    report: {
      glance: '{name} has had an outstanding quarter, excelling across all her learning areas while remaining a supportive and humble member of our community. Her dedication and curiosity are truly inspiring.',
      homeroom_note: '{name} continues to impress with her dedication, curiosity and kindness. She meets every challenge with a positive mindset and consistently produces work of a high standard. Beyond her academic achievements, {name} is a natural leader who lifts those around her. She volunteers to help classmates, asks thoughtful questions and brings real joy to our learning community every day. She is a trusted friend and a thoughtful member of every team she joins.',
      skills: { ready: 4, instructions: 4, creativity: 4, grasps: 4, persists: 4, emotions: 4, relationships: 4, identity: 3, motivation: 4, adaptability: 3 },
      experiences: ['Competed in a regional maths competition', 'Led the design team for the science fair', 'Mentored younger learners in buddy reading', 'Helped plan the Mid-Autumn celebration', 'Joined the student voice committee'],
      student_voice: 'I loved the science fair project because I got to research something I was really passionate about and share it with everyone. I also enjoyed reading with my younger buddy.',
    },
  },
}

// Vietnamese versions for the demo (profile A's report prints in English and Vietnamese)
const VIETNAMESE = {
  A: {
    math: { comment_vi: '{name} hiểu vững các khái niệm toán học và ngày càng tự tin khi giải quyết vấn đề. Em thể hiện thế mạnh đặc biệt trong tư duy đại số và đang dần thành thạo hơn với các phép tính phân số và số thập phân. {name} tích cực tham gia các hoạt động hợp tác, giải thích rõ ràng cách suy nghĩ của mình cho các bạn và bắt đầu biết ước lượng để tự kiểm tra đáp án. Cách trình bày bài làm của em cũng gọn gàng và rõ ràng hơn trong quý này. Em cũng đã bắt đầu dùng sơ đồ để giải thích lập luận khi gặp dạng bài toán mới.', next_focus_vi: 'Củng cố kỹ năng giải toán nhiều bước và vận dụng tư duy toán học vào các tình huống thực tế.' },
    english: { comment_vi: '{name} là một người viết chu đáo và giàu cảm xúc, luôn tạo ra những bài viết có cấu trúc tốt với giọng văn riêng. Khả năng đọc hiểu của em rất tốt, và em tham gia sâu vào các buổi thảo luận về văn bản, thường nhận ra những chi tiết mà người khác bỏ qua. {name} đã tự tin hơn khi trình bày ý tưởng bằng lời nói và dùng dẫn chứng để bảo vệ lập luận. Em đang thử nhiều cách mở đầu câu khác nhau để bài viết mạch lạc và hấp dẫn hơn. Nhật ký của em cho thấy em ngày càng chú ý đến người đọc và mục đích khi viết.', next_focus_vi: 'Sử dụng thêm các biện pháp tu từ và phân tích sâu hơn những văn bản có nội dung phức tạp.' },
    science: { comment_vi: '{name} tiếp cận khoa học với sự tò mò và đang xây dựng nền tảng vững chắc về thiết kế thí nghiệm. Em ghi chép quan sát cẩn thận, trình bày dữ liệu rõ ràng trong bảng biểu và đang từng bước học cách rút ra kết luận từ kết quả. Dù đôi khi cần được gợi ý để liên kết các chủ đề với nhau, sự nỗ lực và tinh thần đặt câu hỏi của em rất đáng khen ngợi. Em luôn làm việc an toàn, cẩn thận và có trách nhiệm trong mọi buổi thực hành của lớp. Tấm áp phích về chuỗi thức ăn của em giải thích rõ ràng sự truyền năng lượng.', next_focus_vi: 'Tự đặt và kiểm chứng giả thuyết, đồng thời giải thích những kết quả khác với dự đoán ban đầu.' },
    art_of_science: { comment_vi: '{name} mang sự sáng tạo và tỉ mỉ vào các dự án nghệ thuật khoa học, tạo ra những sản phẩm chi tiết, đẹp mắt và thu hút. Em tìm hiểu kỹ chủ đề và có con mắt tinh tế về màu sắc và bố cục. Bức vẽ tế bào thực vật có chú thích của em là điểm nhấn nổi bật trong khu trưng bày của lớp quý này. Em luôn sẵn lòng chia sẻ ý tưởng với các bạn.' },
    history: { comment_vi: '{name} đang phát triển khả năng phân tích nguồn tư liệu lịch sử và đưa ra ý kiến có dẫn chứng. Em tham gia tốt các buổi thảo luận về lịch sử Việt Nam và thế giới, và đang học cách so sánh các góc nhìn qua từng thời kỳ. Dự án dòng thời gian của em cho thấy sự tìm hiểu cẩn thận. Em rất thích tranh luận về các quan điểm khác nhau.' },
    movement: { comment_vi: '{name} tham gia mọi buổi Vận động với năng lượng và tinh thần sẵn sàng thử điều mới. Em đang cải thiện khả năng phối hợp và thăng bằng qua các bài tập và trò chơi đồng đội, và luôn cổ vũ các bạn cùng đội thật nhiệt tình. Em đang học cách phân bổ sức để duy trì nỗ lực đến cuối mỗi buổi. Em luôn thể hiện tinh thần thể thao tốt trong mọi trò chơi.' },
    report: {
      lang: 'bi',
      homeroom_note_vi: '{name} đã có một khởi đầu năm học tuyệt vời. Em luôn mang đến thái độ tích cực trong mỗi buổi học và sẵn sàng giúp đỡ các bạn. Kỹ năng sắp xếp của em đã tiến bộ rõ rệt, và em ngày càng tự chủ hơn trong việc học. Sự sáng tạo của {name} tỏa sáng trong các dự án nhóm, và em là một thành viên tốt bụng, đáng quý của cộng đồng học tập chúng ta. Em đã có những tình bạn thân thiết và luôn bắt đầu mỗi ngày với sự hào hứng.',
      experiences_vi: ['Tham gia dự án vườn cộng đồng', 'Thuyết trình về di sản văn hóa Việt Nam', 'Góp phần vào hội chợ khoa học Quý 1', 'Tham gia đội tái chế của lớp', 'Đọc tám cuốn sách trong thử thách đọc'],
      student_voice_vi: 'Em rất thích các thí nghiệm khoa học trong quý này, nhất là khi được làm việc cùng các bạn trong nhóm. Sắp tới em muốn giải thích đáp án toán của mình rõ ràng hơn.',
    },
  },
}

export async function seedYear7() {
  const settings = await db.getReportSettings()
  const period = settings.periods[0]
  const template = settings.templates.lower_secondary

  // 1. Year 7 students come from the database: load the roster file first
  //    (Students > More > Load roster file). This seeder is development-only.
  const students = await db.students.list()
  const y7Students = students.filter((s) => s.class_group === 'Year 7')
  if (!y7Students.length) throw new Error('No Year 7 students yet. Load the roster file first (Students > More > Load roster file).')

  // 2. Create teachers, and give existing ones any classes added to the schedule since (e.g. Movement for Caleb)
  const existing = await db.teachers.list()
  for (const t of TEACHER_SCHEDULE) {
    const row = existing.find((e) => e.email === t.email)
    if (!row) {
      await db.teachers.save({ ...t, id: genId(), active: true })
    } else {
      const add = t.subjects.filter((k) => !(row.subjects || []).includes(k))
      if (add.length) await db.teachers.save({ ...row, subjects: [...(row.subjects || []), ...add] })
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

  // Demo data is kept as anonymous profiles A-K (no real student in this file):
  // the Year 7 students, in name order, take them in turn, and "{name}" in the
  // demo comments becomes the student's own name.
  const profiles = Object.keys(SCORES)
  const byName = [...y7Students].sort((a, b) => a.full_name.localeCompare(b.full_name))
  for (const [i, student] of byName.entries()) {
    const nick = profiles[i]
    const scores = SCORES[nick]
    if (!scores) continue
    const who = student.nickname || student.full_name.split(' ').pop()
    const named = (v) => (typeof v === 'string' ? v.replaceAll('{name}', who) : Array.isArray(v) ? v.map(named) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, named(x)])) : v)

    const existingReport = existingReports.find((r) => r.student_id === student.id)
    let report, secs

    if (existingReport) {
      report = existingReport
      secs = await db.sections.list({ report_id: report.id })
      for (const key of missingAreas(settings, { ...report, year_group: 'Year 7' }, secs)) secs.push(buildSection(report.id, key, settings, { yearGroup: 'Year 7', teachers: TEACHER_SCHEDULE }))
    } else {
      report = buildReport(student, period, template, settings, 'Mr. Bowen')
      secs = buildSections(report.id, template, settings, { yearGroup: 'Year 7', teachers: TEACHER_SCHEDULE })
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
      const vocLevels = OTHER_LEVELS[nick]
      if (vocLevels && vocLevels[sec.subject_key] != null) {
        sec.level = vocLevels[sec.subject_key]
        sec.teacher_name = teacherFor(sec.subject_key)
      }
      // Vocational areas have no individual comment (older seeds wrote one)
      if (['executive_function', 'technology', 'wellbeing'].includes(sec.subject_key)) { sec.comment = ''; sec.comment_vi = '' }
      const full = FULL_COMMENTS[nick]
      if (full && full[sec.subject_key]) {
        sec.comment = named(full[sec.subject_key].comment)
        if (full[sec.subject_key].next_focus) sec.next_focus = named(full[sec.subject_key].next_focus)
        Object.assign(sec, named(VIETNAMESE[nick]?.[sec.subject_key] || {}))
      }
    }

    // Homeroom data (profiles A and B)
    const full = FULL_COMMENTS[nick]
    if (full) {
      report.glance = named(full.report.glance)
      report.homeroom_note = named(full.report.homeroom_note)
      report.skills = named(full.report.skills)
      report.experiences = named(full.report.experiences)
      report.student_voice = named(full.report.student_voice)
      Object.assign(report, named(VIETNAMESE[nick]?.report || {}))
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

  // 5. Topics covered this quarter (shared by the year group): a line above
  //    each academic comment, and the whole card for vocational areas
  const COURSE_NOTES_VI = {
    math: 'Biểu thức và phương trình đại số; phân số, số thập phân và phần trăm; tỉ lệ thức; diện tích; xử lý dữ liệu.',
    science: 'Phương pháp khoa học và thí nghiệm công bằng; các trạng thái của vật chất; lực và chuyển động; hệ sinh thái.',
    english: 'Viết văn tự sự và truyện ngắn; chiến lược đọc hiểu; ngữ pháp và dấu câu; kỹ năng thuyết trình trước lớp.',
    executive_function: 'Sử dụng sổ kế hoạch tuần; chia dự án thành các bước nhỏ có mốc kiểm tra rõ ràng; đặt và thường xuyên xem lại mục tiêu học tập; quản lý thời gian hiệu quả khi tự học; suy ngẫm về điều giúp em tập trung và ngăn nắp mỗi tuần.',
    technology: 'Công dân số và an toàn trên mạng; sắp xếp tệp khoa học trong ổ đĩa chung; làm bài trình chiếu sinh động; làm quen với lập trình kéo thả qua các trò chơi đơn giản; kiểm tra xem nguồn tin trên mạng có đáng tin cậy, khách quan hay không.',
    wellbeing: 'Nhận biết và quản lý cảm xúc; cách giữ bình tĩnh khi căng thẳng; xây dựng tình bạn và giải quyết mâu thuẫn; thói quen ngủ và dùng màn hình lành mạnh; vòng tròn chia sẻ, nhật ký biết ơn và thử thách lòng tốt hằng tuần.',
  }
  const COURSE_NOTES = {
    math: 'Algebraic expressions; fractions, decimals and percentages; ratio and proportion; area and perimeter; statistics.',
    science: 'The scientific method and fair tests; states of matter; forces and motion; ecosystems and food chains; lab safety.',
    english: 'Narrative writing and short stories; reading comprehension strategies; grammar and punctuation; oral presentations.',
    executive_function: 'Using a weekly planner; breaking projects into steps with checkpoints; setting and reviewing personal learning goals; managing time during independent work; reflecting on what helps us focus and stay organised each week.',
    technology: 'Digital citizenship and staying safe online; organising files in shared drives; building slide presentations; an introduction to block-based coding with simple games; checking whether online sources are reliable, fair and up to date.',
    wellbeing: 'Naming and managing emotions; calming strategies for stressful moments; building friendships and resolving conflict; healthy sleep and screen habits; weekly wellbeing circles, gratitude journals and kindness challenges.',
  }
  const existingNotes = await db.courseNotes.list({ school_year: settings.schoolYear, period_label: period.label, year_group: 'Year 7' })
  for (const [key, description] of Object.entries(COURSE_NOTES)) {
    const note = existingNotes.find((n) => n.subject_key === key)
    const description_vi = COURSE_NOTES_VI[key] || ''
    if (!note) await db.courseNotes.save({ id: genId(), school_year: settings.schoolYear, period_label: period.label, year_group: 'Year 7', subject_key: key, description, description_vi, teacher_name: teacherFor(key) })
    else if (note.description !== description || note.description_vi !== description_vi) await db.courseNotes.save({ ...note, description, description_vi })
  }

  const total = allReports.length + updatedReports.length
  return { created: total, msg: `Created ${allReports.length} and updated ${updatedReports.length} Quarter 1 reports for Year 7 with scores, levels and comments.` }
}
