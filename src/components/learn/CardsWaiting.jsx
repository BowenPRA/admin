import { useEffect, useRef, useState } from 'react'
import { Check, KeyRound, Printer } from 'lucide-react'
import { useL } from '../../lib/lessons'
import { CardPreview, PrintCards, printCards } from './LoginCards'

/**
 * Login cards waiting to be printed: the cards as they will print, Print and Done. The
 * secret code is the student number, so a card can be printed again later (Reset code).
 * `printed` / `onPrinted` let the window know whether to warn on closing.
 */
export default function CardsWaiting({ cards, printed, onPrinted, onDone, compact = false }) {
  const { L } = useL()
  const [show, setShow] = useState(true)
  // New cards appear at the top of the window, which may be scrolled down to the row that made them.
  const box = useRef(null)
  useEffect(() => { if (cards.length) box.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }, [cards])
  if (!cards.length) return null
  const n = cards.length
  const done = () => {
    if (!printed && !confirm(L('These cards have not been printed. Close them? A card can be printed again later with Reset code.', 'Các thẻ này chưa được in. Vẫn đóng? Sau này thầy cô có thể in lại thẻ bằng nút Đặt lại mã.'))) return
    onDone()
  }
  const print = async () => { onPrinted?.(); await printCards() }
  return (
    <section ref={box} className="scroll-mt-2 space-y-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 sm:p-4">
      <div className="flex items-start gap-2.5">
        <KeyRound size={20} className="mt-0.5 flex-none text-amber-700" />
        <div className="min-w-0 text-[15px] text-amber-900">
          <p className="font-bold">{n === 1 ? L('1 login card to print.', '1 thẻ đăng nhập để in.') : L(`${n} login cards to print.`, `${n} thẻ đăng nhập để in.`)}</p>
          <p className="text-sm">{L('Each student signs in with their nickname and their student number as a 3-digit secret code. A lost card can be printed again: press Reset code for that student.', 'Mỗi em đăng nhập bằng tên thường gọi và mã bí mật là số học viên (3 chữ số). Mất thẻ thì in lại được: bấm Đặt lại mã cho em đó.')}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={print}><Printer size={15} /> {n === 1 ? L('Print the card', 'In thẻ') : L(`Print ${n} cards`, `In ${n} thẻ`)}</button>
        <button type="button" className="btn-secondary" onClick={done}><Check size={15} /> {L('Done', 'Xong')}</button>
        {compact && <button type="button" className="btn-ghost text-sm" onClick={() => setShow((v) => !v)}>{show ? L('Hide the card', 'Ẩn thẻ') : L('Show the card', 'Xem thẻ')}</button>}
      </div>
      {n > 24 && <p className="text-sm text-amber-900">{L(`${n} cards print on ${Math.ceil(n / 24)} pages, 24 to a page.`, `${n} thẻ được in trên ${Math.ceil(n / 24)} trang, mỗi trang 24 thẻ.`)}</p>}
      {show && <CardPreview cards={cards} />}
      <PrintCards cards={cards} />
    </section>
  )
}
