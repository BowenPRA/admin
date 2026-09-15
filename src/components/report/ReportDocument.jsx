import { useLayoutEffect, useRef } from 'react'
import { Icon } from './icons'
import { levelInfo, subjectByKey, firstName, sectionsByTier, reviewRows, fmtDate } from '../../lib/report/utils'
import { TIERS } from '../../lib/report/defaults'
import { photoSrc } from '../../lib/report/photo'

function LevelPill({ settings, value }) {
  const l = levelInfo(settings, value)
  if (!l) return <span className="pill empty">Not yet</span>
  return <span className="pill" style={{ background: l.color }}><b>{l.code}</b>{l.name}</span>
}

function Dot({ settings, value }) {
  const l = levelInfo(settings, value)
  return l ? <span className="dot" style={{ background: l.color }}>{l.code}</span> : <span className="dot empty">–</span>
}

/** English (and Vietnamese on bilingual reports), with an optional run-in label such as "Comment:". */
function Bi({ en, vi, bi, label, tone }) {
  return (
    <>
      <div>{label && <b className={`runin ${tone || ''}`}>{label}</b>}{en || <span className="muted">—</span>}</div>
      {bi && vi && <div className="vi">{vi}</div>}
    </>
  )
}

function ScoreCell({ cell }) {
  if (cell.state === 'score') return <><div className="score">{cell.pct}%</div>{cell.ref != null && <div className="ref">class {cell.ref}%</div>}</>
  return <span className="tag">{cell.state === 'na' ? 'N/A' : cell.state === 'tbd' ? 'TBD' : '—'}</span>
}

const tierTitle = (key, bi) => {
  const t = TIERS.find((x) => x.key === key)
  return <span>{t.name}{bi && <span className="sub"> · {t.name_vi}</span>}</span>
}

/**
 * The printed Learning Progress Report: always one A4 page.
 * `onOverflow(n)` reports how many text boxes are too full to print completely.
 */
