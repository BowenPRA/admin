import { CalendarCheck } from 'lucide-react'
import { Card, Empty } from '../components/ui'

export default function Attendance() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-slate-800">Attendance</h1>
      <Card>
        <Empty text="Coming soon — daily attendance tracking is being designed." />
      </Card>
    </div>
  )
}
