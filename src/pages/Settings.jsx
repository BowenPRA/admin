import { useState } from 'react'
import { Save, RotateCcw, Upload, Download } from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { DEFAULT_FEES, DEFAULT_CALENDAR, LEVELS, totalSchoolDays } from '../lib/fees'
import { Card, Field, TextInput, NumberInput, MoneyInput, Spinner } from '../components/ui'
import { exportWorkbook, readRosterFile } from '../lib/exportExcel'

function setPath(obj, path, value) {
  const out = structuredClone(obj)
  const parts = path.split('.')
  let cur = out
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]]
  cur[parts[parts.length - 1]] = value
  return out
}
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

export default function SettingsPage() {
  const data = useData()
  if (data.loading || !data.fees || !data.calendar) return <Spinner />
  return <SettingsForm data={data} />
}

function SettingsForm({ data }) {
  const { t } = useT()
  const [fees, setFees] = useState(() => structuredClone(data.fees))
  const [cal, setCal] = useState(() => structuredClone(data.calendar))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const M = (label, path) => <Field label={label}><MoneyInput value={getPath(fees, path)} onChange={(v) => setFees(setPath(fees, path, v))} /></Field>
  const T = (label, path, type = 'text') => <Field label={label}><TextInput value={getPath(fees, path)} onChange={(v) => setFees(setPath(fees, path, v))} type={type} /></Field>

  const save = async () => {
    setBusy(true); setMsg('')
    try {
      const c = { ...cal, quarters: cal.quarters.map((q) => ({ ...q, days: Number(q.days) || 0, months: Number(q.months) || 0 })), months: cal.months.map((m) => ({ ...m, days: Number(m.days) || 0 })) }
      await db.setFees(fees); await db.setCalendar(c); await data.refresh(); setMsg(t('saved'))
    } catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }
  const reset = () => { if (confirm(t('resetDefaults') + '?')) { setFees(structuredClone(DEFAULT_FEES)); setCal(structuredClone(DEFAULT_CALENDAR)) } }

  const importRoster = async (file) => {
    if (!file) return
    setBusy(true)
    try {
      const rows = await readRosterFile(file)
      const existing = new Set(data.students.map((s) => s.full_name.toLowerCase()))
      let n = 0
      for (const r of rows) {
        if (existing.has(r.full_name.toLowerCase())) continue
        const lvl = LEVELS.find((l) => l.toLowerCase() === r.level.toLowerCase()) || 'Year 1'
        await db.students.save({ full_name: r.full_name, nickname: r.nickname, level: lvl, program: 'regular', active: true, dob: null, nationality: r.nationality, notes: r.dob ? `DOB ${r.dob}` : '' })
        n++
      }
      await data.refresh(); setMsg(`${n} ${t('students').toLowerCase()} +`)
    } catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }

  const doExport = async () => {
    const [invoices, payments] = await Promise.all([db.invoices.list(), db.payments.list()])
    exportWorkbook({ invoices, payments, students: data.students, families: data.families })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-black text-slate-800">{t('settings')}</h1>
        <div className="flex-1" />
        {msg && <span className="text-sm font-semibold text-green-700">{msg}</span>}
        <button className="btn-secondary" onClick={reset}><RotateCcw size={16} /> {t('resetDefaults')}</button>
        <button className="btn-primary" onClick={save} disabled={busy}><Save size={16} /> {busy ? t('saving') : t('save')}</button>
      </div>

      <Card title={`${t('fees')} · ${fees.schoolYear}`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="School year"><TextInput value={fees.schoolYear} onChange={(v) => setFees({ ...fees, schoolYear: v })} /></Field>
        </div>
        <table className="mt-4 w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1">Level</th><th>Early Bird</th><th>Standard</th><th>Quarter 1-3</th><th>Quarter 4</th></tr></thead>
          <tbody>
            {[['nursery', 'Nursery'], ['kindergarten', 'Kindergarten'], ['y1_6', 'Year 1-6'], ['y7_9', 'Year 7-9']].map(([k, label]) => (
              <tr key={k} className="border-t border-slate-100">
                <td className="py-1 font-semibold">{label}</td>
                {['earlyBird', 'standard', 'quarter', 'quarter4'].map((f) => <td key={f} className="p-1"><MoneyInput value={fees.tuition[k][f]} onChange={(v) => setFees(setPath(fees, `tuition.${k}.${f}`, v))} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {M('Upper Secondary · Hybrid (year)', 'upper.hybrid')}
          {M('Upper Secondary · Independent (year)', 'upper.independent')}
          {M('Acellus (year)', 'upper.acellus')}
          {M('Legacy early bird (year)', 'legacyEarlyBird')}
          {M('Meals · early years / day', 'meals.earlyYears')}
          {M('Meals · primary & secondary / day', 'meals.primarySecondary')}
          {M('Meals · vocational / day', 'meals.vocational')}
          {M('New student fee', 'newStudentFee')}
          {M('Transport · Hoi An / month', 'transport.hoiAn')}
          {M('Transport · Vinh Dien / month', 'transport.vinhDien')}
          {M('Transport · Da Nang / month', 'transport.daNang')}
          {M('Trial day', 'trialDay')}
          {M('Weekly · Global nursery', 'weekly.globalNursery')}
          {M('Weekly · Vocational Y1-6', 'weekly.vocationalY1_6')}
          {M('Weekly · Vocational Y7-9', 'weekly.vocationalY7_9')}
          {M('Weekly · Summer upper', 'weekly.summerUpper')}
          {M('Staff · materials / month', 'staff.materialsPerMonth')}
          {M('Staff · development fee', 'staff.developmentFee')}
          <Field label="Sibling discount %"><NumberInput value={fees.siblingDiscountPct} onChange={(v) => setFees({ ...fees, siblingDiscountPct: v })} /></Field>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {T('Early bird deadline', 'deadlines.earlyBird', 'date')}
          {T('Standard deadline', 'deadlines.standard', 'date')}
          {T('Q1 due', 'deadlines.q1', 'date')}
          {T('Q2 due', 'deadlines.q2', 'date')}
          {T('Q3 due', 'deadlines.q3', 'date')}
          {T('Q4 due', 'deadlines.q4', 'date')}
          {T('Semester 2 due', 'deadlines.semester2', 'date')}
        </div>
      </Card>

      <Card title={`${t('calendar')} · ${totalSchoolDays(cal)} school days`}>
        <div className="grid gap-2 sm:grid-cols-6 lg:grid-cols-11">
          {cal.months.map((m, i) => (
            <Field key={m.key} label={m.en}><NumberInput value={m.days} onChange={(v) => setCal({ ...cal, months: cal.months.map((x, j) => (j === i ? { ...x, days: v } : x)) })} /></Field>
          ))}
        </div>
        <table className="mt-4 w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1">Quarter</th><th>Range (EN)</th><th>Range (VI)</th><th>School days</th><th>Transport months</th></tr></thead>
          <tbody>
            {cal.quarters.map((q, i) => (
              <tr key={q.id} className="border-t border-slate-100">
                <td className="py-1 font-semibold">{q.en}</td>
                <td className="p-1"><TextInput value={q.rangeEn} onChange={(v) => setCal({ ...cal, quarters: cal.quarters.map((x, j) => (j === i ? { ...x, rangeEn: v } : x)) })} /></td>
                <td className="p-1"><TextInput value={q.rangeVi} onChange={(v) => setCal({ ...cal, quarters: cal.quarters.map((x, j) => (j === i ? { ...x, rangeVi: v } : x)) })} /></td>
                <td className="p-1 w-28"><NumberInput value={q.days} onChange={(v) => setCal({ ...cal, quarters: cal.quarters.map((x, j) => (j === i ? { ...x, days: v } : x)) })} /></td>
                <td className="p-1 w-28"><NumberInput value={q.months} onChange={(v) => setCal({ ...cal, quarters: cal.quarters.map((x, j) => (j === i ? { ...x, months: v } : x)) })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t('bank')}>
          <div className="grid gap-3">
            {T('Account holder', 'bank.holder')}
            {T('Account number', 'bank.number')}
            {T('SWIFT / BIC', 'bank.swift')}
            {T('Branch', 'bank.branch')}
            {T('Holder address (EN)', 'bank.addressEn')}
            {T('Holder address (VI)', 'bank.addressVi')}
          </div>
        </Card>
        <Card title={t('schoolInfo')}>
          <div className="grid gap-3">
            {T('Email', 'school.email')}
            {T('Address (EN)', 'school.addressEn')}
            {T('Address (VI)', 'school.addressVi')}
            {T('Legal name (receipts)', 'school.legalName')}
            {T('Tax code (MST)', 'school.taxCode')}
            {T('Receipt address line', 'school.receiptAddress')}
          </div>
        </Card>
      </div>

      <Card title={t('dataExport')}>
        <p className="mb-3 text-sm text-slate-500">{t('exportHint')}</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={doExport}><Download size={16} /> {t('export')}</button>
          <label className="btn-secondary cursor-pointer"><Upload size={16} /> {t('importRoster')}<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => importRoster(e.target.files?.[0])} /></label>
        </div>
      </Card>
    </div>
  )
}
