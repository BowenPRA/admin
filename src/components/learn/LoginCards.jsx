/* eslint-disable react-refresh/only-export-components */
import { createPortal } from 'react-dom'
import { LEARN_HOST, cardLayout } from '../../lib/learn'

// Login cards for PRA Learn: one card per child with their name, login name and secret code
// (their student number, 3 digits), the address and two short instructions in English and
// Vietnamese. The cards are printed from the answer that made them: <PrintCards>
// puts the sheets at the end of <body>, hidden on screen, and while it is there printing
// shows only them (no route, nothing saved). One A4 sheet holds up to 24 cards; a small
// class gets bigger cards (cardLayout in lib/learn.js).

const INSTRUCTIONS = [
  ['Open the website above. Type your name and your secret code.', 'Mở trang web ở trên, nhập tên và mã bí mật của em.'],
  ['Keep your code secret. Forgot it? Ask your teacher.', 'Giữ kín mã bí mật. Quên mã thì em hỏi thầy cô nhé.'],
]

const FONT = 'LC Be Vietnam'
const PRINT_CSS = `
@font-face { font-family: '${FONT}'; src: url('/fonts/BeVietnamPro-Regular.ttf') format('truetype'); font-weight: 400; }
@font-face { font-family: '${FONT}'; src: url('/fonts/BeVietnamPro-SemiBold.ttf') format('truetype'); font-weight: 600; }
@font-face { font-family: '${FONT}'; src: url('/fonts/BeVietnamPro-Bold.ttf') format('truetype'); font-weight: 700; }
.lc-print { display: none; }
.lc-card { font-family: '${FONT}', 'Segoe UI', Arial, sans-serif; box-sizing: border-box; border: 0.3mm dashed #94a3b8; color: #1e293b; display: flex; flex-direction: column; overflow: hidden; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.lc-card * { box-sizing: border-box; }
.lc-mono { font-family: Consolas, 'Courier New', monospace; font-weight: 700; }
@media print {
  body > *:not(.lc-print) { display: none !important; }
  .lc-print { display: block !important; }
  .lc-sheet { break-after: page; page-break-after: always; }
  .lc-sheet:last-child { break-after: auto; page-break-after: auto; }
}
`

/** Loads the card font before printing (hidden sheets do not load it by themselves). */
export async function printCards() {
  try { await Promise.all([400, 600, 700].map((w) => document.fonts.load(`${w} 12pt "${FONT}"`))) } catch { /* print with the fallback font */ }
  window.print()
}

/** One card. `w`, `h` in mm; `s` scales the type with the card. */
export function LoginCard({ card, group, w, h, s = 1, screen = false }) {
  const pt = (n, min = 0) => `${Math.max(n * s, min).toFixed(2)}pt`
  const pad = `${(s < 0.8 ? 2.4 : 3.2 * s).toFixed(2)}mm`
  const box = { flex: 1, minWidth: 0, borderRadius: '1.6mm', padding: `${(1.2 * s).toFixed(2)}mm ${(2 * s).toFixed(2)}mm`, background: '#eff6ff' }
  const label = { fontSize: pt(5.6), fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  return (
    <div className="lc-card" style={{ width: screen ? '100%' : `${w}mm`, height: screen ? 'auto' : `${h}mm`, padding: pad, gap: `${(1.3 * s).toFixed(2)}mm`, borderRadius: screen ? '3mm' : 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '2mm', flexShrink: 0 }}>
        <span style={{ fontSize: pt(9.5), fontWeight: 700, color: '#116DFF', lineHeight: 1.1 }}>{LEARN_HOST}</span>
        <span style={{ marginLeft: 'auto', fontSize: pt(6.5), fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>{group}</span>
      </div>
      <div style={{ fontSize: pt(14), fontWeight: 700, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{card.name}</div>
      <div style={{ display: 'flex', gap: `${(1.6 * s).toFixed(2)}mm`, flexShrink: 0 }}>
        <div style={{ ...box, flex: 1.6 }}>
          <div style={label}>Name · Tên</div>
          <div className="lc-mono" style={{ fontSize: pt(13), color: '#0b4fb8', lineHeight: 1.15 }}>{card.username}</div>
        </div>
        <div style={{ ...box, background: '#f0fdf4' }}>
          <div style={label}>Secret code · Mã bí mật</div>
          <div className="lc-mono" style={{ fontSize: pt(13), letterSpacing: '0.18em', lineHeight: 1.15 }}>{card.pin}</div>
        </div>
      </div>
      <div style={{ marginTop: 'auto', fontSize: pt(6.1, 5.1), lineHeight: 1.2, color: '#334155' }}>
        {INSTRUCTIONS.map(([en, vi], i) => (
          <div key={i} style={{ marginTop: i ? `${(0.7 * s).toFixed(2)}mm` : 0 }}>
            <div style={{ fontWeight: 600 }}>{en}</div>
            <div style={{ color: '#64748b' }}>{vi}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The print-only sheets. Render it while there are cards; printCards() prints them. */
export function PrintCards({ cards }) {
  if (!cards.length) return null
  const L = cardLayout(cards.length)
  const sheets = Array.from({ length: L.sheets }, (_, i) => cards.slice(i * L.perSheet, (i + 1) * L.perSheet))
  return createPortal(
    <div className="lc-print" aria-hidden="true">
      <style>{PRINT_CSS}</style>
      {sheets.map((list, i) => (
        <div key={i} className="lc-sheet" style={{ width: '190mm', height: '276mm', display: 'grid', gridTemplateColumns: `repeat(${L.cols}, ${L.w}mm)`, gridAutoRows: `${(276 / L.rows).toFixed(3)}mm`, alignContent: 'start' }}>
          {list.map((c) => <LoginCard key={c.student_id} card={c} group={c.group} w={L.w} h={276 / L.rows} s={L.scale} />)}
        </div>
      ))}
    </div>,
    document.body,
  )
}

/** The same cards on screen, so the teacher sees what will print. */
export function CardPreview({ cards }) {
  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => <LoginCard key={c.student_id} card={c} group={c.group} screen s={0.95} />)}
      </div>
    </>
  )
}
