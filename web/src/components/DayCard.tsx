import { useState, useCallback, useRef } from 'react'
import type { DayDto } from '../types'
import { patchDay } from '../api'

interface Props {
  day: DayDto
  date: Date
  optional?: boolean
  onDayUpdated?: (day: DayDto) => void
}

const SHORT_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function DayCard({ day, date, optional, onDayUpdated }: Props) {
  const [meal, setMeal] = useState(day.meal)
  const [notes, setNotes] = useState(day.notes)
  const [notesOpen, setNotesOpen] = useState(!!day.notes)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback((patch: Partial<Pick<DayDto, 'meal' | 'notes'>>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const updated = await patchDay(day.id, patch)
      onDayUpdated?.(updated)
    }, 500)
  }, [day.id, onDayUpdated])

  const dayLabel = SHORT_DAY[day.dayOfWeek]
  const dateNum = date.getDate()
  const hasNotes = notes.trim().length > 0

  return (
    <div className={`rounded-xl px-3 py-2.5 flex flex-col gap-2 ${optional ? 'bg-slate-800/50' : 'bg-slate-800'}`}>
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center w-10 flex-shrink-0">
          <span className={`text-[11px] uppercase tracking-wide ${optional ? 'text-slate-500' : 'text-slate-400'}`}>{dayLabel}</span>
          <span className={`text-lg leading-none font-semibold ${optional ? 'text-slate-500' : 'text-slate-200'}`}>{dateNum}</span>
        </div>

        <input
          className={`flex-1 min-w-0 bg-transparent text-base outline-none placeholder:text-slate-600 ${
            optional ? 'text-slate-300' : 'text-slate-100'
          }`}
          placeholder={optional ? 'optional — takeouts?' : "what's for dinner?"}
          value={meal}
          onChange={e => { setMeal(e.target.value); save({ meal: e.target.value }) }}
        />

        <button
          onClick={() => setNotesOpen(o => !o)}
          className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
            hasNotes ? 'text-emerald-400 bg-emerald-900/30' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-700'
          }`}
          aria-label="Toggle notes"
        >
          {hasNotes ? '✎' : '+'}
        </button>
      </div>

      {(notesOpen || hasNotes) && (
        <input
          className="bg-slate-900/60 text-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-emerald-600 placeholder:text-slate-600"
          placeholder="BYT, kids out 8pm, hot day…"
          value={notes}
          onChange={e => { setNotes(e.target.value); save({ notes: e.target.value }) }}
        />
      )}
    </div>
  )
}
