import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Maximize2, Plus, RotateCcw, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { db } from '../../lib/db'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { Empty, Menu, PageHeader, SearchInput, Segmented, Select, Spinner } from '../../components/ui'
import { TAG_GROUPS, allKeys, canPublish, finishEvent, moveToWebsite, onWebsite, photoError, prepareFiles, removeEvent, removePhoto, stillPublic, tagValues, websiteSlug } from '../../lib/eventPhotos'
import { cancelScheduled, isScheduled } from '../../lib/facebook'
import { todayISO as today } from '../../lib/money'
import PhotoCard from '../../components/photos/PhotoCard'
import PhotoModal from '../../components/photos/PhotoModal'
import PhotoViewer from '../../components/photos/PhotoViewer'
import EventNotes from '../../components/photos/EventNotes'
import PostCard from '../../components/photos/PostCard'
import WebsitePanel from '../../components/photos/WebsitePanel'

// The quick filters above the grid. Every one except "delisted" is about photos still in the album.
const STATUSES = [
  ['all', 'phAllTags', (p) => p.listed !== false],
  ['todo', 'phStatusTodo', (p) => p.listed !== false && !p.cleared],
  ['checked', 'phStatusChecked', (p) => p.listed !== false && !!p.cleared],
  ['website', 'phStatusWebsite', (p) => p.listed !== false && (!!p.website?.want || onWebsite(p))],
  ['delisted', 'phDelisted', (p) => p.listed === false],
]

