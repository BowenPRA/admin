import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Trash2, Plus, ChevronRight, RotateCcw } from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { LEVELS, PROGRAMS, periodInfo, mealRateFor, bandFor } from '../lib/fees'
import { buildDocument, defaultStudentOptions, docTotals, PERIOD_OPTIONS, PLAN_OPTIONS, studentDisplayName } from '../lib/pricing'
import { fmt, todayISO } from '../lib/money'
import { Card, Field, TextInput, NumberInput, MoneyInput, Select, Checkbox, Spinner } from '../components/ui'

const PLAN_PERIOD_DEFAULT = { earlyBird: 'year', standard: 'year', quarterly: 'q1', split: 'sem1', weekly: 'custom', trial: 'custom', staff: 'q1', none: 'q1' }

function blankInputs(lang) {
  return {
    lang, periodId: 'q1', plan: 'quarterly', billQuarters: ['q1'],
    splits: [{ pct: 60, due: '2026-05-20' }, { pct: 40, due: '2026-10-08' }], billSplit: 0, splitBase: 'earlyBird',
    customRangeEn: '', customRangeVi: '', customLabelEn: 'the period', customLabelVi: 'kỳ',
    siblingDiscount: true, siblingStudentId: '',
    students: [], deductions: [], extraNotes: [''], cashOnly: false, flags: { forceMajeure: true },
  }
}

function dueDateFor(inputs, fees) {
  const d = fees.deadlines
  switch (inputs.plan) {
    case 'earlyBird': return d.earlyBird
    case 'standard': return d.standard
    case 'quarterly': { const first = ['q1', 'q2', 'q3', 'q4'].find((q) => inputs.billQuarters.includes(q)) || 'q1'; return d[first] }
    case 'split': return inputs.splits[inputs.billSplit]?.due || todayISO()
    default: {
      const t = new Date(); t.setDate(t.getDate() + 7); return t.toISOString().slice(0, 10)
    }
  }
}

