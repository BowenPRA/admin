import { useEffect, useRef, useState } from 'react'
import { Check, KeyRound, Printer } from 'lucide-react'
import { useL } from '../../lib/lessons'
import { CardPreview, PrintCards, printCards } from './LoginCards'

/**
 * New PINs waiting to be printed: a warning that they are shown only now, the cards as
 * they will print, Print and Done. Done (or closing the window) forgets the PINs.
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
    if (!printed && !confirm(L('These PINs have not been printed. After Done they cannot be shown again; you would need to give new PINs. Continue?', 'Các mã PIN này chưa được in. Sau khi bấm Xong sẽ không xem lại được nữa, thầy cô sẽ phải cấp mã PIN mới. Tiếp tục?'))) return
    onDone()
  }
  const print = async () => { onPrinted?.(); await printCards() }
  return (
    <section ref={box} className="scroll-mt-2 space-y-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 sm:p-4">
      <div className="flex items-start gap-2.5">
        <KeyRound size={20} className="mt-0.5 flex-none text-amber-700" />
        <div className="min-w-0 text-[15px] text-amber-900">
          <p className="font-bold">{n === 1 ? L('1 new PIN: print the card now.', '1 mã PIN mới: thầy cô in thẻ ngay bây giờ.') : L(`${n} new PINs: print the cards now.`, `${n} mã PIN mới: thầy cô in thẻ ngay bây giờ.`)}</p>
          <p className="text-sm">{L('A PIN is shown only this once. Once you press Done or close this window it cannot be seen again; a lost PIN means giving a new one.', 'Mã PIN chỉ hiện một lần này. Khi bấm Xong hoặc đóng cửa sổ, mã sẽ không xem lại được nữa; nếu mất thẻ thì cấp mã PIN mới.')}</p>
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
