import { useState, useEffect } from 'react'
import type { WeekDto } from './types'
import { fetchCurrentWeek, fetchWeekByDate } from './api'
import { WeekView } from './components/WeekView'
import { ListBuilder } from './components/ListBuilder'
import { ShoppingList } from './components/ShoppingList'
import './index.css'

type Phase = 'plan' | 'list' | 'shop'

function toSunday(date: Date) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function addDays(date: Date, n: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toIso(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('plan')
  const [week, setWeek] = useState<WeekDto | null>(null)
  const [currentSunday, setCurrentSunday] = useState<Date>(() => toSunday(new Date()))

  useEffect(() => {
    const isCurrentWeek = toIso(currentSunday) === toIso(toSunday(new Date()))
    const load = isCurrentWeek ? fetchCurrentWeek() : fetchWeekByDate(toIso(currentSunday))
    load.then(setWeek)
  }, [currentSunday])

  const isCurrentWeek = toIso(currentSunday) === toIso(toSunday(new Date()))

  return (
    <div className="flex flex-col min-h-svh bg-slate-900">
      <div className="flex-1 pb-20">
        {phase === 'plan' && (
          <WeekView
            week={week}
            currentSunday={currentSunday}
            isCurrentWeek={isCurrentWeek}
            onPrev={() => setCurrentSunday(d => addDays(d, -7))}
            onNext={() => setCurrentSunday(d => addDays(d, 7))}
            onToday={() => setCurrentSunday(toSunday(new Date()))}
            onWeekUpdated={setWeek}
          />
        )}
        {phase === 'list' && week && (
          <ListBuilder
            week={week}
            onDone={() => setPhase('shop')}
          />
        )}
        {phase === 'list' && !week && <Loading />}
        {phase === 'shop' && week && <ShoppingList weekId={week.id} />}
        {phase === 'shop' && !week && <Loading />}
      </div>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-700 flex z-20">
        <TabButton label="Plan" active={phase === 'plan'} onClick={() => setPhase('plan')} />
        <TabButton label="List" active={phase === 'list'} onClick={() => setPhase('list')} />
        <TabButton label="Shop" active={phase === 'shop'} onClick={() => setPhase('shop')} />
      </nav>
    </div>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-4 text-sm font-medium transition-colors ${
        active ? 'text-emerald-400 border-t-2 border-emerald-500 -mt-px' : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      {label}
    </button>
  )
}

function Loading() {
  return <div className="text-center text-slate-500 py-16">Loading…</div>
}
