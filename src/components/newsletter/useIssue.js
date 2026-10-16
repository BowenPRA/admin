import { useCallback, useEffect, useRef, useState } from 'react'
import * as data from '../../lib/newsletter/data'
import { applyEdit } from '../../lib/newsletter/data'
import { preparePhotoLinks } from '../../lib/newsletter/photos'
import { sortParts, stable } from '../../lib/newsletter/payload'

const POLL_MS = 15000
const SAVE_MS = 700
const OVERLAP_MS = 60000
const RETRY_MS = [3000, 8000, 20000, 45000]
const keyOf = (partId, path) => `${partId}|${path.join('.')}`
// A save that failed because of the connection is tried again by itself; one the database refused is not.
const isConnection = (e) => /fetch|network|timeout|timed out|load failed|offline|503|502|504|ECONN/i.test(e?.message || String(e))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * One issue in the editor: its row and its parts, kept in step with the
 * database. Each box saves on its own a moment after typing stops; what other
 * people change arrives every 15 seconds (and when the tab is looked at again)
 * without disturbing a box that is being typed in.
 *
 * One box is saved at a time: typing on while it saves sends the newest words
 * once the save before has landed, so an older save can never win.
 *
 * A save that fails is kept, shown as "Not saved", and tried again: by itself
 * when the connection was the problem (and as soon as the browser is back
 * online), or with "Try again". Leaving the page while something is unsaved
 * asks first.
 */
