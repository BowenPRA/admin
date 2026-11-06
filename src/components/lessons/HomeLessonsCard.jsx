import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Presentation } from 'lucide-react'
import { db } from '../../lib/db'
import { useAuth } from '../../lib/AuthContext'
import { inLessonsPilot, useL } from '../../lib/lessons'

// Home: one line about lessons, linking to the Lessons page.
//   a teacher       "Lessons: 1 ready to check · 1 question for you" (their own requests)
//   office or head  "Lessons queue: 2 to build" (sent, or changes asked)
// Nothing shows when there is nothing to do, or before the lessons SQL has run.
export default function HomeLessonsCard({ queue = false }) {
  const { L } = useL()
  const { me } = useAuth()
  const [rows, setRows] = useState(null)
  const email = String(me?.email || '').toLowerCase()
  const pilot = inLessonsPilot(email) // only the Lessons pilot sees the card

  useEffect(() => {
    if (!pilot) return undefined
    let on = true
    db.lessons.list().then((r) => on && setRows(r || [])).catch(() => on && setRows(null))
    return () => { on = false }
  }, [pilot])
  if (!pilot || !rows) return null

  const mine = rows.filter((x) => email && [x.teacher_email, x.created_by].some((e) => String(e || '').toLowerCase() === email))
  const ready = mine.filter((x) => x.status === 'ready').length
  const questions = mine.filter((x) => x.status === 'question').length
  const toBuild = queue ? rows.filter((x) => ['sent', 'changes'].includes(x.status)).length : 0

  const parts = [
    ready && L(`${ready} ready to check`, `${ready} bài sẵn sàng để xem`),
    questions && L(`${questions} ${questions === 1 ? 'question' : 'questions'} for you`, `${questions} câu hỏi cần thầy cô trả lời`),
  ].filter(Boolean)
  const lines = [
    parts.length && { to: '/lessons', text: `${L('Lessons', 'Bài giảng')}: ${parts.join(' · ')}`, tone: 'bg-teal-100 text-teal-700' },
    toBuild > 0 && { to: '/lessons', text: `${L('Lessons queue', 'Danh sách soạn bài')}: ${L(`${toBuild} to build`, `${toBuild} bài cần soạn`)}`, tone: 'bg-sky-100 text-sky-700' },
  ].filter(Boolean)
  if (!lines.length) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {lines.map((l) => (
        <Link key={l.text} to={l.to} className="card group flex items-center gap-3 p-4 transition-colors hover:border-pra-blue">
          <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${l.tone}`}><Presentation size={20} /></span>
          <span className="min-w-0 flex-1 font-bold text-slate-800">{l.text}</span>
          <ArrowRight size={16} className="flex-none text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-pra-blue" />
        </Link>
      ))}
    </div>
  )
}
