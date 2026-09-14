import { Icon } from './icons'
import TrendChart from './TrendChart'
import { levelInfo, subjectByKey, avg, firstName, hasNum } from '../../lib/report/utils'
import { fmtDate } from '../../lib/report/utils'

// The printable two-page A4 progress report. Pure presentation: everything it
// shows comes in through props so the editor preview and the print page agree.
//
//   report      adm_reports row          sections  adm_report_sections rows (academic first)
//   student     adm_students row         settings  report settings document
//   history     [{ report, sections }] for every period of this school year
//   cohortAvg   { subject_key: pct } average across the year group this period
//   courseNotes adm_course_notes rows for this cohort/period

function Level({ settings, value, name = true }) {
  const l = levelInfo(settings, value)
  if (!l) return <span style={{ display: 'inline-block', textAlign: 'center' }}><span className="lvl empty">–</span>{name && <span className="lvl-name">Not yet</span>}</span>
  return (
    <span style={{ display: 'inline-block', textAlign: 'center' }}>
      <span className="lvl" style={{ background: l.color }}>{l.code}</span>
      {name && <span className="lvl-name">{l.name}</span>}
    </span>
  )
}

function Bi({ en, vi, bi }) {
  return (
    <>
      <div style={{ whiteSpace: 'pre-line' }}>{en}</div>
      {bi && vi && <div className="vi" style={{ whiteSpace: 'pre-line' }}>{vi}</div>}
    </>
  )
}

