import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { Card, TextArea } from '../ui'

// What happened at the event, for staff, and what still needs checking before
// anything is posted.
export default function EventNotes({ event, onSave }) {
  const { t } = useT()
  const [text, setText] = useState(event.description || '')
  const n = event.notes || {}
  const changed = text.trim() !== (event.description || '').trim()
  const rows = [['phSources', n.sources], ['phCoverage', n.coverage], ['phQuality', n.quality], ['phDrive', event.drive_folder]].filter(([, v]) => v)
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <Card className="lg:col-span-3" title={t('phDescription')} subtitle={t('phDescriptionHint')}
        actions={<button className="btn-primary" disabled={!changed} onClick={() => onSave({ description: text.trim() })}>{t('save')}</button>}>
        <TextArea rows={18} value={text} onChange={setText} />
      </Card>
      <div className="space-y-5 lg:col-span-2">
        {!!n.to_confirm?.length && (
          <Card title={t('phToConfirm')} className="border-amber-200 bg-amber-50/50">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">{n.to_confirm.map((x) => <li key={x}>{x}</li>)}</ul>
          </Card>
        )}
        <Card>
          {n.brought_in != null && <p className="mb-3 text-sm font-semibold text-slate-700">{t('phNumbers', { a: n.brought_in, b: n.judged, c: n.in_album })}</p>}
          <dl className="space-y-3 text-sm">
            {rows.map(([label, value]) => (
              <div key={label}><dt className="label">{t(label)}</dt><dd className="text-slate-700">{value}</dd></div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  )
}