// One event: its photos, what happened, and the posts drafted for Facebook.
export default function PhotoEvent() {
  const { id } = useParams()
  const { t } = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const { displayName } = useAuth()
  const [event, setEvent] = useState(null)
  const [photos, setPhotos] = useState([])
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('photos')
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({})
  const [sort, setSort] = useState('score')
  const [status, setStatus] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  // The photo open full screen ('view') or in the details panel ('edit'). `ids` is the
  // order when it was opened, so a photo that stops matching the filter (say, once it is
  // checked) does not vanish from under you.
  const [opened, setOpened] = useState(null)
  const [, setLinks] = useState(0) // bumps when signed links arrive, so pictures appear

  useEffect(() => {
    let off = false
    ;(async () => {
      try {
        const [ev, ps, po] = await Promise.all([db.photoEvents.get(id), db.eventPhotos.list(id), db.eventPosts.list(id)])
        if (off) return
        if (!ev) { navigate('/photos', { replace: true }); return }
        setEvent(ev); setPhotos(ps); setPosts(po.sort((a, b) => (a.seq || 0) - (b.seq || 0)))
        setLoading(false)
        if (await prepareFiles(allKeys(ps)) && !off) setLinks((n) => n + 1)
      } catch (e) { if (!off) { setError(photoError(e).message); setLoading(false) } }
    })()
    return () => { off = true }
  }, [id, navigate])

  // Every change is saved as it is made; the screen is updated first so it feels immediate.
  const patchPhoto = useCallback(async (photo, fields) => {
    setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, ...fields } : p)))
    try { await db.eventPhotos.patch(photo.id, fields) } catch (e) {
      setPhotos((ps) => ps.map((p) => (p.id === photo.id ? photo : p)))
      toast.error(photoError(e).message)
    }
  }, [toast])
  // Answers true when the change was saved, so a step that depends on it can stop when it was not.
  const patchPost = useCallback(async (post, fields) => {
    setPosts((ps) => ps.map((p) => (p.id === post.id ? { ...p, ...fields } : p)))
    try { await db.eventPosts.patch(post.id, fields); return true } catch (e) {
      setPosts((ps) => ps.map((p) => (p.id === post.id ? post : p)))
      toast.error(photoError(e).message)
      return false
    }
  }, [toast])
  const patchEvent = async (fields) => {
    const was = event
    setEvent({ ...event, ...fields })
    try { await db.photoEvents.patch(event.id, fields); toast(t('phSaved')) } catch (e) { setEvent(was); toast.error(photoError(e).message) }
  }

  // A photo that stops being checked or listed can no longer go on the website. If it is
  // already there it stays public until the website is rebuilt, so say so.
  const leaving = (photo) => {
    if (!photo.website?.want) return {}
    if (onWebsite(photo)) toast.info(t('phWebStillPublic', { title: photo.title || photo.code }))
    return { website: { ...photo.website, want: false } }
  }
  const setChecked = (photo, on) => patchPhoto(photo, on
    ? { cleared: true, cleared_by: displayName || '', cleared_on: today() }
    : { cleared: false, cleared_by: null, cleared_on: null, ...leaving(photo) })
  const setListed = (photo, on) => patchPhoto(photo, on ? { listed: true } : { listed: false, ...leaving(photo) })
  const slugFor = (photo, all) => photo.website?.slug || websiteSlug(event, photo, all.filter((p) => p.id !== photo.id).map((p) => p.website?.slug).filter(Boolean))
  const setWebsite = (photo, on) => {
    if (on && !canPublish(photo)) { toast.error(t('phWebNeedsCheck')); return }
    return patchPhoto(photo, { website: { ...(photo.website || {}), want: on, slug: slugFor(photo, photos), asked_by: displayName || '', asked_on: today() } })
  }
  const setWebsiteAll = async (on) => {
    const all = [...photos]
    for (const p of all.filter((x) => x.listed !== false && canPublish(x) && !onWebsite(x) && !!x.website?.want !== on)) {
      const website = { ...(p.website || {}), want: on, slug: slugFor(p, all), asked_by: displayName || '', asked_on: today() }
      all[all.findIndex((x) => x.id === p.id)] = { ...p, website } // so the next photo cannot be given the same name
      await patchPhoto(p, { website })
    }
  }
  const finish = async () => {
    const out = await finishEvent(photos)
    setPhotos(out.photos)
    const notes = { ...(event.notes || {}), finished: { by: displayName || '', on: today(), removed: out.removed } }
    setEvent({ ...event, notes })
    await db.photoEvents.patch(event.id, { notes })
    toast(t('phFinResult', { files: out.removed }))
  }
  const move = async (step) => {
    const out = await moveToWebsite(photos, step)
    setPhotos(out.photos)
    if (out.waiting.length) toast.info(t('phWebWaiting', { n: out.waiting.length, moved: out.moved }))
    else toast(t('phWebMoved', { n: out.moved }))
  }
  // Deleting a post marks it "not used" rather than removing the row, so uploading
  // the event again from the laptop does not bring it back. It can be restored,
  // or deleted for good from the Deleted posts list.
  const addPost = async () => {
    const seq = Math.max(0, ...posts.map((p) => Number(p.seq) || 0)) + 1
    try {
      const row = await db.eventPosts.save({ event_id: event.id, kind: 'office', seq, title: t('phPostNew'), caption: '', photo_codes: [], other_first_lines: [], shape: '4:5', status: 'draft', results: {} })
      setPosts((ps) => [...ps, row])
      toast(t('phPostAdded'))
      setTimeout(() => document.getElementById(`post-${row.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    } catch (e) { toast.error(photoError(e).message) }
  }
  // A post still waiting on Facebook is taken off there first, or Facebook would publish it
  // anyway. Gives back the post as it is afterwards (a draft again), or null to stop the delete.
  const offFacebook = async (post) => {
    if (!isScheduled(post)) return post
    if (!window.confirm(t('fbDeleteScheduledConfirm'))) return null
    try { await cancelScheduled(post) } catch (e) { toast.error(t('fbDeleteStopped', { error: e.message })); return null }
    const now = { ...post, status: 'draft', facebook: null, posted_at: null, posted_by: null }
    setPosts((ps) => ps.map((p) => (p.id === post.id ? now : p)))
    return now
  }
  const deletePost = async (post) => {
    const now = await offFacebook(post)
    if (!now) return
    // After a cancel its fields are written again here, in case the function could not save them.
    const fields = now === post ? { status: 'dropped' } : { status: 'dropped', facebook: null, posted_at: null, posted_by: null }
    if (await patchPost(now, fields)) toast(t('phPostDeleted'))
  }
  const deleteForGood = async (post) => {
    if (!window.confirm(t('phPostForGoodConfirm', { title: post.title || t('phPostRecap') }))) return
    if (!(await offFacebook(post))) return
    try { await db.eventPosts.remove(post.id); setPosts((ps) => ps.filter((p) => p.id !== post.id)) } catch (e) { toast.error(photoError(e).message) }
  }

  // A photo on the public website cannot be removed here: its record is what tells the
  // website to take the picture down. It has to come off the website first.
  const remove = async (photo) => {
    if ((await stillPublic([photo])).length) { toast.error(t('phRemoveOnWebsite', { title: photo.title || photo.code })); return }
    if (!window.confirm(t('phRemoveConfirm', { title: photo.title || photo.code }))) return
    try {
      await removePhoto(photo)
      setPhotos((ps) => ps.filter((p) => p.id !== photo.id))
      setOpened(null)
      toast(t('phRemoved'))
    } catch (e) { toast.error(photoError(e).message) }
  }
  const removeAll = async () => {
    const live = await stillPublic(photos)
    if (live.length) { toast.error(t('phRemoveEventOnWebsite', { n: live.length })); return }
    if (!window.confirm(t('phRemoveEventConfirm', { name: event.name, n: photos.length }))) return
    try { await removeEvent(event, photos); navigate('/photos') } catch (e) { toast.error(photoError(e).message) }
  }

  const sorted = useMemo(() => [...photos].sort((a, b) => (sort === 'score' ? (Number(b.score) || 0) - (Number(a.score) || 0) : 0) || (a.seq || 999) - (b.seq || 999)), [photos, sort])
  const listed = useMemo(() => sorted.filter((p) => p.listed !== false), [sorted])
  const groups = useMemo(() => TAG_GROUPS.map(([key, label]) => ({
    key, label, values: [...new Set(listed.flatMap((p) => tagValues(p, key)))].sort(),
  })).filter((g) => g.values.length > 1), [listed])
  const matching = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return sorted.filter((p) => {
      if (Object.entries(filters).some(([k, v]) => v && !tagValues(p, k).includes(v))) return false
      if (!words.length) return true
      const hay = `${p.title} ${p.caption} ${p.judge_note} ${p.code} ${JSON.stringify(p.tags || {})}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  }, [sorted, q, filters])
  const shown = useMemo(() => matching.filter(STATUSES.find(([k]) => k === status)[2]), [matching, status])
  const tagCount = Object.values(filters).filter(Boolean).length
  const filtered = !!(q || tagCount)
  const unchecked = shown.filter((p) => p.listed !== false && !p.cleared)
  const checkAll = async () => {
    if (!window.confirm(t('phCheckAllConfirm', { n: unchecked.length }))) return
    for (const p of unchecked) await setChecked(p, true)
  }

  const openPhoto = (id, mode) => {
    const ids = shown.map((p) => p.id)
    setOpened({ id, mode, ids: ids.includes(id) ? ids : [id, ...ids] })
  }
  const closePhoto = useCallback(() => setOpened(null), [])

  if (loading) return <Spinner />
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
  const open = opened && photos.find((p) => p.id === opened.id)
  const order = open ? opened.ids.filter((pid) => photos.some((p) => p.id === pid)) : []
  const at = order.indexOf(opened?.id)
  const go = (step) => (at >= 0 && order[at + step] ? () => setOpened({ ...opened, id: order[at + step] }) : null)
  const checked = listed.filter((p) => p.cleared).length
  const pct = listed.length ? Math.round((checked / listed.length) * 100) : 0

  return (
    <div className="space-y-5">
      <Link to="/photos" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-pra-blue"><ArrowLeft size={15} /> {t('phBack')}</Link>
      <PageHeader title={event.name}
        subtitle={`${event.event_date || ''} · ${t('phCountPhotos', { n: listed.length })}`}>
        <Segmented value={view} onChange={setView} options={[
          { value: 'photos', label: t('phViewPhotos') }, { value: 'event', label: t('phViewEvent') }, { value: 'facebook', label: t('phViewFacebook') }, { value: 'website', label: t('phViewWebsite') },
        ]} />
        <Menu label="…" items={[{ label: t('phRemoveEvent'), icon: Trash2, onClick: removeAll }]} />
      </PageHeader>

      <div className="flex max-w-xl items-center gap-3" title={t('phChecked')}>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-600' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`flex-none text-xs font-semibold ${pct === 100 ? 'text-green-700' : 'text-slate-600'}`}><ShieldCheck size={13} className="-mt-0.5 mr-1 inline" />{t('phProgress', { n: checked, m: listed.length })}</span>
      </div>

      {view === 'photos' && (
        <>
          <div className="card space-y-3 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput value={q} onChange={setQ} placeholder={t('phSearch')} className="min-w-[200px] flex-1" />
              <Segmented value={sort} onChange={setSort} options={[{ value: 'score', label: t('phSortScore') }, { value: 'album', label: t('phSortAlbum') }]} />
              {!!groups.length && (
                <button type="button" className={`btn-secondary ${showFilters || tagCount ? '!border-pra-blue !text-pra-blue' : ''}`} aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
                  <SlidersHorizontal size={16} /> {t('phFilters')}{tagCount ? ` (${tagCount})` : ''}
                </button>
              )}
              <button type="button" className="btn-primary" disabled={!shown.length} onClick={() => openPhoto(shown[0].id, 'view')}><Maximize2 size={16} /> {t('phFullScreen')}</button>
            </div>
            {showFilters && (
              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3 lg:grid-cols-4">
                {groups.map((g) => (
                  <label key={g.key} className="block">
                    <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t(g.label)}</span>
                    <Select value={filters[g.key] || ''} onChange={(v) => setFilters((f) => ({ ...f, [g.key]: v }))}
                      options={[{ value: '', label: t('phAllTags') }, ...g.values.map((v) => ({ value: v, label: v }))]} />
                  </label>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
              {STATUSES.map(([key, label, test]) => {
                const n = matching.filter(test).length
                if (key === 'delisted' && !n && status !== key) return null
                return (
                  <button key={key} type="button" aria-pressed={status === key} onClick={() => setStatus(key)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${status === key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {t(label)} <span className={status === key ? 'text-white/70' : 'text-slate-400'}>{n}</span>
                  </button>
                )
              })}
              {filtered && <button className="btn-ghost !py-1 text-xs" onClick={() => { setQ(''); setFilters({}) }}>{t('phClearFilters')}</button>}
              {!!unchecked.length && <button className="btn-secondary ml-auto !py-1.5 text-xs" onClick={checkAll}><ShieldCheck size={15} /> {t('phCheckAll')} ({unchecked.length})</button>}
            </div>
          </div>
          {!shown.length && <Empty text={t('phNoMatch')} />}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => (
              <PhotoCard key={p.id} photo={p} onView={() => openPhoto(p.id, 'view')} onDetails={() => openPhoto(p.id, 'edit')} onLook={(look) => patchPhoto(p, { look })}
                onChecked={(on) => setChecked(p, on)} onListed={(on) => setListed(p, on)} onWebsite={(on) => setWebsite(p, on)} />
            ))}
          </div>
        </>
      )}

      {view === 'event' && <EventNotes key={event.id} event={event} onSave={patchEvent} />}

      {view === 'facebook' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm text-slate-500">{t('phCountPosts', { n: posts.filter((p) => p.status === 'draft').length })}</p>
            <button className="btn-primary" onClick={addPost}><Plus size={16} /> {t('phPostNew')}</button>
          </div>
          {!posts.some((p) => p.status !== 'dropped') && <Empty text={t('phNoPosts')} />}
          {posts.filter((p) => p.status !== 'dropped').map((post) => (
            <div key={post.id} id={`post-${post.id}`} className="scroll-mt-4">
              <PostCard event={event} post={post} photos={photos} onPatch={(fields) => patchPost(post, fields)} onChanged={(fields) => setPosts((ps) => ps.map((p) => (p.id === post.id ? { ...p, ...fields } : p)))} onOpenPhoto={(pid) => { setView('photos'); openPhoto(pid, 'edit') }}
                onRelist={(p) => setListed(p, true)} onDelete={() => deletePost(post)} />
            </div>
          ))}
          {posts.some((p) => p.status === 'dropped') && (
            <details className="card p-4">
              <summary className="cursor-pointer text-sm font-bold text-slate-700">{t('phPostsDeleted', { n: posts.filter((p) => p.status === 'dropped').length })}</summary>
              <p className="mt-1 text-xs text-slate-500">{t('phPostsDeletedHint')}</p>
              <ul className="mt-3 divide-y divide-slate-100">
                {posts.filter((p) => p.status === 'dropped').map((post) => (
                  <li key={post.id} className="flex flex-wrap items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-700">{post.title || t('phPostRecap')}</div>
                      <div className="truncate text-xs text-slate-500">{(post.caption || '').split('\n')[0]}</div>
                    </div>
                    <button className="btn-secondary !py-1 text-xs" onClick={() => patchPost(post, { status: 'draft', posted_at: null, posted_by: null })}><RotateCcw size={14} /> {t('phPostRestore')}</button>
                    <button className="btn-ghost !py-1 text-xs text-red-600 hover:bg-red-50" onClick={() => deleteForGood(post)}><Trash2 size={14} /> {t('phPostForGood')}</button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {view === 'website' && <WebsitePanel event={event} photos={photos} onChoose={setWebsite} onChooseAll={setWebsiteAll} onFinish={finish} onMove={move} />}

      {open && opened.mode === 'view' && (
        <PhotoViewer photo={open} index={at} total={order.length} onClose={closePhoto} onPrev={go(-1)} onNext={go(1)}
          onLook={(look) => open.look !== look && patchPhoto(open, { look })} onChecked={(on) => setChecked(open, on)} onListed={(on) => setListed(open, on)}
          onWebsite={(on) => setWebsite(open, on)} onDetails={() => setOpened({ ...opened, mode: 'edit' })} />
      )}
      {open && opened.mode === 'edit' && (
        <PhotoModal key={open.id} photo={open} onClose={closePhoto} onPatch={(fields) => ('listed' in fields && !fields.listed ? setListed(open, false) : patchPhoto(open, fields))}
          onChecked={(on) => setChecked(open, on)} onRemove={() => remove(open)} onWebsite={(on) => setWebsite(open, on)}
          onPrev={go(-1)} onNext={go(1)} onFullScreen={() => setOpened({ ...opened, mode: 'view' })} />
      )}
    </div>
  )
}