export default function ReportDocument({ report, sections, student, settings, history = [], cohortAvg = {}, courseNotes = [], compact = false }) {
  const org = settings.org || {}
  const bi = report.lang === 'bi'
  const levels = settings.levels || []
  const academic = sections.filter((s) => s.kind === 'academic')
  const vocational = sections.filter((s) => s.kind !== 'academic')
  const nick = firstName(student)
  const template = settings.templates?.[report.template] || {}
  const initials = (student?.full_name || '?').split(' ').filter(Boolean).map((w) => w[0]).slice(-2).join('')
  const logo = `${import.meta.env.BASE_URL}logo.png`

  // Progress review scores and the year-to-date trend.
  const scoredKeys = academic.filter((s) => subjectByKey(settings, s.subject_key).scored !== false).map((s) => s.subject_key)
  const showScores = scoredKeys.length > 0
  const refFor = (s) => (hasNum(s.class_avg) ? Number(s.class_avg) : cohortAvg[s.subject_key] ?? null)
  const periods = (settings.periods || []).map((p) => ({ label: p.label, short: p.label.replace(/Quarter/i, 'Q').replace(/Semester/i, 'S').replace(/Term/i, 'T') }))
  const bundleFor = (idx) => history.find((h) => Number(h.report.period_index) === idx)
  const seriesStudent = (settings.periods || []).map((p) => {
    const h = bundleFor(p.index); if (!h) return null
    return avg(h.sections.filter((s) => scoredKeys.includes(s.subject_key)).map((s) => s.score_pct))
  })
  const seriesRef = (settings.periods || []).map((p) => {
    const h = bundleFor(p.index); if (!h) return null
    return avg(h.sections.filter((s) => scoredKeys.includes(s.subject_key)).map((s) => (h.report.id === report.id ? refFor(s) : s.class_avg)))
  })
  const anyScore = seriesStudent.some((v) => v != null)
  const closing = (org.closing || '').replace('{nickname}', nick).replace('{name}', student?.full_name || '')
  const showNotes = report.show_course_notes && courseNotes.some((n) => (n.description || '').trim())

  const key = (
    <div style={{ display: 'grid', gap: 5 }}>
      {levels.map((l) => (
        <div key={l.value} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span className="lvl" style={{ background: l.color, flex: 'none' }}>{l.code}</span>
          <div style={{ fontSize: '7.3pt', lineHeight: 1.25 }}>
            <b>{l.name}</b>{bi && l.name_vi ? <i> · {l.name_vi}</i> : null}
            <div className="muted">{l.desc}</div>
            {bi && l.desc_vi && <div className="vi" style={{ marginTop: 1 }}>{l.desc_vi}</div>}
          </div>
        </div>
      ))}
    </div>
  )

  const foot = (n) => <div className="foot"><span>{org.legalLine}</span><span>{student?.full_name} • {report.period_label} {report.school_year} • {n}/2</span></div>

  return (
    <div className={`rpt ${compact ? 'compact' : ''}`}>
      {/* ------------------------------------------------ page 1 */}
      <div className="sheet">
        <header style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', alignItems: 'center', gap: 8, borderBottom: '2px solid var(--navy)', paddingBottom: 6 }}>
          <div>
            <img src={logo} alt={org.name} style={{ height: '16mm', display: 'block' }} />
            <div style={{ fontSize: '7.5pt', color: 'var(--blue)', fontWeight: 600, marginTop: 2 }}>{org.tagline}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="hdr-title">{org.docTitle}</div>
            <div className="hdr-sub">{report.period_label} <span style={{ color: '#94a3b8' }}>•</span> {report.school_year}</div>
            {bi && <div className="muted" style={{ fontSize: '8pt', fontStyle: 'italic' }}>{org.docTitle_vi}</div>}
          </div>
          <div className="badge" style={{ justifySelf: 'end', minWidth: '42mm' }}>
            <div style={{ fontWeight: 900, fontSize: '12pt', letterSpacing: '.03em' }}>{(report.year_group || '').toUpperCase()}</div>
            <div style={{ fontSize: '8pt', fontWeight: 600 }}>{template.program || template.name || ''}</div>
            <div style={{ fontSize: '7.5pt', opacity: .85, marginTop: 2 }}>{fmtDate(report.report_date) || ''}</div>
          </div>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1.7fr', gap: 8, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            {student?.photo ? <img className="photo" src={student.photo} alt="" /> : <div className="photo placeholder">{initials}</div>}
            <div>
              <div style={{ fontWeight: 900, fontSize: '13pt', lineHeight: 1.1 }}>{student?.full_name}</div>
              {student?.nickname && <div className="muted" style={{ fontSize: '8.5pt' }}>“{student.nickname}”</div>}
              <div style={{ marginTop: 4, fontSize: '8.5pt' }}><b>{report.year_group}</b>{report.class_name ? <> • {report.class_name}</> : null}</div>
              {report.homeroom_teacher && <div style={{ fontSize: '8.5pt' }}>Homeroom: <b>{report.homeroom_teacher}</b></div>}
            </div>
          </div>
          <div className="box" style={{ background: '#eef4fb', borderColor: '#cfe0f3' }}>
            <div className="kicker" style={{ color: 'var(--navy)' }}>This period at a glance{bi ? ' · Tổng quan' : ''}</div>
            <div style={{ marginTop: 3, fontSize: '8.8pt', whiteSpace: 'pre-line' }}>{report.glance || <span className="muted">—</span>}</div>
          </div>
        </section>

        <section className="sec">
          <div className="sec-h"><span>Academic Learning{bi && <span className="sub"> · Học tập học thuật</span>}</span></div>
          <table>
            <thead><tr>
              <th style={{ width: '20%' }}>Learning area</th>
              <th style={{ width: '17%', textAlign: 'center' }}>Previous → now</th>
              {showScores && <th style={{ width: '12%', textAlign: 'center' }}>Review score</th>}
              <th>Teacher comment &amp; next focus</th>
            </tr></thead>
            <tbody>
              {academic.map((s) => {
                const sub = subjectByKey(settings, s.subject_key)
                const ref = refFor(s)
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--navy)', marginTop: 1 }}><Icon name={sub.icon} size={15} /></span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '9.5pt' }}>{sub.name}</div>
                          {bi && sub.name_vi && <div className="muted" style={{ fontSize: '7.5pt', fontStyle: 'italic' }}>{sub.name_vi}</div>}
                          {s.teacher_name && <div className="muted" style={{ fontSize: '7.5pt', marginTop: 2 }}>{s.teacher_name}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <Level settings={settings} value={s.level_prev} />
                      <span style={{ color: '#94a3b8', fontSize: '11pt', margin: '0 6px', verticalAlign: 'top', lineHeight: '22px' }}>→</span>
                      <Level settings={settings} value={s.level} />
                    </td>
                    {showScores && (
                      <td style={{ textAlign: 'center' }}>
                        {scoredKeys.includes(s.subject_key) ? (<>
                          <div style={{ fontWeight: 900, fontSize: '11pt', color: 'var(--navy)' }}>{hasNum(s.score_pct) ? `${s.score_pct}%` : '—'}</div>
                          {s.score_raw && <div className="muted" style={{ fontSize: '7pt' }}>{s.score_raw}</div>}
                          {ref != null && <div className="muted" style={{ fontSize: '7pt' }}>class {ref}%</div>}
                        </>) : <span className="muted">—</span>}
                      </td>
                    )}
                    <td style={{ fontSize: '8.6pt' }}>
                      <Bi en={s.comment || <span className="muted">—</span>} vi={s.comment_vi} bi={bi} />
                      {s.next_focus && <div style={{ marginTop: 3 }}><b>Next focus:</b> {s.next_focus}</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: showScores && anyScore ? '1.15fr 1fr' : '1fr', gap: 8 }}>
          {showScores && anyScore && (
            <div className="box" style={{ background: 'white' }}>
              <div className="kicker" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Progress review scores this year</span>
                <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}><span style={{ color: '#6f9f2f' }}>━</span> {nick} &nbsp; <span style={{ color: '#9aa5b1' }}>┄</span> Class reference</span>
              </div>
              <TrendChart periods={periods} student={seriesStudent} reference={seriesRef} height={104} />
              <div className="muted" style={{ fontSize: '7.3pt', whiteSpace: 'pre-line' }}>{report.overview_note || `The class reference is the average review score of learners in ${nick}'s year group.`}</div>
            </div>
          )}
          <div className="box">
            <div className="kicker" style={{ marginBottom: 4 }}>Progress levels{bi ? ' · Mức độ tiến bộ' : ''}</div>
            {key}
          </div>
        </section>

        {foot(1)}
      </div>

      {/* ------------------------------------------------ page 2 */}
      <div className="sheet">
        <section className="sec">
          <div className="sec-h"><span>How I Learn <span className="sub">(learner skills{bi ? ' · Kỹ năng học tập' : ''})</span></span></div>
          <div className="sec-b" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(settings.skillGroups || []).map((g) => (
              <div key={g.key}>
                <div className="kicker" style={{ marginBottom: 3 }}>{g.name}{bi && g.name_vi ? ` · ${g.name_vi}` : ''}</div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(g.items.length, 1)}, 1fr)`, gap: 6 }}>
                  {g.items.map((it) => {
                    const note = report.skill_notes?.[it.key]
                    return (
                      <div key={it.key} className="skill">
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: '8pt', color: 'var(--navy)' }}><Icon name={it.icon} size={12} /> {it.name}</div>
                        {bi && it.name_vi && <div className="muted" style={{ fontSize: '6.8pt', fontStyle: 'italic' }}>{it.name_vi}</div>}
                        <div style={{ marginTop: 4 }}><Level settings={settings} value={report.skills?.[it.key]} /></div>
                        {note && <div className="muted" style={{ fontSize: '7.2pt', marginTop: 3, lineHeight: 1.2 }}>{note}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="sec">
          <div className="sec-h"><span>Homeroom Teacher Note{bi && <span className="sub"> · Nhận xét của giáo viên chủ nhiệm</span>}</span></div>
          <div className="sec-b" style={{ fontSize: '8.8pt' }}>
            <Bi en={report.homeroom_note || <span className="muted">—</span>} vi={report.homeroom_note_vi} bi={bi} />
          </div>
        </section>

        {vocational.length > 0 && (
          <section className="sec">
            <div className="sec-h"><span>Specialist &amp; Vocational Learning{bi && <span className="sub"> · Học tập chuyên môn và hướng nghiệp</span>}</span></div>
            <div className="sec-b" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(vocational.length, 5)}, 1fr)`, gap: 6 }}>
              {vocational.map((s) => {
                const sub = subjectByKey(settings, s.subject_key)
                return (
                  <div key={s.id} className="voc">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 800, fontSize: '8.5pt', color: 'var(--navy)' }}><Icon name={sub.icon} size={13} /> {sub.name}</div>
                    {bi && sub.name_vi && <div className="muted" style={{ fontSize: '7pt', fontStyle: 'italic', marginTop: -3 }}>{sub.name_vi}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Level settings={settings} value={s.level} name={false} />
                      <span style={{ fontSize: '7.5pt', fontWeight: 700, color: 'var(--muted)' }}>{levelInfo(settings, s.level)?.name || 'Not yet assessed'}</span>
                    </div>
                    <div style={{ fontSize: '8pt', flex: 1 }}><Bi en={s.comment || <span className="muted">—</span>} vi={s.comment_vi} bi={bi} /></div>
                    {s.teacher_name && <div className="muted" style={{ fontSize: '7.2pt', textAlign: 'right' }}>– {s.teacher_name}</div>}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <section className="sec">
          <div className="sec-h"><span>Experiences &amp; Growth This Period{bi && <span className="sub"> · Trải nghiệm và phát triển</span>}</span></div>
          <div className="sec-b" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 10 }}>
            <ul className="bullets" style={{ fontSize: '8.6pt' }}>
              {(report.experiences || []).filter(Boolean).map((e, i) => <li key={i}>{e}</li>)}
              {!(report.experiences || []).filter(Boolean).length && <li className="muted">—</li>}
            </ul>
            <div className="box" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
              <div className="kicker" style={{ color: '#92400e' }}>In {nick}'s words</div>
              <div className="quote" style={{ marginTop: 3 }}>{report.student_voice ? `“${report.student_voice}”` : '—'}</div>
            </div>
          </div>
        </section>

        {showNotes && (
          <section className="sec">
            <div className="sec-h"><span>What We Studied This Period{bi && <span className="sub"> · Nội dung học tập</span>}</span></div>
            <div className="sec-b" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '7.6pt' }}>
              {sections.map((s) => {
                const n = courseNotes.find((x) => x.subject_key === s.subject_key)
                if (!n || !(n.description || '').trim()) return null
                return <div key={s.id}><b style={{ color: 'var(--navy)' }}>{subjectByKey(settings, s.subject_key).name}:</b> {n.description}{bi && n.description_vi && <div className="vi">{n.description_vi}</div>}</div>
              })}
            </div>
          </section>
        )}

        <section style={{ marginTop: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max((report.signatures || []).length, 1)}, 1fr)`, gap: 16, paddingTop: 10 }}>
            {(report.signatures || []).map((sg, i) => (
              <div key={i}>
                <div style={{ fontFamily: "'Segoe Script', 'Brush Script MT', cursive", fontSize: '11pt', color: 'var(--navy)', minHeight: 20 }}>{sg.name}</div>
                <div className="sig-line"><b style={{ color: 'var(--ink)' }}>{sg.role}</b>{sg.name ? ` · ${sg.name}` : ''}</div>
              </div>
            ))}
          </div>
          {closing && <div className="muted" style={{ fontSize: '8pt', marginTop: 8, fontStyle: 'italic' }}>{closing}</div>}
        </section>

        {foot(2)}
      </div>
    </div>
  )
}
