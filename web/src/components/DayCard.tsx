import { useState, useCallback, useRef } from 'react'
import type { DayDto } from '../types'
import { patchDay } from '../api'

interface Props {
  day: DayDto
  date: Date
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function DayCard({ day, date }: Props) {
  const [meal, setMeal] = useState(day.meal)
  const [notes, setNotes] = useState(day.notes)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback((patch: Partial<Pick<DayDto, 'meal' | 'notes'>>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => patchDay(day.id, patch), 600)
  }, [day.id])

  return (
    <div className="bg-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span className="font-semibold text-slate-100">{day.dayName}</span>
        <span className="text-sm text-slate-400">{formatDate(date)}</span>
      </div>

      <input
        className="bg-slate-700 text-slate-100 rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
        placeholder="what are we having?"
        value={meal}
        onChange={e => { setMeal(e.target.value); save({ meal: e.target.value }) }}
      />

      <input
        className="bg-slate-600 text-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
        placeholder="notes — BYT, kids out 8pm, hot day..."
        value={notes}
        onChange={e => { setNotes(e.target.value); save({ notes: e.target.value }) }}
      />
    </div>
  )
}
