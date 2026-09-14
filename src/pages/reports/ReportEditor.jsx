import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Printer, Eye, EyeOff, Lock, ChevronDown, ChevronUp } from 'lucide-react'
import { useData } from '../../lib/DataContext'
import { useAuth } from '../../lib/AuthContext'
import { db, genId } from '../../lib/db'
import { loadReportBundle } from '../../lib/report/loaders'
import { subjectByKey, completion, wordCount, levelInfo } from '../../lib/report/utils'
import { Card, Field, TextInput, TextArea, NumberInput, Select, Checkbox, Spinner, LevelPicker, SaveState, BulletList, ReportStatusChip } from '../../components/ui'
import { Icon } from '../../components/report/icons'
import ReportDocument from '../../components/report/ReportDocument'

const SAVE_DELAY = 900

export default function ReportEditor() {
  const { id } = useParams()
  const { reportSettings: settings, teachers } = useData()
  const { me, isHead, canSubject, canHomeroom, displayName } = useAuth()
  const [bundle, setBundle] = useState(null)
  const [report, setReport] = useState(null)
  const [sections, setSections] = useState([])
  const [notes, setNotes] = useState({})
  const [err, setErr] = useState('')
  const [saveState, setSaveState] = useState('idle')
  const [preview, setPreview] = useState(false)

  // `latest` mirrors the three pieces of state so rapid keystrokes always build
  // on the newest value; it is only touched inside event handlers.
  const latest = useRef({ report: null, sections: [], notes: {} })
  const timers = useRef({})
  const pending = useRef({})

  useEffect(() => {
    loadReportBundle(id).then((b) => {
      const notesMap = Object.fromEntries(b.courseNotes.map((n) => [n.subject_key, n]))
      latest.current = { report: b.report, sections: b.sections, notes: notesMap }
      setBundle(b); setReport(b.report); setSections(b.sections); setNotes(notesMap)
    }).catch((e) => setErr(e.message))
  }, [id])

  const queue = useCallback((key, fn) => {
    clearTimeout(timers.current[key])
    pending.current[key] = fn
    setSaveState('saving')
    timers.current[key] = setTimeout(async () => {
      delete pending.current[key]
      try {
        await fn()
        if (Object.keys(pending.current).length) return
        setSaveState('saved')
        setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2500)
      } catch (e) { console.error(e); setSaveState('error') }
    }, SAVE_DELAY)
  }, [])
  // Flush anything still pending when leaving the page.
  useEffect(() => () => { for (const [k, fn] of Object.entries(pending.current)) { clearTimeout(timers.current[k]); fn().catch(console.error) } }, [])

  const patchReport = (p) => {
    const n = { ...latest.current.report, ...p }; latest.current.report = n; setReport(n)
    queue('report', () => db.reports.save(n))
  }
  const patchSection = (sid, p) => {
    const list = latest.current.sections.map((s) => (s.id === sid ? { ...s, ...p, updated_by: me?.email || null } : s))
    latest.current.sections = list; setSections(list)
    queue(`section:${sid}`, () => db.sections.save(list.find((s) => s.id === sid)))
  }
  const patchNote = (key, p) => {
    const r = latest.current.report
    const cur = latest.current.notes[key] || { id: genId(), school_year: r.school_year, period_label: r.period_label, year_group: r.year_group, subject_key: key, description: '', description_vi: '', teacher_name: '' }
    const n = { ...cur, ...p }
    const map = { ...latest.current.notes, [key]: n }; latest.current.notes = map; setNotes(map)
    queue(`note:${key}`, () => db.courseNotes.save(n))
  }

  if (err) return <div className="p-8 text-red-600">{err}</div>
  if (!bundle || !report || !settings) return <Spinner />

  const student = bundle.student
  const published = report.status === 'published'
  const homeroomOk = canHomeroom(report) && (!published || isHead)
  const subjectOk = (key) => canSubject(key) && (!published || isHead)
  const levels = settings.levels || []
  const bi = report.lang === 'bi'
  const academic = sections.filter((s) => s.kind === 'academic'), vocational = sections.filter((s) => s.kind !== 'academic')
  const comp = completion(report, sections)
  const teacherNames = teachers.filter((t) => t.active !== false).map((t) => `${t.title ? t.title + ' ' : ''}${t.name}`)
  const docProps = { ...bundle, report, sections, courseNotes: Object.values(notes), settings }

  return (
    <div className={`grid gap-6 ${preview ? 'xl:grid-cols-[1fr_auto]' : ''}`}>
      <div className="min-w-0 space-y-5">
        <div className="sticky top-[57px] z-30 -mx-4 border-b border-slate-200 bg-[#f5f7fa]/95 px-4 py-2 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/reports" className="btn-ghost"><ArrowLeft size={16} /></Link>
            {student?.photo ? <img src={student.photo} alt="" className="h-9 w-9 rounded-full object-cover" /> : null}
            <div className="mr-auto">
              <div className="font-bold leading-tight">{student?.full_name || report.student_name}</div>
              <div className="text-xs text-slate-500">{report.year_group} · {report.period_label} {report.school_year} · {comp.pct}% complete</div>
            </div>
            <SaveState state={saveState} />
            {homeroomOk ? (
              <select className="input w-auto" value={report.status} onChange={(e) => patchReport({ status: e.target.value })}>
                <option value="draft">Draft</option><option value="ready">Ready to review</option><option value="published">Published</option>
              </select>
            ) : <ReportStatusChip status={report.status} />}
            <button className="btn-secondary hidden xl:inline-flex" onClick={() => setPreview((v) => !v)}>{preview ? <EyeOff size={16} /> : <Eye size={16} />} Preview</button>
            <Link to={`/print/report/${id}`} target="_blank" className="btn-primary"><Printer size={16} /> Print</Link>
          </div>
          {published && !isHead && <div className="mt-1 text-xs font-semibold text-amber-700">This report is published. Only the head teacher can change it now.</div>}
        </div>

        <Card title="Overview" locked={!homeroomOk} subtitle="Report details and the opening summary. Homeroom teacher or head.">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Report date"><TextInput type="date" value={report.report_date || ''} onChange={(v) => patchReport({ report_date: v })} disabled={!homeroomOk} /></Field>
            <Field label="Homeroom teacher"><input className="input" list="teacher-names" value={report.homeroom_teacher || ''} onChange={(e) => patchReport({ homeroom_teacher: e.target.value })} disabled={!homeroomOk} /><datalist id="teacher-names">{teacherNames.map((n) => <option key={n} value={n} />)}</datalist></Field>
            <Field label="Class name" hint="Optional, e.g. Secondary"><TextInput value={report.class_name} onChange={(v) => patchReport({ class_name: v })} disabled={!homeroomOk} /></Field>
            <Field label="Printed language"><Select value={report.lang || 'en'} onChange={(v) => patchReport({ lang: v })} disabled={!homeroomOk} options={[{ value: 'en', label: 'English' }, { value: 'bi', label: 'English + Vietnamese' }]} /></Field>
          </div>
          <Field label="This period at a glance" className="mt-3" right={`${wordCount(report.glance)} words · about 60 fits`}>
            <TextArea rows={3} value={report.glance} onChange={(v) => patchReport({ glance: v })} disabled={!homeroomOk} placeholder={`How has ${student?.nickname || 'the student'} settled in and approached learning this period?`} />
          </Field>
        </Card>

        <div>
          <h2 className="mb-2 text-lg font-bold">Academic learning</h2>
          <div className="space-y-4">
            {academic.map((s) => (
              <SubjectCard key={s.id} section={s} settings={settings} levels={levels} bi={bi} editable={subjectOk(s.subject_key)} onPatch={(p) => patchSection(s.id, p)}
                cohortAvg={bundle.cohortAvg[s.subject_key]} note={notes[s.subject_key]} onNote={(p) => patchNote(s.subject_key, p)} signName={displayName} />
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-bold">Specialist &amp; vocational learning</h2>
          <div className="space-y-4">
            {vocational.map((s) => (
              <SubjectCard key={s.id} section={s} settings={settings} levels={levels} bi={bi} editable={subjectOk(s.subject_key)} onPatch={(p) => patchSection(s.id, p)}
                cohortAvg={bundle.cohortAvg[s.subject_key]} note={notes[s.subject_key]} onNote={(p) => patchNote(s.subject_key, p)} signName={displayName} compact />
            ))}
          </div>
        </div>

        <Card title="How I learn" locked={!homeroomOk} subtitle="Learner skills. The note under a skill is optional and prints in small text.">
          <div className="space-y-4">
            {(settings.skillGroups || []).map((g) => (
              <div key={g.key}>
                <div className="label">{g.name}</div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((it) => (
                    <div key={it.key} className="rounded-xl border border-slate-200 p-3">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><Icon name={it.icon} size={15} className="text-pra-navy" /> {it.name}</div>
                      <LevelPicker size="sm" levels={levels} value={report.skills?.[it.key]} disabled={!homeroomOk} onChange={(v) => patchReport({ skills: { ...(report.skills || {}), [it.key]: v } })} />
                      <input className="input mt-2 text-xs" placeholder="Optional short note" value={report.skill_notes?.[it.key] || ''} disabled={!homeroomOk} onChange={(e) => patchReport({ skill_notes: { ...(report.skill_notes || {}), [it.key]: e.target.value } })} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Homeroom teacher note" locked={!homeroomOk}>
          <Field label="Note" right={`${wordCount(report.homeroom_note)} words · about 120 fits`}><TextArea rows={5} value={report.homeroom_note} onChange={(v) => patchReport({ homeroom_note: v })} disabled={!homeroomOk} /></Field>
          {bi && <Field label="Vietnamese" className="mt-3"><TextArea rows={5} value={report.homeroom_note_vi} onChange={(v) => patchReport({ homeroom_note_vi: v })} disabled={!homeroomOk} /></Field>}
        </Card>

        <Card title="Experiences and student voice" locked={!homeroomOk}>
          <div className="label">Experiences &amp; growth this period</div>
          <BulletList items={report.experiences} onChange={(v) => patchReport({ experiences: v })} disabled={!homeroomOk} placeholder="Add an experience" />
          <Field label="In the student's words" className="mt-4" hint="What they enjoyed most this period."><TextArea rows={2} value={report.student_voice} onChange={(v) => patchReport({ student_voice: v })} disabled={!homeroomOk} /></Field>
          <Field label="Note under the progress chart" className="mt-4" hint="Optional. Blank prints a one-line explanation of the class reference."><TextArea rows={2} value={report.overview_note} onChange={(v) => patchReport({ overview_note: v })} disabled={!homeroomOk} /></Field>
          <div className="mt-3"><Checkbox checked={!!report.show_course_notes} onChange={(v) => patchReport({ show_course_notes: v })} disabled={!homeroomOk} label="Print the 'What we studied this period' notes" /></div>
        </Card>

        <Card title="Signatures" locked={!homeroomOk} subtitle="Names printed on the signature lines.">
          <div className="grid gap-3 sm:grid-cols-2">
            {(report.signatures || []).map((sg, i) => (
              <Field key={i} label={sg.role}><TextInput value={sg.name} disabled={!homeroomOk} onChange={(v) => patchReport({ signatures: report.signatures.map((x, j) => (j === i ? { ...x, name: v } : x)) })} /></Field>
            ))}
          </div>
        </Card>
      </div>

      {preview && (
        <div className="hidden xl:block">
          <div className="sticky top-[70px] max-h-[calc(100vh-80px)] overflow-auto rounded-xl border border-slate-300 bg-slate-200 p-3 shadow-inner" style={{ width: 'calc(210mm * 0.62 + 24px)' }}>
            <div style={{ zoom: 0.62 }}><ReportDocument {...docProps} /></div>
          </div>
        </div>
      )}
    </div>
  )
}

function SubjectCard({ section: s, settings, levels, bi, editable, onPatch, cohortAvg, note, onNote, signName, compact = false }) {
  const sub = subjectByKey(settings, s.subject_key)
  const [showNote, setShowNote] = useState(false)
  const scored = sub.scored !== false && !compact
  return (
    <Card locked={!editable} className="!p-4" title={<span className="flex items-center gap-2"><Icon name={sub.icon} size={18} className="text-pra-navy" /> {sub.name}</span>}
      actions={editable && !s.teacher_name && signName ? <button className="btn-ghost text-xs" onClick={() => onPatch({ teacher_name: signName })}>Sign as {signName}</button> : null}>
      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <div className="space-y-3">
          <div>
            <div className="label">Previous level</div>
            <LevelPicker size="sm" levels={levels} value={s.level_prev} disabled={!editable} onChange={(v) => onPatch({ level_prev: v })} />
          </div>
          <div>
            <div className="label">This period</div>
            <LevelPicker levels={levels} value={s.level} disabled={!editable} onChange={(v) => onPatch({ level: v })} />
            <div className="mt-1 text-xs text-slate-500">{levelInfo(settings, s.level)?.name || 'Not yet assessed'}</div>
          </div>
          {scored && (
            <div className="space-y-2 rounded-lg bg-slate-50 p-2">
              <div className="label !mb-0">Progress review score</div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Raw"><TextInput value={s.score_raw} onChange={(v) => onPatch({ score_raw: v })} disabled={!editable} placeholder="45/50" /></Field>
                <Field label="%"><NumberInput value={s.score_pct} onChange={(v) => onPatch({ score_pct: v })} disabled={!editable} min={0} max={100} /></Field>
              </div>
              <Field label="Class reference %" right={cohortAvg != null ? <button type="button" className="font-semibold text-pra-blue" disabled={!editable} onClick={() => onPatch({ class_avg: cohortAvg })}>use {cohortAvg}%</button> : 'no cohort scores yet'}>
                <NumberInput value={s.class_avg} onChange={(v) => onPatch({ class_avg: v })} disabled={!editable} min={0} max={100} />
              </Field>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <Field label="Teacher comment" right={`${wordCount(s.comment)} words · about ${compact ? 45 : 90} fits`}>
            <TextArea rows={compact ? 3 : 5} value={s.comment} onChange={(v) => onPatch({ comment: v })} disabled={!editable} placeholder="Strengths, progress and evidence from this period…" />
          </Field>
          {bi && <Field label="Vietnamese"><TextArea rows={compact ? 3 : 5} value={s.comment_vi} onChange={(v) => onPatch({ comment_vi: v })} disabled={!editable} /></Field>}
          <div className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-[1fr_auto]'}`}>
            {!compact && <Field label="Next focus" hint="One short sentence."><TextInput value={s.next_focus} onChange={(v) => onPatch({ next_focus: v })} disabled={!editable} /></Field>}
            <Field label="Teacher"><TextInput value={s.teacher_name} onChange={(v) => onPatch({ teacher_name: v })} disabled={!editable} placeholder="Mr. Alex" /></Field>
          </div>
          <button type="button" className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-pra-blue" onClick={() => setShowNote((v) => !v)}>
            {showNote ? <ChevronUp size={14} /> : <ChevronDown size={14} />} What we studied this period {note?.description ? '(filled)' : '(optional, shared by the whole year group)'} {!editable && <Lock size={12} />}
          </button>
          {showNote && (
            <div className="space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
              <p className="text-xs text-slate-500">Shared by every {sub.name} report in this year group for this period. Prints only when the option is ticked under Experiences.</p>
              <TextArea rows={3} value={note?.description || ''} onChange={(v) => onNote({ description: v })} disabled={!editable} placeholder="Course description for this period…" />
              {bi && <TextArea rows={3} value={note?.description_vi || ''} onChange={(v) => onNote({ description_vi: v })} disabled={!editable} placeholder="Mô tả khóa học…" />}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
