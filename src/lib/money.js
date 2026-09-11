// Money helpers: VND formatting and amount-in-words (English + Vietnamese).

export function fmt(n) {
  const v = Math.round(Number(n) || 0)
  return v.toLocaleString('en-US')
}

export function fmtSigned(n) {
  const v = Math.round(Number(n) || 0)
  return v < 0 ? `-${fmt(-v)}` : fmt(v)
}

export function parseMoney(s) {
  if (typeof s === 'number') return s
  const cleaned = String(s ?? '').replace(/[^\d.-]/g, '')
  const v = Number(cleaned)
  return Number.isFinite(v) ? v : 0
}

// Percentage helper that avoids 0.1+0.2 style drift for VND amounts.
export function pct(amount, p) {
  return Math.round((Number(amount) || 0) * (Number(p) || 0)) / 100
}

// ---------- English words ----------
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function enBelowThousand(n) {
  const parts = []
  if (n >= 100) { parts.push(`${ONES[Math.floor(n / 100)]} hundred`); n %= 100 }
  if (n >= 20) { parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '')) }
  else if (n > 0) parts.push(ONES[n])
  return parts.join(' ')
}

export function toWordsEn(n) {
  n = Math.round(Math.abs(Number(n) || 0))
  if (n === 0) return 'zero'
  const scales = ['', 'thousand', 'million', 'billion', 'trillion']
  const chunks = []
  let i = 0
  while (n > 0) {
    const c = n % 1000
    if (c) chunks.unshift(`${enBelowThousand(c)}${scales[i] ? ` ${scales[i]}` : ''}`)
    n = Math.floor(n / 1000)
    i++
  }
  return chunks.join(' ')
}

export function amountWordsEn(n) {
  const w = toWordsEn(n)
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} Vietnamese dong.`
}

// ---------- Vietnamese words ----------
const VI_DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

function viBelowThousand(n, full) {
  // `full` means this chunk follows a higher chunk, so leading zeros are spoken
  // ("không trăm lẻ năm").
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10
  const out = []
  if (h > 0 || full) out.push(`${VI_DIGITS[h]} trăm`)
  if (t === 0) {
    if (u > 0) { if (h > 0 || full) out.push('lẻ'); out.push(VI_DIGITS[u]) }
  } else if (t === 1) {
    out.push('mười')
    if (u === 5) out.push('lăm')
    else if (u > 0) out.push(VI_DIGITS[u])
  } else {
    out.push(`${VI_DIGITS[t]} mươi`)
    if (u === 1) out.push('mốt')
    else if (u === 5) out.push('lăm')
    else if (u > 0) out.push(VI_DIGITS[u])
  }
  return out.join(' ')
}

export function toWordsVi(n) {
  n = Math.round(Math.abs(Number(n) || 0))
  if (n === 0) return 'không'
  const scales = ['', 'nghìn', 'triệu', 'tỷ']
  const chunks = []
  let i = 0
  let higher = false
  const parts = []
  let m = n
  while (m > 0) { parts.unshift(m % 1000); m = Math.floor(m / 1000) }
  parts.forEach((c, idx) => {
    const scaleIdx = parts.length - 1 - idx
    if (c === 0) return
    const txt = viBelowThousand(c, higher)
    const scale = scales[scaleIdx % 4] || ''
    chunks.push(`${txt}${scale ? ` ${scale}` : ''}`)
    higher = true
  })
  void i
  return chunks.join(' ')
}

export function amountWordsVi(n) {
  const w = toWordsVi(n)
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} đồng chẵn./.`
}

export function todayISO() {
  const d = new Date()
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function fmtDate(iso, lang = 'en') {
  if (!iso) return ''
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return String(iso)
  if (lang === 'vi') return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
  return `${MONTHS_EN[m - 1]} ${d}, ${y}`
}

export function fmtDateLong(iso, lang = 'en') {
  if (!iso) return ''
  const [y, m, d] = String(iso).split('-').map(Number)
  if (lang === 'vi') return `Ngày ${String(d).padStart(2, '0')} tháng ${String(m).padStart(2, '0')} năm ${y}`
  return `${MONTHS_EN[m - 1]} ${d}, ${y}`
}
