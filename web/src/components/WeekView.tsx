import type { WeekDto } from '../types'
import { DayCard } from './DayCard'

interface Props {
  week: WeekDto | null
  currentSunday: Date
  isCurrentWeek: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onWeekUpdated: (week: WeekDto) => void
}

function addDays(date: Date, n: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function formatWeekLabel(startDate: string) {
  const d = new Date(startDate + 'T00:00:00')
  const end = addDays(d, 6)
  const sameMonth = d.getMonth() === end.getMonth()
  const start = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endStr = end.toLocaleDateString('en-US', sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })
  return `${start} – ${endStr}`
}

export function WeekView({ week, isCurrentWeek, onPrev, onNext, onToday, onWeekUpdated }: Props) {
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-4 py-3 flex items-center justify-between gap-2">
        <button
          onClick={onPrev}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 text-xl leading-none"
          aria-label="Previous week"
        >‹</button>

        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-sm font-medium text-slate-200 truncate">
            {week ? formatWeekLabel(week.startDate) : '…'}
          </span>
          {!isCurrentWeek && (
            <button
              onClick={onToday}
              className="px-2 py-0.5 rounded text-xs text-emerald-400 border border-emerald-700 hover:bg-emerald-900/40"
            >
              Today
            </button>
          )}
        </div>

        <button
          onClick={onNext}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 text-xl leading-none"
          aria-label="Next week"
        >›</button>
      </div>

      <div className="flex flex-col gap-2 p-3">
        {!week && <div className="text-center text-slate-500 py-16">Loading…</div>}
        {week && week.days.map((day, i) => (
          <DayCard
            key={day.id}
            day={day}
            date={addDays(new Date(week.startDate + 'T00:00:00'), i)}
            optional={day.dayOfWeek === 6}
            onDayUpdated={updated => {
              onWeekUpdated({
                ...week,
                days: week.days.map(d => d.id === updated.id ? updated : d),
              })
            }}
          />
        ))}
      </div>
    </div>
  )
}
