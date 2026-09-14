import { Icon } from './icons'
import TrendChart from './TrendChart'
import { levelInfo, subjectByKey, firstName, hasNum } from '../../lib/report/utils'
import { fmtDate } from '../../lib/report/utils'
import { photoSrc } from '../../lib/report/photo'

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

  const scoredKeys = academic.filter((s) => subjectByKey(settings, s.subject_key).scored !== false).map((s) => s.subject_key)
  const showScores = scoredKeys.length > 0
  const refFor = (s) => (hasNum(s.class_avg) ? Number(s.class_avg) : cohortAvg[s.subject_key] ?? null)
  const periods = (settings.periods || []).map((p) => ({ label: p.label, short: p.label.replace(/Quarter/i, 'Q').replace(/Semester/i, 'S').replace(/Term/i, 'T') }))
  const bundleFor = (idx) => history.find((h) => Number(h.report.period_index) === idx)

  const noteFor = (key) => courseNotes.find((n) => n.subject_key === key)

  const CHART_COLORS = ['#6f9f2f', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']
  const chartSeries = scoredKeys.map((key, i) => {
    const sub = subjectByKey(settings, key)
    const studentScores = (settings.periods || []).map((p) => {
      const h = bundleFor(p.index); if (!h) return null
      const sec = h.sections.find((x) => x.subject_key === key)
      return sec && hasNum(sec.score_pct) ? Number(sec.score_pct) : null
    })
    const refScores = (settings.periods || []).map((p) => {
      const h = bundleFor(p.index); if (!h) return null
      const sec = h.sections.find((x) => x.subject_key === key)
      if (!sec) return null
      return h.report.id === report.id ? refFor(sec) : (hasNum(sec.class_avg) ? Number(sec.class_avg) : null)
    })
    return { name: sub.name, color: CHART_COLORS[i % CHART_COLORS.length], student: studentScores, reference: refScores }
  })
  const anyScore = chartSeries.some((s) => s.student.some((v) => v != null))
  const closing = (org.closing || '').replace('{nickname}', nick).replace('{name}', student?.full_name || '')

  return (
    <div className={`rpt ${compact ? 'compact' : ''}`}>
      <div className="sheet">
        {/* ---- header ---- */}
        <header style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr auto', alignItems: 'center', gap: 8, borderBottom: '2px solid var(--navy)', paddingBottom: 5 }}>
          <div>
            <img src={logo} alt={org.name} style={{ height: '13mm', display: 'block' }} />
            <div style={{ fontSize: '6.5pt', color: 'var(--blue)', fontWeight: 600, marginTop: 1 }}>{org.tagline}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16pt', fontWeight: 900, letterSpacing: '.02em', color: 'var(--navy)', lineHeight: 1.05, textTransform: 'uppercase' }}>{org.docTitle}</div>
            <div style={{ fontSize: '9.5pt', fontWeight: 700, color: 'var(--blue)', marginTop: 2 }}>{report.period_label} <span style={{ color: '#94a3b8' }}>•</span> {report.school_year}</div>
            {bi && <div className="muted" style={{ fontSize: '7pt', fontStyle: 'italic' }}>{org.docTitle_vi}</div>}
          </div>
          <div className="badge" style={{ padding: '4px 8px', minWidth: '36mm' }}>
            <div style={{ fontWeight: 900, fontSize: '11pt', letterSpacing: '.03em' }}>{(report.year_group || '').toUpperCase()}</div>
            <div style={{ fontSize: '7pt', fontWeight: 600 }}>{template.program || template.name || ''}</div>
            <div style={{ fontSize: '6.5pt', opacity: .85, marginTop: 1 }}>{fmtDate(report.report_date) || ''}</div>
          </div>
        </header>

        {/* ---- student info + homeroom teacher comment ---- */}
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1.9fr', gap: 7, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            {photoSrc(student?.photo)
              ? <img className="photo" src={photoSrc(student.photo)} alt="" style={{ width: '18mm', height: '18mm' }} />
              : <div className="photo placeholder" style={{ width: '18mm', height: '18mm', fontSize: '14pt' }}>{initials}</div>}
            <div>
              <div style={{ fontWeight: 900, fontSize: '9.5pt', lineHeight: 1.1 }}>{student?.full_name}</div>
              {student?.nickname && <div className="muted" style={{ fontSize: '7.5pt' }}>"{student.nickname}"</div>}
              <div style={{ marginTop: 2, fontSize: '7.5pt' }}><b>{report.year_group}</b></div>
              {report.homeroom_teacher && <div style={{ fontSize: '7.5pt' }}>Homeroom: <b>{report.homeroom_teacher}</b></div>}
            </div>
          </div>
          <div className="box" style={{ background: '#eef4fb', borderColor: '#cfe0f3', padding: '5px 8px' }}>
            <div className="kicker" style={{ color: 'var(--navy)', fontSize: '7pt' }}>Homeroom Teacher Comment{bi ? ' · Nhận xét GVCN' : ''}</div>
            <div style={{ marginTop: 2, fontSize: '8pt', whiteSpace: 'pre-line', lineHeight: 1.3 }}>
              <Bi en={report.homeroom_note || <span className="muted">—</span>} vi={report.homeroom_note_vi} bi={bi} />
            </div>
          </div>
        </section>

        {/* ---- academic learning ---- */}
        <section className="sec">
          <div className="sec-h" style={{ fontSize: '8.5pt', padding: '3px 8px' }}><span>Academic Learning{bi && <span className="sub"> · Học tập</span>}</span></div>
          <table>
            <thead><tr>
              <th style={{ width: '11%' }}>Learning area</th>
              <th style={{ width: '6%', textAlign: 'center' }}>Level</th>
              {showScores && <th style={{ width: '6%', textAlign: 'center' }}>Score</th>}
              <th>Comment &amp; next focus</th>
            </tr></thead>
            <tbody>
              {academic.map((s) => {
                const sub = subjectByKey(settings, s.subject_key)
                const ref = refFor(s)
                const note = noteFor(s.subject_key)
                return (
                  <tr key={s.id}>
                    <td style={{ padding: '4px 5px' }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--navy)', marginTop: 1 }}><Icon name={sub.icon} size={13} /></span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '8.5pt' }}>{sub.name}</div>
                          {s.teacher_name && <div className="muted" style={{ fontSize: '6.5pt' }}>{s.teacher_name}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '4px 2px' }}>
                      <Level settings={settings} value={s.level} />
                    </td>
                    {showScores && (
                      <td style={{ textAlign: 'center', padding: '4px 2px' }}>
                        {scoredKeys.includes(s.subject_key) ? (<>
                          <div style={{ fontWeight: 900, fontSize: '9pt', color: 'var(--navy)' }}>{hasNum(s.score_pct) ? `${s.score_pct}%` : '—'}</div>
                          {ref != null && <div className="muted" style={{ fontSize: '6pt' }}>class {ref}%</div>}
                        </>) : <span className="muted">—</span>}
                      </td>
                    )}
                    <td style={{ fontSize: '8pt', padding: '4px 5px', lineHeight: 1.3 }}>
                      {note?.description && (
                        <div style={{ fontSize: '7pt', color: 'var(--muted)', marginBottom: 2, fontStyle: 'italic', lineHeight: 1.2 }}>
                          <b style={{ fontStyle: 'normal' }}>Topics:</b> {note.description}
                        </div>
                      )}
                      <Bi en={s.comment || <span className="muted">—</span>} vi={s.comment_vi} bi={bi} />
                      {s.next_focus && <div style={{ marginTop: 1 }}><b>Next:</b> {s.next_focus}</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        {/* ---- academic progress charts (one per subject) ---- */}
        {showScores && anyScore && (
          <section style={{ padding: '3px 0' }}>
            <div className="kicker" style={{ fontSize: '6.5pt', marginBottom: 3 }}>Academic Progress Review{bi ? ' · Tiến bộ học tập' : ''}</div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${chartSeries.length}, 1fr)`, gap: 6 }}>
              {chartSeries.map((s) => (
                <div key={s.name} style={{ border: '1px solid #e5e9ef', borderRadius: 4, padding: '3px 4px' }}>
                  <div style={{ fontSize: '6.5pt', fontWeight: 700, color: s.color, marginBottom: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span>{s.name}</span>
                    <span style={{ fontSize: '5.5pt', color: 'var(--muted)', fontWeight: 400 }}>━ student <span style={{ opacity: 0.45 }}>┄</span> class avg</span>
                  </div>
                  <TrendChart periods={periods} series={[s]} width={200} height={70} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- vocational learning ---- */}
        {vocational.length > 0 && (
          <section className="sec">
            <div className="sec-h" style={{ fontSize: '8.5pt', padding: '3px 8px' }}><span>Specialist &amp; Vocational{bi && <span className="sub"> · Chuyên môn</span>}</span></div>
            <div className="sec-b" style={{ display: 'grid', gridTemplateColumns: `repeat(${vocational.length}, 1fr)`, gap: 3, padding: '4px 5px' }}>
              {vocational.map((s) => {
                const sub = subjectByKey(settings, s.subject_key)
                return (
                  <div key={s.id} className="voc" style={{ padding: '3px 4px', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontWeight: 800, fontSize: '7pt', color: 'var(--navy)' }}><Icon name={sub.icon} size={10} /> {sub.name}{s.teacher_name && <span style={{ fontWeight: 400, fontSize: '6pt', color: 'var(--muted)' }}> · {s.teacher_name}</span>}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Level settings={settings} value={s.level} name={false} />
                      <span style={{ fontSize: '6pt', fontWeight: 700, color: 'var(--muted)' }}>{levelInfo(settings, s.level)?.name || 'Not yet'}</span>
                    </div>
                    {(s.comment || '').trim() && <div style={{ fontSize: '7pt', lineHeight: 1.2 }}><Bi en={s.comment} vi={s.comment_vi} bi={bi} /></div>}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ---- learner skills ---- */}
        <section className="sec">
          <div className="sec-h" style={{ fontSize: '8.5pt', padding: '3px 8px' }}><span>How I Learn{bi && <span className="sub"> · Kỹ năng</span>}</span></div>
          <div className="sec-b" style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '4px 6px' }}>
            {(settings.skillGroups || []).map((g) => (
              <div key={g.key}>
                <div className="kicker" style={{ marginBottom: 2, fontSize: '6.5pt' }}>{g.name}{bi && g.name_vi ? ` · ${g.name_vi}` : ''}</div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(g.items.length, 1)}, 1fr)`, gap: 3 }}>
                  {g.items.map((it) => (
                    <div key={it.key} className="skill" style={{ padding: '2px 3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, fontWeight: 700, fontSize: '6.5pt', color: 'var(--navy)' }}><Icon name={it.icon} size={9} /> {it.name}</div>
                      <div style={{ marginTop: 2 }}><Level settings={settings} value={report.skills?.[it.key]} name={false} /></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---- experiences + student voice ---- */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 5 }}>
          <div>
            <div className="kicker" style={{ marginBottom: 2, fontSize: '6.5pt' }}>Experiences &amp; growth{bi ? ' · Trải nghiệm' : ''}</div>
            <ul className="bullets" style={{ fontSize: '7.5pt' }}>
              {(report.experiences || []).filter(Boolean).map((e, i) => <li key={i}>{e}</li>)}
              {!(report.experiences || []).filter(Boolean).length && <li className="muted">—</li>}
            </ul>
          </div>
          <div className="box" style={{ background: '#fffbeb', borderColor: '#fde68a', padding: '4px 6px' }}>
            <div className="kicker" style={{ color: '#92400e', fontSize: '6.5pt' }}>In {nick}'s words</div>
            <div className="quote" style={{ marginTop: 2, fontSize: '8.5pt' }}>{report.student_voice ? `"${report.student_voice}"` : '—'}</div>
          </div>
        </section>

        {/* ---- level key (inline) + signatures + footer ---- */}
        <section style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 5, paddingBottom: 4, borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: '6.5pt', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Levels:</span>
            {levels.map((l) => (
              <span key={l.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '6.5pt' }}>
                <span className="lvl" style={{ background: l.color, width: 14, height: 14, fontSize: '7pt' }}>{l.code}</span>
                <span style={{ fontWeight: 600 }}>{l.name}</span>
              </span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max((report.signatures || []).length, 1)}, 1fr)`, gap: 14, paddingTop: 4 }}>
            {(report.signatures || []).map((sg, i) => (
              <div key={i}>
                <div style={{ fontFamily: "'Segoe Script', 'Brush Script MT', cursive", fontSize: '9pt', color: 'var(--navy)', minHeight: 14 }}>{sg.name}</div>
                <div className="sig-line"><b style={{ color: 'var(--ink)' }}>{sg.role}</b>{sg.name ? ` · ${sg.name}` : ''}</div>
              </div>
            ))}
          </div>
          {closing && <div className="muted" style={{ fontSize: '7pt', marginTop: 4, fontStyle: 'italic' }}>{closing}</div>}
          <div className="foot"><span>{org.legalLine}</span><span>{student?.full_name} • {report.period_label} {report.school_year}</span></div>
        </section>
      </div>
    </div>
  )
}
