import { useState, useEffect } from 'react'
import type { WeekDto } from '../types'
import { fetchWeekByDate, fetchCurrentWeek } from '../api'
import { DayCard } from './DayCard'

interface Props {
  onShowShopping: (week: WeekDto) => void
}

function addDays(date: Date, n: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toSunday(date: Date) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function toIso(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatWeekLabel(startDate: string) {
  const d = new Date(startDate + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function WeekView({ onShowShopping }: Props) {
  const [week, setWeek] = useState<WeekDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentSunday, setCurrentSunday] = useState<Date>(() => toSunday(new Date()))

  useEffect(() => {
    setLoading(true)
    const isCurrentWeek = toIso(currentSunday) === toIso(toSunday(new Date()))
    const load = isCurrentWeek
      ? fetchCurrentWeek()
      : fetchWeekByDate(toIso(currentSunday))
    load.then(w => { setWeek(w); setLoading(false) })
  }, [currentSunday])

  const goBack = () => setCurrentSunday(d => addDays(d, -7))
  const goForward = () => setCurrentSunday(d => addDays(d, 7))
  const goToday = () => setCurrentSunday(toSunday(new Date()))

  const isCurrentWeek = toIso(currentSunday) === toIso(toSunday(new Date()))

  return (
    <div className="flex flex-col min-h-svh bg-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={goBack}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 active:bg-slate-600 text-xl leading-none"
            aria-label="Previous week"
          >‹</button>
          <button
            onClick={goForward}
            disabled={isCurrentWeek}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-30 text-xl leading-none"
            aria-label="Next week"
          >›</button>
          {!isCurrentWeek && (
            <button
              onClick={goToday}
              className="ml-1 px-3 py-1 rounded-lg text-xs text-indigo-400 border border-indigo-700 hover:bg-indigo-900/40"
            >
              This week
            </button>
          )}
        </div>

        <span className="text-sm font-medium text-slate-300 text-center flex-1 truncate">
          {week ? `Week of ${formatWeekLabel(week.startDate)}` : '…'}
        </span>

        <button
          onClick={() => week && onShowShopping(week)}
          disabled={!week}
          className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium disabled:opacity-30 whitespace-nowrap"
        >
          Shopping
        </button>
      </div>

      {/* Day cards */}
      <div className="flex flex-col gap-3 p-4 pb-8">
        {loading && (
          <div className="text-center text-slate-500 py-16">Loading…</div>
        )}
        {!loading && week && week.days.map((day, i) => (
          <DayCard
            key={day.id}
            day={day}
            date={addDays(new Date(week.startDate + 'T00:00:00'), i)}
          />
        ))}
      </div>
    </div>
  )
}
