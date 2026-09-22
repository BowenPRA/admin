// Where a student photo lives in the private `adm-photos` Storage bucket.
// Student rows keep the path they always had ("photos/sunny.jpg"); Storage only
// accepts plain ASCII keys, so Vietnamese letters become their code point
// ("photos/bơ.jpg" -> "photos/b_1a1.jpg"). Shared by the app (src/lib/report/photo.js)
// and scripts/upload-student-photos.mjs, so both always agree on the key.

export const PHOTO_BUCKET = 'adm-photos'

export function photoKey(path) {
  return String(path || '').normalize('NFC').replace(/[^A-Za-z0-9._/-]/gu, (c) => `_${c.codePointAt(0).toString(16)}`)
}