export default function ReportDocument({ report, sections, student, settings, history = [], cohortAvg = {}, summativeAvg = {}, courseNotes = [], compact = false, onOverflow }) {
  const org = settings.org || {}
  const bi = report.lang === 'bi'
  const levels = settings.levels || []
  const tiers = sectionsByTier(settings, sections)
  const nick = firstName(student)
  const template = settings.templates?.[report.template] || {}
  const initials = (student?.full_name || '?').split(' ').filter(Boolean).map((w) => w[0]).slice(-2).join('')
  const logo = `${import.meta.env.BASE_URL}logo.png`
  const periods = (settings.periods || []).map((p) => ({ ...p, short: p.label.replace(/Quarter\s*/i, 'Q').replace(/Semester\s*/i, 'S').replace(/Term\s*/i, 'T') }))
  const rows = reviewRows(settings, { report, sections, history, cohortAvg, summativeAvg })
  const noteFor = (key) => courseNotes.find((n) => n.subject_key === key)
  const closing = (org.closing || '').replace('{nickname}', nick).replace('{name}', student?.full_name || '')
  const experiences = (report.experiences || []).filter((e) => (e || '').trim())
  const cardTiers = ['specialist', 'vocational'].filter((k) => tiers[k].length)
  const cols = Math.max(3, ...cardTiers.map((k) => tiers[k].length))

  // Mark text boxes whose content is clipped (screen only).
  const root = useRef(null)
  useLayoutEffect(() => {
    let over = 0
    root.current?.querySelectorAll('.fit').forEach((el) => {
      const clipped = el.scrollHeight > el.clientHeight + 1
      if (clipped) { over++; el.setAttribute('data-over', '') } else el.removeAttribute('data-over')
    })
    onOverflow?.(over)
  })

  return (
    <div ref={root} className={`rpt ${compact ? 'compact' : ''} ${bi ? 'bi' : ''}`}>
      <div className="sheet">
        {/* ---- header ---- */}
        <header style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr', alignItems: 'center', gap: 8, borderBottom: '2px solid var(--navy)', paddingBottom: 4, flex: 'none' }}>
          <div>
            <img src={logo} alt={org.name} style={{ height: '10.5mm', display: 'block' }} />
            <div style={{ fontSize: '6.2pt', color: 'var(--blue)', fontWeight: 600, marginTop: 1 }}>{org.tagline}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '15pt', fontWeight: 900, letterSpacing: '.02em', color: 'var(--navy)', lineHeight: 1.05, textTransform: 'uppercase' }}>{org.docTitle}</div>
            <div style={{ fontSize: '9pt', fontWeight: 700, color: 'var(--blue)', marginTop: 2 }}>{report.period_label} <span style={{ color: '#94a3b8' }}>•</span> {report.school_year}</div>
            {bi && <div className="muted" style={{ fontSize: '6.8pt', fontStyle: 'italic' }}>{org.docTitle_vi}</div>}
          </div>
          <div className="badge" style={{ justifySelf: 'end', minWidth: '34mm', textAlign: 'right' }}>
            <div style={{ fontWeight: 900, fontSize: '10.5pt', letterSpacing: '.03em' }}>{(report.year_group || '').toUpperCase()}</div>
            <div style={{ fontSize: '6.8pt', fontWeight: 600 }}>{template.program || template.name || ''}</div>
            {report.report_date && <div style={{ fontSize: '6.2pt', opacity: 0.85, marginTop: 1 }}>{fmtDate(report.report_date)}</div>}
          </div>
        </header>

        {/* ---- student + homeroom teacher comment ---- */}
        <section style={{ display: 'grid', gridTemplateColumns: '52mm 1fr', gap: '2mm', height: '23mm', flex: 'none' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {photoSrc(student?.photo)
              ? <img className="photo" src={photoSrc(student.photo)} alt="" style={{ width: '19mm', height: '19mm' }} />
              : <div className="photo placeholder" style={{ width: '19mm', height: '19mm', fontSize: '13pt' }}>{initials}</div>}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: '9.5pt', lineHeight: 1.12 }}>{student?.full_name}</div>
              {student?.nickname && <div className="muted" style={{ fontSize: '7.4pt' }}>"{student.nickname}"</div>}
              <div style={{ marginTop: 2, fontSize: '7.4pt' }}><b>{report.year_group}</b></div>
              {report.homeroom_teacher && <div style={{ fontSize: '7.4pt' }}>Homeroom: <b>{report.homeroom_teacher}</b></div>}
            </div>
          </div>
          <div className="box" style={{ background: '#eef4fb', borderColor: '#cfe0f3', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="kicker" style={{ color: 'var(--navy)' }}>Homeroom Teacher Comment{bi ? ' · Nhận xét GVCN' : ''}</div>
            <div className="fit txt" style={{ flex: 1, marginTop: 1 }}><Bi en={report.homeroom_note} vi={report.homeroom_note_vi} bi={bi} /></div>
          </div>
        </section>

        {/* ---- academic learning ---- */}
        {tiers.academic.length > 0 && (
          <section className="sec" style={{ flex: '1 1 0' }}>
            <div className="sec-h">
              {tierTitle('academic', bi)}
              <span style={{ display: 'flex', gap: 7, fontWeight: 600, letterSpacing: 0, textTransform: 'none', fontSize: '6.4pt' }}>
                {levels.map((l) => (
                  <span key={l.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    <span className="dot" style={{ background: l.color, width: 10, height: 10, fontSize: '5.6pt', boxShadow: '0 0 0 1px rgba(255,255,255,.5)' }}>{l.code}</span>{l.name}
                  </span>
                ))}
              </span>
            </div>
            <div className="area-rows" style={{ gridTemplateRows: `repeat(${tiers.academic.length}, minmax(0, 1fr))` }}>
              {tiers.academic.map((s) => {
                const sub = subjectByKey(settings, s.subject_key)
                const note = noteFor(s.subject_key)
                return (
                  <div key={s.id} className="area-row">
                    <div className="area-name">
                      <div className="area-title"><Icon name={sub.icon} size={11} /> {sub.name}</div>
                      {s.teacher_name && <div className="muted" style={{ fontSize: '6.4pt', marginTop: -2 }}>{s.teacher_name}</div>}
                      <div style={{ marginTop: 1 }}><LevelPill settings={settings} value={s.level} /></div>
                    </div>
                    <div className="area-body">
                      {(note?.description || '').trim() && (
                        <div className="topics">
                          <b className="runin green">Topics covered:</b>{note.description}
                          {bi && note.description_vi && <div className="vi">{note.description_vi}</div>}
                        </div>
                      )}
                      <div className="fit txt"><Bi en={s.comment} vi={s.comment_vi} bi={bi} /></div>
                      {(s.next_focus || '').trim() && <div className="next"><b>Next focus:</b> {s.next_focus}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ---- review scores + how I learn ---- */}
        <section style={{ display: 'grid', gridTemplateColumns: rows.length ? '1.08fr 1fr' : '1fr', gap: '2mm', flex: 'none' }}>
          {rows.length > 0 && (
            <div className="sec">
              <div className="sec-h"><span>Progress Review Scores{bi && <span className="sub"> · Điểm đánh giá</span>}</span></div>
              <table className="scores">
                <thead><tr>
                  <th style={{ width: '25%' }}>Learning area</th>
                  {periods.map((p) => <th key={p.index} className={Number(p.index) === Number(report.period_index) ? 'cur' : ''}>{p.short}</th>)}
                  <th className="sum">Summative</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td style={{ fontWeight: 700, fontSize: '7.4pt', color: 'var(--navy)', whiteSpace: 'nowrap' }}>{r.name}</td>
                      {r.cells.map((c, i) => <td key={i} className={Number(periods[i].index) === Number(report.period_index) ? 'cur' : ''}><ScoreCell cell={c} /></td>)}
                      <td className="sum"><ScoreCell cell={r.summative} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="muted" style={{ fontSize: '5.8pt', padding: '1.5px 7px 2px', borderTop: '1px solid var(--line)', background: 'var(--soft)' }}>
                Updated each quarter. TBD: still to come · N/A: not enrolled or not reviewed that quarter.
              </div>
            </div>
          )}
          <div className="sec">
            <div className="sec-h"><span>How I Learn{bi && <span className="sub"> · Kỹ năng học tập</span>}</span></div>
            <div className="skills">
              {(settings.skillGroups || []).map((g) => (
                <div key={g.key}>
                  <div className="kicker" style={{ padding: '1px 0', fontSize: '5.9pt' }}>{g.name}</div>
                  {g.items.map((it) => (
                    <div key={it.key} className="skill-row">
                      <span><Icon name={it.icon} size={8} style={{ color: 'var(--navy)' }} />{it.name}</span>
                      <Dot settings={settings} value={report.skills?.[it.key]} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- specialist and vocational learning ---- */}
        {cardTiers.map((tier) => (
          <section key={tier} className="sec" style={{ height: tier === 'specialist' ? '45.5mm' : '37mm', flex: 'none' }}>
            <div className="sec-h">
              {tierTitle(tier, bi)}
              <span className="sub" style={{ fontSize: '6.4pt' }}>
                {tier === 'specialist'
                  ? `Individual comments on ${nick}'s progress`
                  : `Course descriptions: topics the ${report.year_group} group covered this quarter`}
              </span>
            </div>
            <div className="cards" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {tiers[tier].map((s) => {
                const sub = subjectByKey(settings, s.subject_key)
                const note = noteFor(s.subject_key)
                return (
                  <div key={s.id} className="card-a">
                    <div className="card-head">
                      <span className="t"><Icon name={sub.icon} size={10} /> {sub.name}</span>
                      <LevelPill settings={settings} value={s.level} />
                    </div>
                    {s.teacher_name && <div className="teacher">{s.teacher_name}</div>}
                    {tier === 'vocational'
                      ? <div className="fit txt"><Bi en={note?.description} vi={note?.description_vi} bi={bi} label="Topics covered:" tone="green" /></div>
                      : <div className="fit txt"><Bi en={s.comment} vi={s.comment_vi} bi={bi} label="Comment:" tone="blue" /></div>}
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        {/* ---- experiences, student voice, signatures ---- */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.15fr 1.3fr 0.7fr', gap: '3mm', height: '20.5mm', flex: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="kicker">Experiences &amp; growth{bi ? ' · Trải nghiệm' : ''}</div>
            <ul className="bullets fit" style={{ flex: 1, marginTop: 1 }}>
              {experiences.map((e, i) => <li key={i}>{e}</li>)}
              {!experiences.length && <li className="muted">—</li>}
            </ul>
          </div>
          <div className="box" style={{ background: '#fffbeb', borderColor: '#fde68a', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="kicker" style={{ color: '#92400e' }}>In {nick}'s words</div>
            <div className="quote fit" style={{ flex: 1, marginTop: 1 }}>{report.student_voice ? `"${report.student_voice}"` : '—'}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', gap: 2 }}>
            {(report.signatures || []).map((sg, i) => (
              <div key={i}>
                <div style={{ fontFamily: "'Segoe Script', 'Brush Script MT', cursive", fontSize: '8.5pt', color: 'var(--navy)', minHeight: 12, lineHeight: 1.2 }}>{sg.name}</div>
                <div className="sig-line"><b style={{ color: 'var(--ink)' }}>{sg.role}</b></div>
              </div>
            ))}
          </div>
        </section>

        <footer className="foot">
          <span style={{ fontStyle: 'italic' }}>{closing}</span>
          <span style={{ whiteSpace: 'nowrap' }}>{org.legalLine}</span>
        </footer>
      </div>
    </div>
  )
}