export function useIssue(id, { onError = () => {} } = {}) {
  const [state, setState] = useState({ loading: true, error: '', issue: null, parts: [] })
  const [save, setSave] = useState('idle') // idle | saving | synced | error | offline
  const [unsaved, setUnsaved] = useState(0)
  const [photoTick, setPhotoTick] = useState(0)
  const pending = useRef(new Map()) // key -> { partId, path, value, del, timer, waiting }
  const flying = useRef(new Map()) // key -> job on its way to the database
  const failed = useRef(new Map()) // key -> job that did not save
  const tries = useRef(0)
  const retryTimer = useRef(null)
  const retryRef = useRef(() => {})
  const flushRef = useRef(() => {})
  const inFlight = useRef(0)
  const savedAt = useRef(new Map()) // partId -> the time our last save of it landed
  const lastSync = useRef('')
  const alive = useRef(true)
  const told = useRef(false) // the "not saved" message has been shown since the last good save
  const err = useRef(onError)
  err.current = onError
  // Issue settings (subject, cover…) typed or chosen but not saved yet, the timer that saves them, and the save on its way.
  const pendingSettings = useRef({})
  const settingsTimer = useRef(null)
  const settingsChain = useRef(Promise.resolve())
  const stateRef = useRef(state)
  stateRef.current = state

  const parts = state.parts
  const issue = state.issue

  // Only other people's rows move the cursor for "what changed"; our own saves never do.
  const note = (rows) => {
    for (const r of rows) if (r.updated_at && r.updated_at > lastSync.current) lastSync.current = r.updated_at
  }
  const count = () => pending.current.size + failed.current.size + inFlight.current + Object.keys(pendingSettings.current).length
  const settle = () => {
    const n = count()
    setUnsaved(n)
    if (failed.current.size) setSave(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error')
    else if (n) setSave('saving')
    else setSave('synced')
  }

  const load = useCallback(async () => {
    try {
      const [iss, ps] = await Promise.all([data.getIssue(id), data.listParts(id)])
      if (!alive.current) return
      if (!iss) { setState({ loading: false, error: 'This issue no longer exists.', issue: null, parts: [] }); return }
      note(ps)
      setState({ loading: false, error: '', issue: iss, parts: sortParts(ps) })
      const photos = [iss.settings?.cover, ...ps.flatMap((p) => p.data?.photos || [])].filter(Boolean)
      if (await preparePhotoLinks(photos).catch(() => false)) setPhotoTick((n) => n + 1)
    } catch (e) {
      if (alive.current) setState((s) => ({ ...s, loading: false, error: e.message || String(e) }))
    }
  }, [id])

  useEffect(() => { alive.current = true; load(); return () => { alive.current = false } }, [load])

  // ---- saving ----
  const failure = (e) => {
    if (!told.current) { told.current = true; err.current(new Error(isConnection(e) ? 'Not saved: the connection dropped. Your changes are kept on this page and will be saved as soon as it is back.' : `Not saved: ${e.message || e}`)) }
  }

  const scheduleRetry = useCallback(() => {
    clearTimeout(retryTimer.current)
    const wait = RETRY_MS[Math.min(tries.current, RETRY_MS.length - 1)]
    tries.current++
    retryTimer.current = setTimeout(() => { if (alive.current) retryRef.current() }, wait)
  }, [])

  const flushOne = useCallback(async (key) => {
    const job = pending.current.get(key)
    if (!job) return
    clearTimeout(job.timer)
    // The same box is still saving: this one goes as soon as that lands.
    if (flying.current.has(key)) { job.waiting = true; return }
    pending.current.delete(key)
    flying.current.set(key, job)
    inFlight.current++
    settle()
    try {
      const at = await data.editPart(job.partId, job.path, job.value, job.del)
      if (at) savedAt.current.set(job.partId, at)
      if (failed.current.get(key) === job) failed.current.delete(key)
      tries.current = 0
      told.current = false
    } catch (e) {
      // A newer change to the same box will be saved instead of this one.
      if (!pending.current.has(key)) failed.current.set(key, job)
      failure(e)
      if (isConnection(e)) scheduleRetry()
    } finally {
      flying.current.delete(key)
      inFlight.current--
      const next = pending.current.get(key)
      if (next?.waiting) { next.waiting = false; flushRef.current(key) }
      settle()
    }
  }, [scheduleRetry]) // eslint-disable-line react-hooks/exhaustive-deps
  flushRef.current = flushOne

  /** Saves the settings waiting, one key at a time, after any save of them already on its way. */
  const saveSettings = useCallback(() => {
    clearTimeout(settingsTimer.current)
    const run = async () => {
      const patch = { ...pendingSettings.current }
      const keys = Object.keys(patch)
      if (!keys.length) return
      inFlight.current++
      settle()
      try {
        let saved = null
        for (const k of keys) {
          saved = await data.setIssueSetting(id, k, patch[k])
          if (pendingSettings.current[k] === patch[k]) delete pendingSettings.current[k]
        }
        if (saved && alive.current) setState((s) => ({ ...s, issue: s.issue && { ...s.issue, settings: { ...saved, ...pendingSettings.current } } }))
        failed.current.delete('__settings')
        tries.current = 0
        told.current = false
      } catch (e) {
        failed.current.set('__settings', { settings: true })
        failure(e)
        if (isConnection(e)) scheduleRetry()
      } finally {
        inFlight.current--
        settle()
      }
    }
    settingsChain.current = settingsChain.current.then(run, run)
    return settingsChain.current
  }, [id, scheduleRetry]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Tries every change that did not save, now. */
  const retryNow = useCallback(() => {
    clearTimeout(retryTimer.current)
    for (const [key, job] of failed.current) {
      if (key === '__settings') continue
      if (!pending.current.has(key)) pending.current.set(key, { ...job, timer: null, waiting: false })
      failed.current.delete(key)
      flushOne(key)
    }
    if (failed.current.has('__settings') || Object.keys(pendingSettings.current).length) { failed.current.delete('__settings'); saveSettings() }
    settle()
  }, [flushOne, saveSettings]) // eslint-disable-line react-hooks/exhaustive-deps
  retryRef.current = retryNow

  useEffect(() => {
    const back = () => { if (failed.current.size) retryNow() }
    const gone = () => { if (count()) setSave('offline') }
    window.addEventListener('online', back)
    window.addEventListener('offline', gone)
    return () => { window.removeEventListener('online', back); window.removeEventListener('offline', gone) }
  }, [retryNow])

  // Leaving the page (closing the tab, reloading) with unsaved changes asks first.
  useEffect(() => {
    if (!unsaved) return undefined
    const ask = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', ask)
    return () => window.removeEventListener('beforeunload', ask)
  }, [unsaved])

  /** Saves everything typed so far. Throws when something still cannot be saved (Publish waits for it). */
  const flush = useCallback(async () => {
    if (failed.current.size) retryNow()
    await Promise.all([...pending.current.keys()].map(flushOne))
    if (Object.keys(pendingSettings.current).length) saveSettings()
    await settingsChain.current
    while ((inFlight.current || pending.current.size) && !failed.current.size) await sleep(80)
    if (failed.current.size) throw new Error('Some changes are not saved yet (see "Not saved" at the top). Check the connection and press "Try again" first.')
  }, [flushOne, saveSettings, retryNow])

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
    for (const [path, value, del = false] of list) {
      const key = keyOf(partId, path)
      const old = pending.current.get(key)
      if (old) clearTimeout(old.timer)
      failed.current.delete(key)
      const job = { partId, path, value, del, waiting: false }
      job.timer = setTimeout(() => flushRef.current(key), now ? 0 : SAVE_MS)
      pending.current.set(key, job)
    }
    settle()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Changes one of the issue's settings (subject, cover, …): on screen at once,
   * saved straight away, or a moment after typing stops with `typing`. Only that
   * key is written, so someone else's change to another setting stays.
   */
  const setSetting = useCallback((key, value, { typing = false } = {}) => {
    pendingSettings.current[key] = value
    setState((s) => ({ ...s, issue: { ...s.issue, settings: { ...(s.issue?.settings || {}), [key]: value } } }))
    clearTimeout(settingsTimer.current)
    settingsTimer.current = setTimeout(saveSettings, typing ? SAVE_MS : 0)
    settle()
  }, [saveSettings]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- what other people changed ----
  const refresh = useCallback(async () => {
    if (!id || !alive.current) return
    try {
      // A minute of overlap: a save that started before the last one seen but finished after it is still picked up.
      const since = lastSync.current ? new Date(Date.parse(lastSync.current) - OVERLAP_MS).toISOString() : '1970-01-01T00:00:00Z'
      const [changed, ids, iss0] = await Promise.all([data.partsChangedSince(id, since), data.partIds(id), data.getIssue(id)])
      if (!alive.current) return
      note(changed)
      // Settings being typed here win over what the database had a moment ago.
      const iss = iss0 && { ...iss0, settings: { ...(iss0.settings || {}), ...pendingSettings.current } }
      setState((s) => {
        if (!s.issue) return s
        // Nothing new: keep the same objects, so the previews are not made again for nothing.
        const issueSame = !iss || (iss.updated_at === s.issue.updated_at && stable(iss.settings) === stable(s.issue.settings) && iss.status === s.issue.status)
        let next = s.parts.filter((p) => ids.includes(p.id))
        let partsSame = next.length === s.parts.length
        const mineNow = [...pending.current.values(), ...flying.current.values(), ...[...failed.current.values()].filter((j) => j.partId)]
        for (const row of changed) {
          const mine = savedAt.current.get(row.id)
          if (mine && row.updated_at < mine) continue
          const busy = mineNow.filter((j) => j.partId === row.id)
          const merged = { ...row, data: busy.reduce((d, j) => applyEdit(d, j.path, j.value, j.del), row.data) }
          const had = next.find((p) => p.id === row.id)
          if (had && stable([had.data, had.position, had.public]) === stable([merged.data, merged.position, merged.public])) continue
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

  // Signed photo links are renewed before they run out (a steady timer: editing does not restart it).
  useEffect(() => {
    const t = setInterval(async () => {
      const s = stateRef.current
      const photos = [s.issue?.settings?.cover, ...s.parts.flatMap((p) => p.data?.photos || [])].filter(Boolean)
      if (await preparePhotoLinks(photos).catch(() => false)) setPhotoTick((n) => n + 1)
    }, 30 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  // Unsaved boxes are saved when the page is left inside the app.
  useEffect(() => () => {
    for (const key of [...pending.current.keys()]) flushRef.current(key)
    if (Object.keys(pendingSettings.current).length) saveSettings()
    clearTimeout(retryTimer.current)
  }, [saveSettings])

  // ---- whole parts and the issue row ----
  const run = async (fn) => {
    inFlight.current++
    settle()
    try { const r = await fn(); told.current = false; return r } catch (e) { err.current(e); return null } finally { inFlight.current--; settle() }
  }

  const addPart = useCallback((part) => run(async () => {
    const row = await data.addPart(id, part)
    savedAt.current.set(row.id, row.updated_at)
    setState((s) => ({ ...s, parts: sortParts([...s.parts, row]) }))
    return row
  }), [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const patchPart = useCallback((partId, fields) => run(async () => {
    setState((s) => ({ ...s, parts: sortParts(s.parts.map((p) => (p.id === partId ? { ...p, ...fields } : p))) }))
    const row = await data.patchPart(partId, fields)
    savedAt.current.set(partId, row.updated_at)
    return row
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  const removePart = useCallback((partId) => run(async () => {
    for (const [k, j] of pending.current) if (j.partId === partId) { clearTimeout(j.timer); pending.current.delete(k) }
    for (const [k, j] of failed.current) if (j.partId === partId) failed.current.delete(k)
    await data.removePart(partId)
    setState((s) => ({ ...s, parts: s.parts.filter((p) => p.id !== partId) }))
    return true
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

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

  /** Changes the issue row (status, email…). Settings go through setSetting, one key at a time. */
  const patchIssue = useCallback((fields) => run(async () => {
    const row = await data.patchIssue(id, fields)
    setState((s) => ({ ...s, issue: { ...s.issue, ...row, settings: { ...(row.settings || {}), ...pendingSettings.current } } }))
    return row
  }), [id]) // eslint-disable-line react-hooks/exhaustive-deps

  /** After an outside step (Publish) changed the row. */
  const replaceIssue = useCallback((row) => setState((s) => ({ ...s, issue: { ...s.issue, ...row } })), [])

  const photosChanged = useCallback(() => setPhotoTick((n) => n + 1), [])

  return { ...state, issue, parts, save, unsaved, photoTick, edit, flush, retry: retryNow, addPart, patchPart, removePart, movePart, patchIssue, setSetting, replaceIssue, reload: load, refresh, photosChanged }
}
