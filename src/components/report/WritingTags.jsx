/* eslint-disable react-refresh/only-export-components -- WRITING_PARTS is shared with the Home task list */
import { MessageSquareText, FileText } from 'lucide-react'
import { writingFor } from '../../lib/report/utils'
import { useT } from '../../lib/i18n'

// What a learning area needs from its teacher, shown the same way on every
// screen (Teachers, Reports, the editor and the Home task list):
//   individual comments   a comment on each student   (core and specialist areas)
//   course description    one description for the year group (core and vocational areas)
// Core areas show both tags.
export const WRITING_PARTS = [
  { key: 'comment', Icon: MessageSquareText, label: 'writingComments', tone: 'bg-violet-50 text-violet-800 ring-violet-200' },
  { key: 'description', Icon: FileText, label: 'writingDescription', tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
]

/**
 * The tags for one area: `subjectKey` (looked up in `settings`) or an explicit
 * `writing` ({ comment, description }). `compact` shows the icons only, with the
 * words as a tooltip; put a <WritingLegend /> near any compact use.
 */
export function WritingTags({ settings, subjectKey, writing, compact = false, size, className = '' }) {
  const { t } = useT()
  const w = writing || writingFor(settings, subjectKey)
  const parts = WRITING_PARTS.filter((p) => w[p.key])
  if (!parts.length) return null
  if (compact) {
    return (
      <span className={`inline-flex items-center gap-0.5 align-middle ${className}`} title={parts.map((p) => t(p.label)).join(' + ')}>
        {parts.map((p) => <p.Icon key={p.key} size={size || 12} className={p.key === 'comment' ? 'text-violet-600' : 'text-emerald-600'} aria-label={t(p.label)} />)}
      </span>
    )
  }
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 align-middle ${className}`}>
      {parts.map((p) => (
        <span key={p.key} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${p.tone}`}>
          <p.Icon size={size || 12} /> {t(p.label)}
        </span>
      ))}
    </span>
  )
}

/** One line explaining the compact icons. */
export function WritingLegend({ className = '' }) {
  const { t } = useT()
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 ${className}`}>
      {WRITING_PARTS.map((p) => (
        <span key={p.key} className="inline-flex items-center gap-1">
          <p.Icon size={12} className={p.key === 'comment' ? 'text-violet-600' : 'text-emerald-600'} /> {t(p.label)}
        </span>
      ))}
      <span>{t('writingLegendBoth')}</span>
    </span>
  )
}
