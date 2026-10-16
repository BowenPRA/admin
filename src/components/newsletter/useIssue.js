import { useCallback, useEffect, useRef, useState } from 'react'
import * as data from '../../lib/newsletter/data'
import { applyEdit } from '../../lib/newsletter/data'
import { preparePhotoLinks } from '../../lib/newsletter/photos'
import { sortParts } from '../../lib/newsletter/payload'

const POLL_MS = 15000
const SAVE_MS = 700
const keyOf = (partId, path) => `${partId}|${path.join('.')}`

/**
 * One issue in the editor: its row and its parts, kept in step with the
 * database. Each box saves on its own a moment after typing stops; what other
 * people change arrives every 15 seconds (and when the tab is looked at again)
 * without disturbing a box that is being typed in.
 */
export function useIssue(id, { onError = () => {} } = {}) {
  const [state, setState] = useState({ loading: true, error: '', issue: null, parts: [] })
  const [save, setSave] = useState('idle') // idle | saving | synced | error
  const [photoTick, setPhotoTick] = useState(0)
  const pending = useRef(new Map()) // key -> { partId, path, value, del, timer }
  const inFlight = useRef(0)
  const savedAt = useRef(new Map()) // partId -> the time our last save of it landed
  const lastSync = useRef('')
  const alive = useRef(true)
  const err = useRef(onError)
  err.current = onError

  const parts = state.parts
  const issue = state.issue

  const note = (rows) => {
    for (const r of rows) if (r.updated_at && r.updated_at > lastSync.current) lastSync.current = r.updated_at
  }

  const load = useCallback(async () => {
    try {
      const [iss, ps] = await Promise.all([data.getIssue(id), data.listParts(id)])
      if (!alive.current) return
      if (!iss) { setState({ loading: false, error: 'This issue no longer exists.', issue: null, parts: [] }); return }
      note([iss, ...ps])
      setState({ loading: false, error: '', issue: iss, parts: sortParts(ps) })
      const photos = [iss.settings?.cover, ...ps.flatMap((p) => p.data?.photos || [])].filter(Boolean)
      if (await preparePhotoLinks(photos).catch(() => false)) setPhotoTick((n) => n + 1)
    } catch (e) {
      if (alive.current) setState((s) => ({ ...s, loading: false, error: e.message || String(e) }))
    }
  }, [id])

  useEffect(() => { alive.current = true; load(); return () => { alive.current = false } }, [load])

  // ---- saving one box ----
  const flushOne = useCallback(async (key) => {
    const job = pending.current.get(key)
    if (!job) return
    pending.current.delete(key)
    clearTimeout(job.timer)
    inFlight.current++
    setSave('saving')
    try {
      const at = await data.editPart(job.partId, job.path, job.value, job.del)
      if (at) savedAt.current.set(job.partId, at)
    } catch (e) {
      setSave('error')
      err.current(e)
    } finally {
      inFlight.current--
      if (!inFlight.current && !pending.current.size) setSave((s) => (s === 'error' ? s : 'synced'))
    }
  }, [])

  /** Waits until everything typed so far is saved. */
  const flush = useCallback(async () => {
    await Promise.all([...pending.current.keys()].map(flushOne))
    while (inFlight.current) await new Promise((r) => setTimeout(r, 80))
  }, [flushOne])

  /**
   * Changes one value inside a part: on screen at once, in the database a moment
   * later (`now` saves straight away). `edits` may be one [path, value, del] or a list.
   */
  const edit = useCallback((partId, edits, { now = false } = {}) => {
    // One edit is [path, value, del] (a path is a list of keys); several are a list of those.
    const list = Array.isArray(edits[0]?.[0]) ? edits : [edits]
    setState((s) => ({
      ...s,
      parts: s.parts.map((p) => (p.id === partId ? { ...p, data: list.reduce((d, [path, value, del]) => applyEdit(d, path, value, del), p.data) } : p)),
    }))
    setSave('saving')
    for (const [path, value, del = false] of list) {
      const key = keyOf(partId, path)
      const old = pending.current.get(key)
      if (old) clearTimeout(old.timer)
      const job = { partId, path, value, del }
      job.timer = setTimeout(() => flushOne(key), now ? 0 : SAVE_MS)
      pending.current.set(key, job)
    }
  }, [flushOne])

  // ---- what other people changed ----
  const refresh = useCallback(async () => {
    if (!id || !alive.current) return
    try {
      const since = lastSync.current || '1970-01-01T00:00:00Z'
      const [changed, ids, iss] = await Promise.all([data.partsChangedSince(id, since), data.partIds(id), data.getIssue(id)])
      if (!alive.current) return
      note(changed)
      setState((s) => {
        if (!s.issue) return s
        // Nothing new: keep the same objects, so the previews are not made again for nothing.
        const issueSame = !iss || (iss.updated_at === s.issue.updated_at && JSON.stringify(iss.settings) === JSON.stringify(s.issue.settings) && iss.status === s.issue.status)
        let next = s.parts.filter((p) => ids.includes(p.id))
        let partsSame = next.length === s.parts.length
        for (const row of changed) {
          const mine = savedAt.current.get(row.id)
          if (mine && row.updated_at < mine) continue
          const busy = [...pending.current.values()].filter((j) => j.partId === row.id)
          const merged = { ...row, data: busy.reduce((d, j) => applyEdit(d, j.path, j.value, j.del), row.data) }
          const had = next.find((p) => p.id === row.id)
          if (had && JSON.stringify([had.data, had.position, had.public]) === JSON.stringify([merged.data, merged.position, merged.public])) continue
          partsSame = false
          next = had ? next.map((p) => (p.id === row.id ? merged : p)) : [...next, merged]
        }
        if (issueSame && partsSame) return s
        return { ...s, issue: issueSame ? s.issue : iss, parts: partsSame ? s.parts : sortParts(next) }
      })
      const photos = changed.flatMap((p) => p.data?.photos || [])
      if (await preparePhotoLinks(photos).catch(() => false)) setPhotoTick((n) => n + 1)
    } catch { /* keep what is on screen */ }
  }, [id])

  useEffect(() => {
    const t = setInterval(refresh, POLL_MS)
    const onShow = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onShow)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onShow) }
  }, [refresh])

  // Signed photo links are renewed before they run out.
  useEffect(() => {
    const t = setInterval(async () => {
      const photos = [state.issue?.settings?.cover, ...state.parts.flatMap((p) => p.data?.photos || [])].filter(Boolean)
      if (await preparePhotoLinks(photos).catch(() => false)) setPhotoTick((n) => n + 1)
    }, 30 * 60 * 1000)
    return () => clearInterval(t)
  }, [state.issue, state.parts])

  // Unsaved boxes are saved when the page is left.
  useEffect(() => () => { for (const key of [...pending.current.keys()]) flushOne(key) }, [flushOne])

  // ---- whole parts and the issue row ----
  const run = async (fn) => {
    setSave('saving')
    try { const r = await fn(); setSave(inFlight.current || pending.current.size ? 'saving' : 'synced'); return r } catch (e) { setSave('error'); err.current(e); return null }
  }

  const addPart = useCallback((part) => run(async () => {
    const row = await data.addPart(id, part)
    note([row])
    setState((s) => ({ ...s, parts: sortParts([...s.parts, row]) }))
    return row
  }), [id])  

  const patchPart = useCallback((partId, fields) => run(async () => {
    setState((s) => ({ ...s, parts: sortParts(s.parts.map((p) => (p.id === partId ? { ...p, ...fields } : p))) }))
    const row = await data.patchPart(partId, fields)
    savedAt.current.set(partId, row.updated_at)
    return row
  }), [])  

  const removePart = useCallback((partId) => run(async () => {
    for (const [k, j] of pending.current) if (j.partId === partId) { clearTimeout(j.timer); pending.current.delete(k) }
    await data.removePart(partId)
    setState((s) => ({ ...s, parts: s.parts.filter((p) => p.id !== partId) }))
    return true
  }), [])  

  /** Moves a part up or down past its neighbour (only among the movable parts). */
  const movePart = useCallback((partId, dir) => {
    const movable = state.parts.filter((p) => !['opening', 'dates', 'reminders', 'closing'].includes(p.type))
    const i = movable.findIndex((p) => p.id === partId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= movable.length) return
    const a = movable[i], b = movable[j]
    patchPart(a.id, { position: b.position })
    patchPart(b.id, { position: a.position })
  }, [state.parts, patchPart])

  const patchIssue = useCallback((fields) => run(async () => {
    const row = await data.patchIssue(id, fields)
    setState((s) => ({ ...s, issue: { ...s.issue, ...row } }))
    return row
  }), [id])  

  const setSetting = useCallback((key, value) => run(async () => {
    setState((s) => ({ ...s, issue: { ...s.issue, settings: { ...(s.issue?.settings || {}), [key]: value } } }))
    const row = await data.patchSettings(state.issue, key, value)
    setState((s) => ({ ...s, issue: { ...s.issue, ...row } }))
    return row
  }), [state.issue])  

  /** After an outside step (Publish) changed the row. */
  const replaceIssue = useCallback((row) => setState((s) => ({ ...s, issue: { ...s.issue, ...row } })), [])

  const photosChanged = useCallback(() => setPhotoTick((n) => n + 1), [])

  return { ...state, issue, parts, save, photoTick, edit, flush, addPart, patchPart, removePart, movePart, patchIssue, setSetting, replaceIssue, reload: load, refresh, photosChanged }
}
