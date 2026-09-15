import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, ArrowUp, ArrowDown, Save, RotateCcw, ArrowLeft } from 'lucide-react'
import { useData } from '../../lib/DataContext'
import { useAuth } from '../../lib/AuthContext'
import { db } from '../../lib/db'
import { DEFAULT_REPORT_SETTINGS, TIERS } from '../../lib/report/defaults'
import { LEVELS as YEAR_GROUPS } from '../../lib/fees'
import { ICONS } from '../../components/report/icons'
import { Card, Field, TextInput, TextArea, Select, Checkbox, Empty, Spinner } from '../../components/ui'

const clone = (x) => JSON.parse(JSON.stringify(x))
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

export default function ReportSettings() {
  const { reportSettings, loading } = useData()
  const { isHead } = useAuth()
  if (!isHead) return <Empty text="Only the head teacher can change report settings." />
  if (loading || !reportSettings) return <Spinner />
  return <SettingsForm initial={reportSettings} />
}

function SettingsForm({ initial }) {
  const { refresh } = useData()
  const [s, setS] = useState(() => clone(initial))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const set = (path, v) => setS((cur) => { const n = clone(cur); let o = n; const ks = path.split('.'); for (const k of ks.slice(0, -1)) o = o[k]; o[ks.at(-1)] = v; return n })
  const arr = (path) => path.split('.').reduce((o, k) => o[k], s)
  const move = (path, i, d) => { const a = clone(arr(path)); const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set(path, a) }
  const del = (path, i) => set(path, arr(path).filter((_, j) => j !== i))
  const add = (path, item) => set(path, [...arr(path), item])
  const save = async () => {
    setBusy(true)
    try { await db.setReportSettings(s); await refresh(); setMsg('Saved.'); setTimeout(() => setMsg(''), 3000) } catch (e) { alert(e.message) } finally { setBusy(false) }
  }
  const reset = () => { if (confirm('Reset every report setting to the built-in defaults? Nothing is saved until you press Save.')) setS(clone(DEFAULT_REPORT_SETTINGS)) }
  const iconOpts = Object.keys(ICONS).map((k) => ({ value: k, label: k }))

  return (
    <div className="space-y-5">
      <div className="sticky top-[57px] z-30 -mx-4 flex items-center gap-2 border-b border-slate-200 bg-[#f5f7fa]/95 px-4 py-2 backdrop-blur">
        <Link to="/reports" className="btn-ghost"><ArrowLeft size={16} /></Link>
        <h1 className="mr-auto text-2xl font-black text-slate-800">Report settings</h1>
        {msg && <span className="text-sm font-semibold text-green-700">{msg}</span>}
        <button className="btn-secondary" onClick={reset}><RotateCcw size={16} /> Defaults</button>
        <button className="btn-primary" onClick={save} disabled={busy}><Save size={16} /> Save</button>
      </div>

      <Card title="Wording" subtitle="Printed on every report.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Document title"><TextInput value={s.org.docTitle} onChange={(v) => set('org.docTitle', v)} /></Field>
          <Field label="Document title (Vietnamese)"><TextInput value={s.org.docTitle_vi} onChange={(v) => set('org.docTitle_vi', v)} /></Field>
          <Field label="Tagline under the logo"><TextInput value={s.org.tagline} onChange={(v) => set('org.tagline', v)} /></Field>
          <Field label="Footer line (legal name)"><TextInput value={s.org.legalLine} onChange={(v) => set('org.legalLine', v)} /></Field>
          <Field label="Closing message" className="sm:col-span-2" hint="{nickname} is replaced by the student's nickname. Leave blank to print none."><TextInput value={s.org.closing} onChange={(v) => set('org.closing', v)} /></Field>
          <Field label="Closing message (Vietnamese report)" className="sm:col-span-2"><TextInput value={s.org.closing_vi || ''} onChange={(v) => set('org.closing_vi', v)} /></Field>
        </div>
      </Card>

      <Card title="Year and reporting periods" subtitle="Reports are grouped by period. Dates decide which period is selected by default.">
        <Field label="School year" className="mb-3 max-w-xs"><TextInput value={s.schoolYear} onChange={(v) => set('schoolYear', v)} /></Field>
        <div className="space-y-2">
          {s.periods.map((p, i) => (
            <div key={i} className="grid items-end gap-2 sm:grid-cols-[60px_1fr_1fr_1fr_auto]">
              <Field label="#"><TextInput value={p.index} onChange={(v) => set(`periods.${i}.index`, Number(v) || i + 1)} /></Field>
              <Field label="Label"><TextInput value={p.label} onChange={(v) => set(`periods.${i}.label`, v)} /></Field>
              <Field label="Start"><TextInput type="date" value={p.start} onChange={(v) => set(`periods.${i}.start`, v)} /></Field>
              <Field label="End"><TextInput type="date" value={p.end} onChange={(v) => set(`periods.${i}.end`, v)} /></Field>
              <button className="btn-ghost" onClick={() => del('periods', i)}><Trash2 size={16} /></button>
            </div>
          ))}
          <button className="btn-secondary text-xs" onClick={() => add('periods', { index: s.periods.length + 1, label: `Quarter ${s.periods.length + 1}`, start: '', end: '' })}><Plus size={14} /> Add period</button>
        </div>
      </Card>

      <Card title="Progress levels" subtitle="The scale used for every learning area and learner skill.">
        <div className="space-y-3">
          {s.levels.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[50px_60px_1fr_1fr_90px]">
              <Field label="Value"><TextInput value={l.value} onChange={(v) => set(`levels.${i}.value`, Number(v))} /></Field>
              <Field label="Code"><TextInput value={l.code} onChange={(v) => set(`levels.${i}.code`, v.slice(0, 2))} /></Field>
              <Field label="Name"><TextInput value={l.name} onChange={(v) => set(`levels.${i}.name`, v)} /></Field>
              <Field label="Vietnamese"><TextInput value={l.name_vi} onChange={(v) => set(`levels.${i}.name_vi`, v)} /></Field>
              <Field label="Colour"><input type="color" className="input h-[38px] p-1" value={l.color} onChange={(e) => set(`levels.${i}.color`, e.target.value)} /></Field>
              <Field label="Description" className="sm:col-span-5"><TextArea rows={2} value={l.desc} onChange={(v) => set(`levels.${i}.desc`, v)} /></Field>
              <Field label="Description (Vietnamese)" className="sm:col-span-5"><TextArea rows={2} value={l.desc_vi} onChange={(v) => set(`levels.${i}.desc_vi`, v)} /></Field>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Learning areas" subtitle="The tier decides how an area prints: academic (level, review score, comment), specialist (level, comment) or vocational (level, plus topics covered shared by the year group). The key gives teachers their permissions, so avoid renaming keys once reports exist.">
        <div className="space-y-3">
          {s.subjects.map((sub, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_1fr_130px_120px_auto]">
              <Field label="Name"><TextInput value={sub.name} onChange={(v) => set(`subjects.${i}.name`, v)} /></Field>
              <Field label="Vietnamese"><TextInput value={sub.name_vi} onChange={(v) => set(`subjects.${i}.name_vi`, v)} /></Field>
              <Field label="Key"><TextInput value={sub.key} onChange={(v) => set(`subjects.${i}.key`, slug(v))} /></Field>
              <Field label="Tier"><Select value={sub.kind} onChange={(v) => set(`subjects.${i}.kind`, v)} options={TIERS.map((t) => ({ value: t.key, label: t.short }))} /></Field>
              <Field label="Icon"><Select value={sub.icon} onChange={(v) => set(`subjects.${i}.icon`, v)} options={iconOpts} /></Field>
              <div className="flex items-end gap-1 pb-1">
                <button className="btn-ghost px-2" onClick={() => move('subjects', i, -1)}><ArrowUp size={14} /></button>
                <button className="btn-ghost px-2" onClick={() => move('subjects', i, 1)}><ArrowDown size={14} /></button>
                <button className="btn-ghost px-2 text-red-500" onClick={() => del('subjects', i)}><Trash2 size={14} /></button>
              </div>
              <div className="sm:col-span-6">
                <div className="label">Only for year groups <span className="font-normal normal-case text-slate-400">{(sub.yearGroups || []).length ? '' : '(none ticked: every year group in its template)'}</span></div>
                <div className="flex flex-wrap gap-1">
                  {YEAR_GROUPS.map((g) => {
                    const on = (sub.yearGroups || []).includes(g)
                    return <button key={g} type="button" aria-pressed={on} onClick={() => set(`subjects.${i}.yearGroups`, on ? sub.yearGroups.filter((x) => x !== g) : [...(sub.yearGroups || []), g])}
                      className={`chip ${on ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-sky-100'}`}>{g}</button>
                  })}
                </div>
              </div>
              {sub.kind === 'academic' && <div className="sm:col-span-6"><Checkbox checked={sub.scored !== false} onChange={(v) => set(`subjects.${i}.scored`, v)} label="Has scores (Q1–Q4 quarterly reviews and the end-of-year summative test)" /></div>}
            </div>
          ))}
          <button className="btn-secondary text-xs" onClick={() => add('subjects', { key: `subject_${s.subjects.length + 1}`, kind: 'specialist', name: 'New area', name_vi: '', icon: 'star', scored: false })}><Plus size={14} /> Add learning area</button>
        </div>
      </Card>

      <Card title="Report templates" subtitle="Which learning areas a report contains, by stage. A student's year group decides which template they get.">
        <div className="space-y-4">
          {Object.keys(s.templates || {}).map((k) => {
            const t = s.templates[k]
            const toggleArea = (key) => (on) => set(`templates.${k}.areas`, on ? s.subjects.map((x) => x.key).filter((x) => x === key || (t.areas || []).includes(x)) : (t.areas || []).filter((x) => x !== key))
            return (
              <div key={k} className="rounded-xl border border-slate-200 p-3">
                <div className="grid gap-2 sm:grid-cols-4">
                  <Field label="Template name"><TextInput value={t.name} onChange={(v) => set(`templates.${k}.name`, v)} /></Field>
                  <Field label="Program line (header badge)"><TextInput value={t.program || ''} onChange={(v) => set(`templates.${k}.program`, v)} /></Field>
                  <Field label="Program line (Vietnamese)"><TextInput value={t.program_vi || ''} onChange={(v) => set(`templates.${k}.program_vi`, v)} /></Field>
                  <div className="flex items-end justify-end pb-1"><button className="btn-danger text-xs" onClick={() => { if (confirm(`Remove template "${t.name}"?`)) setS((cur) => { const n = clone(cur); delete n.templates[k]; return n }) }}><Trash2 size={14} /> Remove</button></div>
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <div><div className="label">Year groups</div><div className="grid grid-cols-2 gap-1">{YEAR_GROUPS.map((g) => <Checkbox key={g} checked={(t.yearGroups || []).includes(g)} onChange={(on) => set(`templates.${k}.yearGroups`, on ? [...t.yearGroups, g] : t.yearGroups.filter((x) => x !== g))} label={g} />)}</div></div>
                  <div className="sm:col-span-2">
                    <div className="label">Learning areas</div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {TIERS.map((tier) => (
                        <div key={tier.key}>
                          <div className="mb-1 text-xs font-semibold text-slate-500">{tier.short}</div>
                          <div className="grid gap-1">
                            {s.subjects.filter((sub) => sub.kind === tier.key).map((sub) => <Checkbox key={sub.key} checked={(t.areas || []).includes(sub.key)} onChange={toggleArea(sub.key)} label={`${sub.name}${(sub.yearGroups || []).length ? ` (${sub.yearGroups.join(', ')})` : ''}`} />)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          <button className="btn-secondary text-xs" onClick={() => { const name = prompt('Template name (e.g. Primary)'); if (!name) return; const key = slug(name); setS((cur) => ({ ...cur, templates: { ...cur.templates, [key]: { key, name, program: `${name} Program`, yearGroups: [], areas: [] } } })) }}><Plus size={14} /> Add template</button>
        </div>
      </Card>

      <Card title="Learner skills (How I learn)">
        <div className="space-y-4">
          {s.skillGroups.map((g, gi) => (
            <div key={gi} className="rounded-xl border border-slate-200 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Field label="Group"><TextInput value={g.name} onChange={(v) => set(`skillGroups.${gi}.name`, v)} /></Field>
                <Field label="Vietnamese"><TextInput value={g.name_vi} onChange={(v) => set(`skillGroups.${gi}.name_vi`, v)} /></Field>
                <button className="btn-ghost self-end text-red-500" onClick={() => del('skillGroups', gi)}><Trash2 size={16} /></button>
              </div>
              <div className="mt-2 space-y-2">
                {g.items.map((it, ii) => (
                  <div key={ii} className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_120px_auto]">
                    <TextInput value={it.name} onChange={(v) => set(`skillGroups.${gi}.items.${ii}.name`, v)} placeholder="Skill" />
                    <TextInput value={it.name_vi} onChange={(v) => set(`skillGroups.${gi}.items.${ii}.name_vi`, v)} placeholder="Vietnamese" />
                    <TextInput value={it.key} onChange={(v) => set(`skillGroups.${gi}.items.${ii}.key`, slug(v))} placeholder="key" />
                    <Select value={it.icon} onChange={(v) => set(`skillGroups.${gi}.items.${ii}.icon`, v)} options={iconOpts} />
                    <button className="btn-ghost px-2 text-red-500" onClick={() => del(`skillGroups.${gi}.items`, ii)}><Trash2 size={14} /></button>
                  </div>
                ))}
                <button className="btn-secondary text-xs" onClick={() => add(`skillGroups.${gi}.items`, { key: `skill_${Date.now() % 10000}`, name: '', name_vi: '', icon: 'star' })}><Plus size={14} /> Add skill</button>
              </div>
            </div>
          ))}
          <button className="btn-secondary text-xs" onClick={() => add('skillGroups', { key: `group_${s.skillGroups.length + 1}`, name: 'New group', name_vi: '', items: [] })}><Plus size={14} /> Add group</button>
        </div>
      </Card>

      <Card title="Signature lines" subtitle="Roles printed at the bottom of each report. Names are filled in per report.">
        <div className="space-y-2">
          {s.signatures.map((sg, i) => (
            <div key={i} className="flex items-center gap-2"><TextInput value={sg.role} onChange={(v) => set(`signatures.${i}.role`, v)} /><button className="btn-ghost text-red-500" onClick={() => del('signatures', i)}><Trash2 size={16} /></button></div>
          ))}
          <button className="btn-secondary text-xs" onClick={() => add('signatures', { role: 'Principal', name: '' })}><Plus size={14} /> Add signature line</button>
        </div>
      </Card>
    </div>
  )
}
