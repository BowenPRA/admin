import { useLayoutEffect, useRef } from 'react'
import { Icon } from './icons'
import { levelInfo, subjectByKey, firstName, sectionsByTier, reviewRows } from '../../lib/report/utils'
import { reportStrings, periodLabel, yearGroupLabel, roleLabel, pickText } from '../../lib/report/strings'
import { photoSrc } from '../../lib/report/photo'

const nameIn = (item, vi) => (vi && item?.name_vi) || item?.name || ''

function LevelPill({ settings, value, vi, t }) {
  const l = levelInfo(settings, value)
  if (!l) return <span className="pill empty">{t.notYet}</span>
  return <span className="pill" style={{ background: l.color }}><b>{l.code}</b>{nameIn(l, vi)}</span>
}

function Dot({ settings, value }) {
  const l = levelInfo(settings, value)
  return l ? <span className="dot" style={{ background: l.color }}>{l.code}</span> : <span className="dot empty">–</span>
}

/** A text box's content, with an optional run-in label such as "Comment:". Untranslated text is flagged on screen. */
function Text({ picked, label, tone, className = 'fit txt', style }) {
  return (
    <div className={className} style={style} data-untranslated={picked.missing ? '' : undefined}>
      {label && <b className={`runin ${tone || ''}`}>{label}</b>}{picked.text || <span className="muted">—</span>}
    </div>
  )
}

function ScoreCell({ cell, t }) {
  if (cell.state === 'score') return <><div className="score">{cell.pct}%</div>{cell.ref != null && <div className="ref">{t.classAvg} {cell.ref}%</div>}</>
  return <span className="tag">{cell.state === 'na' ? 'N/A' : cell.state === 'tbd' ? 'TBD' : '—'}</span>
}

/**
 * The printed Learning Progress Report: always one A4 page, in English
 * (`lang` 'en') or Vietnamese ('vi'). Vietnamese pages use the _vi fields and
 * fall back to the English text where no translation has been written.
 * `onCheck({ overflow, untranslated })` reports text boxes that are too full
 * and parts still waiting for a translation.
 */
