import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Star } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { db } from '../../lib/db'
import { useToast } from '../../lib/toast'
import { Chip, Empty, PageHeader, Spinner } from '../../components/ui'
import UploadEvent from '../../components/photos/UploadEvent'
import { fileKey, fileUrl, photoError, prepareFiles } from '../../lib/eventPhotos'

async function fetchRows() {
  try {
    const [events, photos, posts] = await Promise.all([db.photoEvents.list(), db.eventPhotos.list(), db.eventPosts.list()])
    const rows = events.map((e) => {
      const mine = photos.filter((p) => p.event_id === e.id && p.listed !== false).sort((a, b) => (a.seq || 999) - (b.seq || 999))
      return { event: e, photos: mine, lead: mine.find((p) => p.hero) || mine[0], posts: posts.filter((p) => p.event_id === e.id && p.status !== 'dropped') }
    }).sort((a, b) => String(b.event.event_date || '').localeCompare(String(a.event.event_date || '')))
    await prepareFiles(rows.map((r) => r.lead && fileKey(r.lead, r.lead.look, true)))
    return { rows, error: '' }
  } catch (e) { return { rows: [], error: photoError(e).message } }
}

// The list of events. Each card leads to the event's photos, description and
// draft posts.
export default function Photos() {
  const { t, lang } = useT()
  const toast = useToast()
  const [state, setState] = useState(null)
  const load = () => fetchRows().then(setState)
  useEffect(() => { let on = true; fetchRows().then((s) => on && setState(s)); return () => { on = false } }, [])
  const rows = state?.rows
  const error = state?.error
  const day = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

  if (!rows) return <Spinner />
  return (
    <div className="space-y-5">
      <PageHeader title={t('phTitle')} subtitle={t('phSubtitle')}>
        <UploadEvent onDone={() => { toast(t('phLoaded')); load() }} />
      </PageHeader>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!rows.length && !error && <Empty text={t('phNone')}><p className="mt-1">{t('phNoneHint')}</p></Empty>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ event, photos, lead, posts }) => {
          const checked = photos.filter((p) => p.cleared).length
          const best = photos.reduce((m, p) => Math.max(m, Number(p.score) || 0), 0)
          return (
            <Link key={event.id} to={`/photos/${event.id}`} className="card group overflow-hidden transition-shadow hover:shadow-md">
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                {lead && fileUrl(fileKey(lead, lead.look, true)) && <img src={fileUrl(fileKey(lead, lead.look, true))} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: lead.focus ? `${lead.focus[0] * 100}% ${lead.focus[1] * 100}%` : undefined }} />}
              </div>
              <div className="space-y-2 p-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800 group-hover:text-pra-blue">{event.name}</h2>
                  <p className="text-xs text-slate-500">{day(event.event_date)}{event.school_year ? ` · ${event.school_year}` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip>{t('phCountPhotos', { n: photos.length })}</Chip>
                  <Chip tone={checked === photos.length && photos.length ? 'green' : 'amber'}><ShieldCheck size={12} className="mr-1" />{t('phCountChecked', { n: checked, m: photos.length })}</Chip>
                  {!!posts.length && <Chip tone="sky">{t('phCountPosts', { n: posts.filter((p) => p.status === 'draft').length })}</Chip>}
                  {best > 0 && <Chip><Star size={12} className="mr-1" />{best}</Chip>}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
