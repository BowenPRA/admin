import { useT } from '../../lib/i18n'
import { LOOKS } from '../../lib/eventPhotos'

/**
 * The four looks as small buttons. Every look is already stored, so the switch is
 * instant. `available` lists the looks that still exist once an event is finished.
 */
export default function LookSwitch({ value, onChange, available = LOOKS, className = '' }) {
  const { t } = useT()
  return (
    <div className={`seg ${className}`} role="group" aria-label={t('phLook')} title={t('phLookHint')}>
      {LOOKS.map((l) => <button key={l} type="button" aria-pressed={value === l} disabled={!available.includes(l)} className="!px-2 disabled:cursor-not-allowed disabled:opacity-30" onClick={() => onChange(l)}>{l === 'original' ? t('phLookOriginal') : l}</button>)}
    </div>
  )
}
