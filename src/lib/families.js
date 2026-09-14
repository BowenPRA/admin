// Work out families from the student records: children who share a parent
// email (or a parent phone number) belong together. Returns proposals; the
// caller decides whether to save them.

const VN_SURNAMES = ['nguyễn', 'trần', 'lê', 'phạm', 'hoàng', 'huỳnh', 'phan', 'vũ', 'võ', 'đặng', 'bùi', 'đỗ', 'hồ', 'ngô', 'dương', 'lý', 'đinh', 'trịnh', 'mai', 'tạ', 'lai', 'lưu', 'lương', 'cao', 'đoàn', 'vương', 'trương']
const VN_CHARS = /[ăâđêôơưĂÂĐÊÔƠƯàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/

export function emailsOf(s) {
  return String(s.parents_email || '').split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'))
}
function phoneOf(s) {
  const p = String(s.parent_phone || '').replace(/[^\d]/g, '')
  return p.length >= 9 ? p : ''
}

/** Vietnamese-speaking family? True when every child's name reads as Vietnamese. */
export function looksVietnamese(students) {
  return students.every((s) => {
    const name = String(s.full_name || '').trim()
    if (!name || /\(/.test(name)) return false
    const first = name.split(/\s+/)[0].toLowerCase()
    return VN_CHARS.test(name) && VN_SURNAMES.includes(first)
  })
}

export function familyNameFor(kids) {
  const nicks = kids.map((k) => (k.nickname || k.full_name.split(' ').pop()).trim())
  const label = nicks.length <= 2 ? nicks.join(' & ') : `${nicks.slice(0, -1).join(', ')} & ${nicks[nicks.length - 1]}`
  return `${label}'s family`
}

/**
 * Group students into families by shared email / phone (union-find).
 * Students that already have a family_id are left alone; siblings of a placed
 * student are attached to that existing family.
 * Returns { create: [{ name, email, phone, language, studentIds }], attach: [{ familyId, studentIds }] }
 */
export function proposeFamilies(students, families) {
  const active = students.filter((s) => s.active !== false)
  const parent = new Map(active.map((s) => [s.id, s.id]))
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x) } return x }
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb) }

  const byKey = new Map()
  active.forEach((s) => {
    const keys = [...emailsOf(s).map((e) => `e:${e}`), ...(phoneOf(s) ? [`p:${phoneOf(s)}`] : [])]
    keys.forEach((k) => { if (byKey.has(k)) union(s.id, byKey.get(k)); else byKey.set(k, s.id) })
    // children already in the same family stay together
    if (s.family_id) { const k = `f:${s.family_id}`; if (byKey.has(k)) union(s.id, byKey.get(k)); else byKey.set(k, s.id) }
  })

  const groups = new Map()
  active.forEach((s) => { const r = find(s.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(s) })

  const create = [], attach = []
  const famById = Object.fromEntries((families || []).map((f) => [f.id, f]))
  for (const kids of groups.values()) {
    const placed = kids.find((k) => k.family_id && famById[k.family_id])
    const loose = kids.filter((k) => !k.family_id)
    if (!loose.length) continue
    if (placed) { attach.push({ familyId: placed.family_id, familyName: famById[placed.family_id].name, studentIds: loose.map((k) => k.id), names: loose.map((k) => k.nickname || k.full_name) }); continue }
    const emails = [...new Set(kids.flatMap(emailsOf))]
    const phones = [...new Set(kids.map(phoneOf).filter(Boolean))]
    create.push({
      name: familyNameFor(kids), email: emails.join(', '), phone: phones.join(', '),
      language: looksVietnamese(kids) ? 'vi' : 'en',
      studentIds: kids.map((k) => k.id), names: kids.map((k) => k.nickname || k.full_name),
    })
  }
  // Two families with the same label (two boys called Louis) get the surname added.
  const counts = {}
  create.forEach((c) => { counts[c.name] = (counts[c.name] || 0) + 1 })
  create.forEach((c) => {
    if (counts[c.name] > 1) {
      const kid = students.find((s) => s.id === c.studentIds[0])
      const parts = String(kid?.full_name || '').replace(/\(.*?\)/g, '').trim().split(/\s+/)
      const surname = looksVietnamese([kid]) ? parts[0] : parts[parts.length - 1]
      c.name = c.name.replace(/'s family$/, ` ${surname}'s family`)
    }
  })
  return { create, attach }
}
