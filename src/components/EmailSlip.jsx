import { AlertTriangle } from 'lucide-react'
import { emailIssues, fixSlip } from '../lib/emailCheck'

/**
 * A warning under an email box when the part after the @ looks like a slip
 * ("gmai.com: did you mean gmail.com?"), with a button that puts it right.
 * Never blocks a save. Kept outside the box's <label>, so a click on the button
 * does not land in the box. `bad` also flags words that are not an address
 * (off where the form already says so).
 */
export default function EmailSlip({ value, onFix, t, bad = true, className = '' }) {
  const issues = emailIssues(value)
  const notAddresses = bad ? issues.bad : []
  if (!issues.slips.length && !notAddresses.length) return null
  return (
    <div className={`space-y-0.5 text-xs font-semibold text-amber-700 ${className}`} role="status">
      {issues.slips.map((x) => (
        <div key={x.email} className="flex flex-wrap items-center gap-x-1.5">
          <AlertTriangle size={12} className="flex-none" />
          <span>{t('emailSlip', { typed: x.domain, suggestion: x.suggestion })}</span>
          {onFix && <button type="button" className="rounded px-1 text-pra-blue underline hover:bg-sky-50" onClick={() => onFix(fixSlip(value, x))}>{t('emailSlipFix', { email: x.fixed })}</button>}
        </div>
      ))}
      {notAddresses.map((e) => (
        <div key={e} className="flex items-center gap-1.5"><AlertTriangle size={12} className="flex-none" /><span>{t('emailNotAddress', { email: e })}</span></div>
      ))}
    </div>
  )
}