export default function InvoiceBuilder() {
  const { t, lang: uiLang } = useT()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { loading, students, families, fees, calendar, refresh } = useData()
  const [inputs, setInputs] = useState(() => blankInputs(uiLang))
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState(null)
  const [loadedFrom, setLoadedFrom] = useState(null)
  const [showInactive, setShowInactive] = useState(false)

  // ?edit=<id> re-opens an existing invoice's options; ?copy=<id> duplicates.
  useEffect(() => {
    const id = params.get('edit') || params.get('copy')
    if (!id || loadedFrom === id) return
    db.invoices.get(id).then((inv) => {
      if (inv?.inputs) setInputs({ ...blankInputs(inv.lang), ...inv.inputs })
      if (params.get('edit')) setEditId(id)
      setLoadedFrom(id)
    })
  }, [params, loadedFrom])

  const famById = useMemo(() => Object.fromEntries(families.map((f) => [f.id, f])), [families])
  const set = (patch) => setInputs((s) => ({ ...s, ...patch }))

  const ctx = { periodId: inputs.periodId }
  const selectedIds = inputs.students.map((e) => e.student.id)

  const toggleStudent = (s) => {
    if (selectedIds.includes(s.id)) set({ students: inputs.students.filter((e) => e.student.id !== s.id) })
    else {
      const entry = { student: s, opts: defaultStudentOptions(s, fees, calendar, ctx) }
      const fam = famById[s.family_id]
      set({ students: [...inputs.students, entry], lang: inputs.students.length === 0 && fam?.language ? fam.language : inputs.lang })
    }
  }
  const pickFamily = (f) => {
    const kids = students.filter((s) => s.family_id === f.id && s.active !== false)
    set({ students: kids.map((s) => ({ student: s, opts: defaultStudentOptions(s, fees, calendar, ctx) })), lang: f.language || inputs.lang })
  }
  const pickInactiveFamily = async (f) => {
    const kids = students.filter((s) => s.family_id === f.id)
    if (!kids.length) return
    if (!confirm(t('reactivateConfirm'))) return
    setBusy(true)
    try {
      await db.students.saveMany(kids.map((s) => ({ ...s, active: true })))
      await refresh()
      const reactivated = kids.map((s) => ({ ...s, active: true }))
      set({ students: reactivated.map((s) => ({ student: s, opts: defaultStudentOptions(s, fees, calendar, ctx) })), lang: f.language || inputs.lang })
    } catch (e) { alert(e.message) } finally { setBusy(false) }
  }
  const setStudentProgram = (studentId, programId) => {
    set({
      students: inputs.students.map((e) => {
        if (e.student.id !== studentId) return e
        const s = { ...e.student, program: programId }
        const upper = bandFor(s.level) === 'upper' || ['hybrid', 'independent'].includes(programId)
        return {
          student: s,
          opts: {
            ...e.opts,
            upper,
            mealRate: mealRateFor(s.level, programId, fees),
            weeklyRate: upper ? fees.weekly.summerUpper : (bandFor(s.level) === 'y7_9' ? fees.weekly.vocationalY7_9 : bandFor(s.level) === 'nursery' ? fees.weekly.globalNursery : fees.weekly.vocationalY1_6),
          },
        }
      }),
    })
  }
  const setOpts = (id, patch) => set({ students: inputs.students.map((e) => (e.student.id === id ? { ...e, opts: { ...e.opts, ...patch } } : e)) })

  // Period or plan change: refresh day/month counts for everyone.
  const changePeriod = (periodId) => {
    const p = periodInfo(periodId, calendar)
    set({ periodId, students: inputs.students.map((e) => ({ ...e, opts: { ...e.opts, mealDays: periodId === 'custom' ? e.opts.mealDays : p.days, transportMonths: periodId === 'custom' ? e.opts.transportMonths : p.months } })) })
  }
  const changePlan = (plan) => {
    const periodId = PLAN_PERIOD_DEFAULT[plan] || inputs.periodId
    const billQuarters = plan === 'quarterly' ? ['q1'] : inputs.billQuarters
    const p = periodInfo(periodId, calendar)
    set({ plan, periodId, billQuarters, students: inputs.students.map((e) => ({ ...e, opts: { ...e.opts, mealDays: periodId === 'custom' ? e.opts.mealDays : p.days, transportMonths: periodId === 'custom' ? e.opts.transportMonths : p.months, meals: plan === 'trial' ? false : e.opts.meals } })) })
  }
  const toggleQuarter = (qid) => {
    const next = inputs.billQuarters.includes(qid) ? inputs.billQuarters.filter((x) => x !== qid) : [...inputs.billQuarters, qid].sort()
    if (!next.length) return
    // billing one quarter: meals/transport for that quarter; several: sum them
    const days = next.reduce((s, x) => s + periodInfo(x, calendar).days, 0)
    const months = next.reduce((s, x) => s + periodInfo(x, calendar).months, 0)
    const periodId = next.length === 1 ? next[0] : (next.join('') === 'q1q2' ? 'sem1' : next.join('') === 'q3q4' ? 'sem2' : next.length === 4 ? 'year' : inputs.periodId)
    set({ billQuarters: next, periodId, students: inputs.students.map((e) => ({ ...e, opts: { ...e.opts, mealDays: days, transportMonths: months } })) })
  }

  const doc = useMemo(() => (fees && calendar ? buildDocument(inputs, fees, calendar) : null), [inputs, fees, calendar])
  const totals = doc ? docTotals(doc) : null

  const create = async () => {
    if (!inputs.students.length) return
    setBusy(true)
    try {
      const names = inputs.students.map((e) => e.student.nickname || e.student.full_name).join(', ')
      const famIds = [...new Set(inputs.students.map((e) => e.student.family_id).filter(Boolean))]
      const famName = famIds.map((id) => famById[id]?.name).filter(Boolean).join(' / ')
      const existing = editId ? await db.invoices.get(editId) : null
      const row = {
        ...(existing || {}),
        id: existing?.id,
        number: existing?.number || await db.nextNumber('invoice', fees.schoolYear),
        family_id: famIds[0] || null, family_name: famName,
        student_ids: inputs.students.map((e) => e.student.id), student_names: names,
        school_year: fees.schoolYear, lang: inputs.lang,
        period_label: inputs.lang === 'vi' ? doc.periodLabelVi : doc.periodLabelEn,
        status: existing?.status || 'draft',
        issue_date: existing?.issue_date || todayISO(), due_date: existing?.due_date || dueDateFor(inputs, fees),
        total: totals.total, paid: existing?.paid || 0,
        inputs, doc, notes: existing?.notes || '',
      }
      const saved = await db.invoices.save(row)
      navigate(`/invoices/${saved.id}`)
    } finally { setBusy(false) }
  }

  if (loading || !fees || !calendar) return <Spinner />

  const needle = q.trim().toLowerCase()
  const visible = students.filter((s) => showInactive || s.active !== false).filter((s) => !needle || `${s.full_name} ${s.nickname} ${famById[s.family_id]?.name || ''}`.toLowerCase().includes(needle))
    .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.full_name.localeCompare(b.full_name))

  const quarterlyLike = inputs.plan === 'quarterly'
  const showTuitionOpts = !['staff', 'trial', 'none'].includes(inputs.plan)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <h1 className="text-2xl font-black text-slate-800">{editId ? t('edit') : t('newInvoice')}</h1>

        {/* 1. Students */}
        <Card title={t('chooseStudents')}>
          <p className="mb-3 text-xs text-slate-500">{t('selectFamilyHint')}</p>
          <div className="mb-3 flex items-center gap-3">
            <input className="input flex-1" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none whitespace-nowrap">
              <input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              {t('showInactiveFamilies')}
            </label>
          </div>
          {(() => {
            const activeFamilies = families
              .filter((f) => students.some((s) => s.family_id === f.id && s.active !== false))
              .filter((f) => !needle || f.name.toLowerCase().includes(needle) || students.some((s) => s.family_id === f.id && `${s.full_name} ${s.nickname}`.toLowerCase().includes(needle)))
              .sort((a, b) => a.name.localeCompare(b.name))
            const inactiveFamilies = showInactive ? families
              .filter((f) => !students.some((s) => s.family_id === f.id && s.active !== false))
              .filter((f) => students.some((s) => s.family_id === f.id))
              .filter((f) => !needle || f.name.toLowerCase().includes(needle) || students.some((s) => s.family_id === f.id && `${s.full_name} ${s.nickname}`.toLowerCase().includes(needle)))
              .sort((a, b) => a.name.localeCompare(b.name)) : []
            return (
              <>
                {activeFamilies.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {activeFamilies.map((f) => {
                      const kids = students.filter((s) => s.family_id === f.id && s.active !== false)
                      const allSelected = kids.every((s) => selectedIds.includes(s.id))
                      return (
                        <button key={f.id} onClick={() => pickFamily(f)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${allSelected ? 'border-pra-blue bg-pra-blue text-white' : 'border-slate-300 bg-white hover:border-pra-blue hover:text-pra-blue'}`}
                          title={kids.map((s) => `${s.nickname || s.full_name} (${s.level})`).join(', ')}>
                          {f.name}
                          {kids.length > 1 && <span className="ml-1 opacity-60">×{kids.length}</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
                {inactiveFamilies.length > 0 && (
                  <div className="mb-3">
                    <span className="mb-1.5 block text-xs font-medium text-slate-400">{t('inactive')}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {inactiveFamilies.map((f) => {
                        const kids = students.filter((s) => s.family_id === f.id)
                        return (
                          <button key={f.id} onClick={() => pickInactiveFamily(f)} disabled={busy}
                            className="rounded-full border border-dashed border-amber-400 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 transition-colors hover:border-amber-500 hover:bg-amber-100 disabled:opacity-50"
                            title={kids.map((s) => `${s.nickname || s.full_name} (${s.level})`).join(', ')}>
                            <RotateCcw size={11} className="mr-1 inline" />
                            {f.name}
                            {kids.length > 1 && <span className="ml-1 opacity-60">×{kids.length}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )
          })()}
          <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
            {visible.map((s) => {
              const prog = PROGRAMS.find((p) => p.id === s.program)
              const progLabel = prog ? (uiLang === 'vi' ? prog.vi : prog.en) : s.program
              return (
                <label key={s.id} className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-1.5 text-sm hover:bg-slate-50 ${selectedIds.includes(s.id) ? 'bg-sky-50' : ''} ${s.active === false ? 'opacity-50' : ''}`}>
                  <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleStudent(s)} />
                  <span className="font-semibold">{s.full_name}</span>
                  {s.nickname && <span className="text-slate-500">({s.nickname})</span>}
                  {s.active === false && <span className="chip bg-amber-100 text-amber-700 text-[10px]">{t('inactive')}</span>}
                  <span className="ml-auto text-xs text-slate-500">{s.level} · {progLabel} · {famById[s.family_id]?.name || '—'}</span>
                </label>
              )
            })}
            {visible.length === 0 && <div className="p-4 text-center text-sm text-slate-400">{t('noData')}</div>}
          </div>
        </Card>

        {/* 2. Plan */}
        <Card title={t('choosePlan')}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('plan')}><Select value={inputs.plan} onChange={changePlan} options={PLAN_OPTIONS.map((p) => ({ value: p.id, label: uiLang === 'vi' ? p.vi : p.en }))} /></Field>
            <Field label={t('period')}><Select value={inputs.periodId} onChange={changePeriod} options={PERIOD_OPTIONS.map((p) => ({ value: p.id, label: uiLang === 'vi' ? p.vi : p.en }))} /></Field>
            <Field label={t('invoiceLang')}><Select value={inputs.lang} onChange={(v) => set({ lang: v })} options={[{ value: 'en', label: t('english') }, { value: 'vi', label: t('vietnamese') }]} /></Field>
          </div>
          {inputs.periodId === 'custom' && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label={`${t('customRange')} (EN)`} hint="e.g. From August 4 to August 28"><TextInput value={inputs.customRangeEn} onChange={(v) => set({ customRangeEn: v })} /></Field>
              <Field label={`${t('customRange')} (VI)`} hint="vd. Từ 04/08 đến 28/08"><TextInput value={inputs.customRangeVi} onChange={(v) => set({ customRangeVi: v })} /></Field>
              <Field label="Period name (EN)" hint='e.g. "the Global Program" → "MEAL FEE FOR THE GLOBAL PROGRAM"'><TextInput value={inputs.customLabelEn} onChange={(v) => set({ customLabelEn: v })} /></Field>
              <Field label="Tên kỳ (VI)"><TextInput value={inputs.customLabelVi} onChange={(v) => set({ customLabelVi: v })} /></Field>
            </div>
          )}
          {quarterlyLike && (
            <div className="mt-3">
              <span className="label">{t('quarters')}</span>
              <div className="flex flex-wrap gap-4">
                {calendar.quarters.map((qq) => <Checkbox key={qq.id} checked={inputs.billQuarters.includes(qq.id)} onChange={() => toggleQuarter(qq.id)} label={`${uiLang === 'vi' ? qq.vi : qq.en} (${t('due')} ${fees.deadlines[qq.id]})`} />)}
              </div>
            </div>
          )}
          {inputs.plan === 'split' && (
            <div className="mt-3">
              <span className="label">{t('splits')}</span>
              <div className="mb-2 max-w-xs">
                <Select value={inputs.splitBase || 'earlyBird'} onChange={(v) => set({ splitBase: v })}
                  options={[{ value: 'earlyBird', label: `${t('total')}: Early Bird` }, { value: 'standard', label: `${t('total')}: Standard` }, { value: 'quarterly', label: `${t('total')}: ${uiLang === 'vi' ? 'Theo quý' : 'Quarterly price'}` }]} />
              </div>
              <div className="space-y-2">
                {inputs.splits.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="radio" name="billSplit" checked={inputs.billSplit === i} onChange={() => set({ billSplit: i })} title={t('billInstallment')} />
                    <span className="w-20 text-sm">Payment {i + 1}</span>
                    <NumberInput value={s.pct} onChange={(v) => set({ splits: inputs.splits.map((x, j) => (j === i ? { ...x, pct: v } : x)) })} style={{ width: 80 }} /> <span className="text-sm">%</span>
                    <input type="date" className="input" style={{ width: 170 }} value={s.due} onChange={(e) => set({ splits: inputs.splits.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)) })} />
                    <button className="btn-ghost p-1 text-red-500" onClick={() => set({ splits: inputs.splits.filter((_, j) => j !== i), billSplit: 0 })} disabled={inputs.splits.length <= 1}><Trash2 size={14} /></button>
                  </div>
                ))}
                <button className="btn-secondary" onClick={() => set({ splits: [...inputs.splits, { pct: 0, due: todayISO() }] })}><Plus size={14} /> {t('addInstallment')}</button>
                <p className="text-xs text-slate-500">{t('billInstallment')}: Payment {inputs.billSplit + 1} · {inputs.splits.reduce((s, x) => s + Number(x.pct || 0), 0)}%</p>
              </div>
            </div>
          )}
          {inputs.students.length >= 2 && showTuitionOpts && (
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <Checkbox checked={inputs.siblingDiscount} onChange={(v) => set({ siblingDiscount: v })} label={t('siblingDiscount')} />
              {inputs.siblingDiscount && (
                <Select value={inputs.siblingStudentId} onChange={(v) => set({ siblingStudentId: v })} style={{ width: 240 }}
                  options={[{ value: '', label: t('auto') }, ...inputs.students.map((e) => ({ value: e.student.id, label: studentDisplayName(e.student) }))]} />
              )}
            </div>
          )}
        </Card>

        {/* 3. Per student */}
        {inputs.students.length > 0 && (
          <Card title={t('perStudent')}>
            <div className="space-y-4">
              {inputs.students.map(({ student: s, opts }) => (
                <div key={s.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="font-bold">{studentDisplayName(s)}</span>
                    <span className="text-xs text-slate-500">{s.level}</span>
                    {s.legacy && <span className="chip bg-purple-100 text-purple-800">legacy</span>}
                    <button className="btn-ghost ml-auto p-1 text-red-500" onClick={() => toggleStudent(s)}><Trash2 size={14} /></button>
                  </div>
                  <div className="mb-3">
                    <Field label={t('programForInvoice')}>
                      <Select value={s.program || 'regular'} onChange={(v) => setStudentProgram(s.id, v)}
                        options={PROGRAMS.map((p) => ({ value: p.id, label: uiLang === 'vi' ? p.vi : p.en }))} />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {showTuitionOpts && inputs.plan !== 'weekly' && (
                      <Field label={t('tuitionOverride')}><MoneyInput value={opts.tuitionOverride} onChange={(v) => setOpts(s.id, { tuitionOverride: v })} allowBlank placeholder="—" /></Field>
                    )}
                    {showTuitionOpts && <Field label={t('extraDiscount')}><NumberInput value={opts.extraDiscountPct} onChange={(v) => setOpts(s.id, { extraDiscountPct: v })} min={0} max={100} /></Field>}
                    {inputs.plan === 'weekly' && (
                      <>
                        <Field label={t('weeks')}><NumberInput value={opts.weeks} onChange={(v) => setOpts(s.id, { weeks: v })} min={0} /></Field>
                        <Field label={t('ratePerWeek')}><MoneyInput value={opts.weeklyRate} onChange={(v) => setOpts(s.id, { weeklyRate: v })} /></Field>
                      </>
                    )}
                    {inputs.plan === 'staff' && <Field label={t('staffMonths')}><NumberInput value={opts.staffMonths} onChange={(v) => setOpts(s.id, { staffMonths: v })} min={0} /></Field>}
                    {opts.upper && showTuitionOpts && (
                      <div className="flex flex-col gap-2 sm:col-span-3">
                        <Checkbox checked={opts.includePathway} onChange={(v) => setOpts(s.id, { includePathway: v })} label={t('includePathway')} />
                        <Checkbox checked={opts.includeAcellus} onChange={(v) => setOpts(s.id, { includeAcellus: v })} label={t('includeAcellus')} />
                      </div>
                    )}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <Checkbox checked={opts.meals} onChange={(v) => setOpts(s.id, { meals: v, mealRate: mealRateFor(s.level, s.program, fees) })} label={t('meals')} className="font-semibold" />
                      {opts.meals && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <Field label={t('mealDays')}><NumberInput value={opts.mealDays} onChange={(v) => setOpts(s.id, { mealDays: v })} min={0} /></Field>
                          <Field label={t('ratePerDay')}><MoneyInput value={opts.mealRate} onChange={(v) => setOpts(s.id, { mealRate: v })} /></Field>
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <Checkbox checked={opts.transport} onChange={(v) => setOpts(s.id, { transport: v })} label={t('transport')} className="font-semibold" />
                      {opts.transport && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <Field label={t('zone')} className="col-span-2">
                            <Select value={String(opts.transportRate)} onChange={(v) => setOpts(s.id, { transportRate: Number(v) })}
                              options={[
                                { value: String(fees.transport.hoiAn), label: `Hoi An (${fmt(fees.transport.hoiAn)})` },
                                { value: String(fees.transport.vinhDien), label: `Vinh Dien (${fmt(fees.transport.vinhDien)})` },
                                { value: String(fees.transport.daNang), label: `Da Nang (${fmt(fees.transport.daNang)})` },
                                ...([fees.transport.hoiAn, fees.transport.vinhDien, fees.transport.daNang].includes(opts.transportRate) ? [] : [{ value: String(opts.transportRate), label: `Custom (${fmt(opts.transportRate)})` }]),
                              ]} />
                          </Field>
                          <Field label={t('months')}><NumberInput value={opts.transportMonths} onChange={(v) => setOpts(s.id, { transportMonths: v })} min={0} /></Field>
                          <Field label={t('ratePerMonth')}><MoneyInput value={opts.transportRate} onChange={(v) => setOpts(s.id, { transportRate: v })} /></Field>
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 space-y-2">
                      {inputs.plan !== 'staff' && <Checkbox checked={opts.newStudentFee} onChange={(v) => setOpts(s.id, { newStudentFee: v })} label={`${t('newStudentFee')} (${fmt(fees.newStudentFee)})`} className="font-semibold" />}
                      <Field label={`${t('trialDays')} (${fmt(fees.trialDay)} / day)`}><NumberInput value={opts.trialDays} onChange={(v) => setOpts(s.id, { trialDays: v })} min={0} max={3} /></Field>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 4. Deductions + notes */}
        <Card title={t('extras')}>
          <span className="label">{t('deductions')}</span>
          <div className="space-y-2">
            {inputs.deductions.map((d, i) => (
              <div key={i} className="flex gap-2">
                <TextInput value={d.label} onChange={(v) => set({ deductions: inputs.deductions.map((x, j) => (j === i ? { ...x, label: v } : x)) })} placeholder={uiLang === 'vi' ? 'Đã chuyển khoản ngày 28/07' : 'Already transferred on July 28'} />
                <MoneyInput value={d.amount} onChange={(v) => set({ deductions: inputs.deductions.map((x, j) => (j === i ? { ...x, amount: v } : x)) })} className="max-w-[180px]" />
                <button className="btn-ghost p-1 text-red-500" onClick={() => set({ deductions: inputs.deductions.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
              </div>
            ))}
            <button className="btn-secondary" onClick={() => set({ deductions: [...inputs.deductions, { label: '', amount: 0 }] })}><Plus size={14} /> {t('addDeduction')}</button>
          </div>
          <div className="mt-4">
            <span className="label">{t('extraNotes')}</span>
            {inputs.extraNotes.map((n, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <TextInput value={n} onChange={(v) => set({ extraNotes: inputs.extraNotes.map((x, j) => (j === i ? v : x)) })} />
                <button className="btn-ghost p-1 text-red-500" onClick={() => set({ extraNotes: inputs.extraNotes.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
              </div>
            ))}
            <button className="btn-secondary" onClick={() => set({ extraNotes: [...inputs.extraNotes, ''] })}><Plus size={14} /> {t('add')}</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <Checkbox checked={inputs.cashOnly} onChange={(v) => set({ cashOnly: v })} label={t('cashOnly')} />
            <Checkbox checked={inputs.flags?.forceMajeure ?? true} onChange={(v) => set({ flags: { ...inputs.flags, forceMajeure: v } })} label={t('showFM')} />
          </div>
        </Card>
      </div>

      {/* Live summary */}
      <aside className="lg:sticky lg:top-20 self-start">
        <Card title={t('total')}>
          {totals && (
            <div className="space-y-1 text-sm">
              {totals.lines.map((l, i) => <div key={i} className="flex justify-between"><span>{l.label}</span><span className="tabular-nums">{fmt(l.amount)}</span></div>)}
              {doc.deductions.map((d) => <div key={d.id} className="flex justify-between text-red-600"><span>{d.label}</span><span className="tabular-nums">-{fmt(d.amount)}</span></div>)}
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-black"><span>{t('total')}</span><span className="tabular-nums">{fmt(totals.total)}</span></div>
              <div className="text-xs text-slate-500">{inputs.students.length} {t('students').toLowerCase()} · {inputs.lang.toUpperCase()}</div>
            </div>
          )}
          <button className="btn-green mt-4 w-full justify-center" disabled={!inputs.students.length || busy} onClick={create}>
            {busy ? t('saving') : (editId ? t('save') : t('createInvoice'))} <ChevronRight size={16} />
          </button>
        </Card>
      </aside>
    </div>
  )
}