export default function ReportDocument({ report, sections, student, settings, history = [], cohortAvg = {}, summativeAvg = {}, courseNotes = [], compact = false, lang = 'en', onCheck }) {
  const vi = lang === 'vi'
  const t = reportStrings(lang)
  const pick = (en, viText) => pickText(lang, en, viText)
  const org = settings.org || {}
  const levels = settings.levels || []
  const tiers = sectionsByTier(settings, sections)
  const nick = firstName(student)
  const template = settings.templates?.[report.template] || {}
  const yearGroup = yearGroupLabel(report.year_group, lang)
  const initials = (student?.full_name || '?').split(' ').filter(Boolean).map((w) => w[0]).slice(-2).join('')
  const logo = `${import.meta.env.BASE_URL}logo.png`
  const periods = (settings.periods || []).map((p) => ({ ...p, short: p.label.replace(/Quarter\s*/i, 'Q').replace(/Semester\s*/i, 'S').replace(/Term\s*/i, 'T') }))
  const rows = reviewRows(settings, { report, sections, history, cohortAvg, summativeAvg })
  const noteFor = (key) => courseNotes.find((n) => n.subject_key === key)
  const closing = ((vi && org.closing_vi) || org.closing || '').replace('{nickname}', nick).replace('{name}', student?.full_name || '')
  const clean = (list) => (list || []).filter((e) => (e || '').trim())
  const experiences = pick(clean(report.experiences).join('\n'), clean(report.experiences_vi).join('\n'))
  const voice = pick(report.student_voice, report.student_voice_vi)
  const cardTiers = ['specialist', 'vocational'].filter((k) => tiers[k].length)
  const cols = Math.max(3, ...cardTiers.map((k) => tiers[k].length))
  const reportDate = report.report_date
    ? new Date(`${report.report_date}T00:00:00`).toLocaleDateString(vi ? 'vi-VN' : 'en-GB', { day: 'numeric', month: vi ? 'numeric' : 'short', year: 'numeric' })
    : ''

  // Mark text boxes whose content is clipped, and count untranslated parts (screen only).
  const root = useRef(null)
  useLayoutEffect(() => {
    let overflow = 0
    root.current?.querySelectorAll('.fit').forEach((el) => {
      const clipped = el.scrollHeight > el.clientHeight + 1
      if (clipped) { overflow++; el.setAttribute('data-over', '') } else el.removeAttribute('data-over')
    })
    onCheck?.({ overflow, untranslated: root.current?.querySelectorAll('[data-untranslated]').length || 0 })
  })

  return (
    <div ref={root} lang={vi ? 'vi' : 'en'} className={`rpt ${compact ? 'compact' : ''} ${vi ? 'vi' : ''}`}>
      <div className="sheet">
        {/* ---- header ---- */}
        <header style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr', alignItems: 'center', gap: 8, borderBottom: '2px solid var(--navy)', paddingBottom: 4, flex: 'none' }}>
          <div>
            <img src={logo} alt={org.name} style={{ height: '10.5mm', display: 'block' }} />
            <div style={{ fontSize: '6.2pt', color: 'var(--blue)', fontWeight: 600, marginTop: 1 }}>{org.tagline}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '15pt', fontWeight: 900, letterSpacing: '.02em', color: 'var(--navy)', lineHeight: 1.1, textTransform: 'uppercase' }}>{(vi && org.docTitle_vi) || org.docTitle}</div>
            <div style={{ fontSize: '9pt', fontWeight: 700, color: 'var(--blue)', marginTop: 2 }}>{periodLabel(report.period_label, lang)} <span style={{ color: '#94a3b8' }}>•</span> {report.school_year}</div>
          </div>
          <div className="badge" style={{ justifySelf: 'end', minWidth: '34mm', textAlign: 'right' }}>
            <div style={{ fontWeight: 900, fontSize: '10.5pt', letterSpacing: '.03em' }}>{yearGroup.toUpperCase()}</div>
            <div style={{ fontSize: '6.8pt', fontWeight: 600 }}>{(vi && template.program_vi) || template.program || template.name || ''}</div>
            {reportDate && <div style={{ fontSize: '6.2pt', opacity: 0.85, marginTop: 1 }}>{reportDate}</div>}
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
              <div style={{ marginTop: 2, fontSize: '7.4pt' }}><b>{yearGroup}</b></div>
              {report.homeroom_teacher && <div style={{ fontSize: '7.4pt' }}>{t.homeroom}: <b>{report.homeroom_teacher}</b></div>}
            </div>
          </div>
          <div className="box" style={{ background: '#eef4fb', borderColor: '#cfe0f3', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="kicker" style={{ color: 'var(--navy)' }}>{t.homeroomComment}</div>
            <Text picked={pick(report.homeroom_note, report.homeroom_note_vi)} style={{ flex: 1, marginTop: 1 }} />
          </div>
        </section>

        {/* ---- academic learning ---- */}
        {tiers.academic.length > 0 && (
          <section className="sec" style={{ flex: '1 1 0' }}>
            <div className="sec-h">
              <span>{t.tiers.academic}</span>
              <span style={{ display: 'flex', gap: 7, fontWeight: 600, letterSpacing: 0, textTransform: 'none', fontSize: '6.4pt' }}>
                {levels.map((l) => (
                  <span key={l.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    <span className="dot" style={{ background: l.color, width: 10, height: 10, fontSize: '5.6pt', boxShadow: '0 0 0 1px rgba(255,255,255,.5)' }}>{l.code}</span>{nameIn(l, vi)}
                  </span>
                ))}
              </span>
            </div>
            <div className="area-rows" style={{ gridTemplateRows: `repeat(${tiers.academic.length}, minmax(0, 1fr))` }}>
              {tiers.academic.map((s) => {
                const sub = subjectByKey(settings, s.subject_key)
                const note = noteFor(s.subject_key)
                const next = pick(s.next_focus, s.next_focus_vi)
                return (
                  <div key={s.id} className="area-row">
                    <div className="area-name">
                      <div className="area-title"><Icon name={sub.icon} size={11} /> {nameIn(sub, vi)}</div>
                      {s.teacher_name && <div className="muted" style={{ fontSize: '6.4pt', marginTop: -2 }}>{s.teacher_name}</div>}
                      <div style={{ marginTop: 1 }}><LevelPill settings={settings} value={s.level} vi={vi} t={t} /></div>
                    </div>
                    <div className="area-body">
                      {(note?.description || '').trim() && <Text className="topics" picked={pick(note.description, note.description_vi)} label={t.topicsCovered} tone="green" />}
                      <Text picked={pick(s.comment, s.comment_vi)} />
                      {next.text.trim() && <Text className="next" picked={next} label={t.nextFocus} />}
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
              <div className="sec-h"><span>{t.scores}</span></div>
              <table className="scores">
                <thead><tr>
                  <th style={{ width: '25%' }}>{t.learningArea}</th>
                  {periods.map((p) => <th key={p.index} className={Number(p.index) === Number(report.period_index) ? 'cur' : ''}>{p.short}</th>)}
                  <th className="sum" style={{ lineHeight: 1.05 }}>{t.summative}<div style={{ fontSize: '5.2pt', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>{t.endOfYearTest}</div></th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td style={{ fontWeight: 700, fontSize: '7.4pt', color: 'var(--navy)', whiteSpace: 'nowrap' }}>{nameIn(subjectByKey(settings, r.key), vi)}</td>
                      {r.cells.map((c, i) => <td key={i} className={Number(periods[i].index) === Number(report.period_index) ? 'cur' : ''}><ScoreCell cell={c} t={t} /></td>)}
                      <td className="sum"><ScoreCell cell={r.summative} t={t} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="muted" style={{ fontSize: '5.8pt', padding: '1.5px 7px 2px', borderTop: '1px solid var(--line)', background: 'var(--soft)' }}>{t.scoresKey}</div>
            </div>
          )}
          <div className="sec">
            <div className="sec-h"><span>{t.howILearn}</span></div>
            <div className="skills">
              {(settings.skillGroups || []).map((g) => (
                <div key={g.key}>
                  <div className="kicker" style={{ padding: '1px 0', fontSize: '5.9pt' }}>{nameIn(g, vi)}</div>
                  {g.items.map((it) => (
                    <div key={it.key} className="skill-row">
                      <span><Icon name={it.icon} size={8} style={{ color: 'var(--navy)' }} />{nameIn(it, vi)}</span>
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
              <span>{t.tiers[tier]}</span>
              <span className="sub" style={{ fontSize: '6.4pt' }}>{tier === 'specialist' ? t.specialistNote(nick) : t.vocationalNote(yearGroup)}</span>
            </div>
            <div className="cards" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {tiers[tier].map((s) => {
                const sub = subjectByKey(settings, s.subject_key)
                const note = noteFor(s.subject_key)
                return (
                  <div key={s.id} className="card-a">
                    <div className="card-head">
                      <span className="t"><Icon name={sub.icon} size={10} /> {nameIn(sub, vi)}</span>
                    </div>
                    <div className="card-sub">
                      <span className="teacher">{s.teacher_name}</span>
                      <LevelPill settings={settings} value={s.level} vi={vi} t={t} />
                    </div>
                    {tier === 'vocational'
                      ? <Text picked={pick(note?.description, note?.description_vi)} label={t.topicsCovered} tone="green" />
                      : <Text picked={pick(s.comment, s.comment_vi)} label={t.comment} tone="blue" />}
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        {/* ---- experiences, student voice, signatures ---- */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.15fr 1.3fr 0.7fr', gap: '3mm', height: '20.5mm', flex: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="kicker">{t.experiences}</div>
            <ul className="bullets fit" style={{ flex: 1, marginTop: 1 }} data-untranslated={experiences.missing ? '' : undefined}>
              {experiences.text ? experiences.text.split('\n').map((e, i) => <li key={i}>{e}</li>) : <li className="muted">—</li>}
            </ul>
          </div>
          <div className="box" style={{ background: '#fffbeb', borderColor: '#fde68a', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="kicker" style={{ color: '#92400e' }}>{t.inWords(nick)}</div>
            <div className="quote fit" style={{ flex: 1, marginTop: 1 }} data-untranslated={voice.missing ? '' : undefined}>{voice.text ? `"${voice.text}"` : '—'}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', gap: 2 }}>
            {(report.signatures || []).map((sg, i) => (
              <div key={i}>
                <div style={{ fontFamily: "'Segoe Script', 'Brush Script MT', cursive", fontSize: '8.5pt', color: 'var(--navy)', minHeight: 12, lineHeight: 1.2 }}>{sg.name}</div>
                <div className="sig-line"><b style={{ color: 'var(--ink)' }}>{roleLabel(sg.role, lang)}</b></div>
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
