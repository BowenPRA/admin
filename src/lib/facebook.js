// Posting a draft from the Photos tab to PRA's Facebook Page, through the
// facebook-post Edge Function (supabase/functions/facebook-post). The Page key
// lives only there; this side cuts the photos to the post's shape and sends
// them one at a time, then asks for the post.

import { supabase, hasSupabase } from './supabaseClient.js'
import { croppedBlob } from './eventPhotos.js'

const FN = 'facebook-post'
const deployHint = 'Posting to Facebook is not set up yet: the facebook-post function has not been deployed to Supabase. See supabase/functions/facebook-post/README.md.'

// The earliest and latest Facebook allows for a scheduled post (10 minutes, 30 days), with a little room.
export const SCHEDULE_MIN_MS = 15 * 60 * 1000
export const SCHEDULE_MAX_MS = 29 * 24 * 60 * 60 * 1000

async function call(body) {
  if (!hasSupabase) throw new Error('Posting to Facebook works only in the online app, not in offline testing.')
  const { data, error } = await supabase.functions.invoke(FN, { body })
  if (!error) return data
  let msg = error.message
  try {
    const j = await error.context?.json()
    if (j?.error) msg = j.error
    else if (error.context?.status === 404) msg = deployHint
  } catch { if (error.name === 'FunctionsFetchError' || error.context?.status === 404) msg = deployHint }
  throw new Error(msg)
}

/** Is posting set up, and to which Page? @returns {Promise<{ ready: boolean, page?: { id, name, link } }>} */
export const facebookStatus = () => call({ action: 'status' })

/**
 * Sends the post's photos, then the post. `at` (a Date) schedules it instead of posting now.
 * The caption posted is the one saved in the database, so save it first.
 * @returns {Promise<object>} the fields the post row now has
 */
export async function postToFacebook(post, photos, { at = null, by = '' } = {}, step = () => {}) {
  const media = []
  for (const [i, p] of photos.entries()) {
    step({ done: i, total: photos.length })
    const blob = await croppedBlob(p, post.shape)
    const form = new FormData()
    form.append('action', 'photo')
    form.append('post_id', post.id)
    form.append('code', p.code)
    if (at) form.append('scheduled', '1')
    form.append('file', blob, `${p.code}.jpg`)
    const r = await call(form)
    media.push({ code: p.code, id: r.id })
  }
  step({ done: photos.length, total: photos.length, publishing: true })
  return call({ action: 'publish', post_id: post.id, media, at: at ? Math.floor(at.getTime() / 1000) : null, by })
}

/** Takes a scheduled post off Facebook before it goes out. */
export const cancelScheduled = (post) => call({ action: 'cancel', post_id: post.id })

/** On Facebook and not out yet. */
export const isScheduled = (post) => !!post?.facebook?.scheduled_for && Date.parse(post.facebook.scheduled_for) > Date.now()
