import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { WeekDto, DayDto, Cluster, AliasEntry, AisleKey } from './types'
import {
  fetchCurrentWeek, fetchWeekByDate, fetchAllWeeks,
  fetchAisleMap, setIngredientAisle, fetchMealAliases, addMealAlias,
} from './api'
import { buildLibraryFromHistory, aisleMap, normalize } from './lib/learning'

export type Phase = 'plan' | 'list' | 'shop'

function toSunday(date: Date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay()); return d
}
function addDays(date: Date, n: number) { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

interface PlannerCtx {
  phase: Phase
  setPhase: (p: Phase) => void
  week: WeekDto | null
  currentSunday: Date
  isCurrentWeek: boolean
  goPrev: () => void
  goNext: () => void
  goToday: () => void
  updateDay: (day: DayDto) => void
  library: Cluster[]
  learned: Record<string, AisleKey>
  learnAisle: (name: string, aisle: AisleKey) => void
  reuseCluster: (meal: string, canonical: string) => void
}

const Ctx = createContext<PlannerCtx | null>(null)

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('plan')
  const [week, setWeek] = useState<WeekDto | null>(null)
  const [currentSunday, setCurrentSunday] = useState<Date>(() => toSunday(new Date()))
  const [allWeeks, setAllWeeks] = useState<WeekDto[]>([])
  const [learned, setLearned] = useState<Record<string, AisleKey>>({})
  const [aliases, setAliases] = useState<AliasEntry[]>([])

  const isCurrentWeek = toIso(currentSunday) === toIso(toSunday(new Date()))

  // Load the week being viewed.
  useEffect(() => {
    const load = isCurrentWeek ? fetchCurrentWeek() : fetchWeekByDate(toIso(currentSunday))
    load.then(setWeek)
  }, [currentSunday, isCurrentWeek])

  // Load shared learning data once.
  useEffect(() => {
    fetchAllWeeks().then(setAllWeeks).catch(() => {})
    fetchAisleMap().then(m => setLearned(aisleMap(m))).catch(() => {})
    fetchMealAliases().then(setAliases).catch(() => {})
  }, [])

  // Derive clusters from PAST weeks (exclude the week being edited).
  const library = useMemo(
    () => buildLibraryFromHistory(allWeeks.filter(w => w.id !== week?.id), aliases),
    [allWeeks, aliases, week?.id],
  )

  const updateDay = useCallback((day: DayDto) => {
    setWeek(w => w ? { ...w, days: w.days.map(d => d.id === day.id ? day : d) } : w)
  }, [])

  const learnAisle = useCallback((name: string, aisle: AisleKey) => {
    const key = normalize(name)
    setLearned(prev => ({ ...prev, [key]: aisle }))   // optimistic
    setIngredientAisle(key, aisle).catch(() => {})
  }, [])

  const reuseCluster = useCallback((meal: string, canonical: string) => {
    const alias = normalize(meal)
    setAliases(prev => prev.some(a => a.alias === alias) ? prev : [...prev, { alias, canonical }])
    addMealAlias(canonical, meal).catch(() => {})
  }, [])

  const value: PlannerCtx = {
    phase, setPhase, week, currentSunday, isCurrentWeek,
    goPrev: () => setCurrentSunday(d => addDays(d, -7)),
    goNext: () => setCurrentSunday(d => addDays(d, 7)),
    goToday: () => setCurrentSunday(toSunday(new Date())),
    updateDay, library, learned, learnAisle, reuseCluster,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePlanner(): PlannerCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('usePlanner must be used within PlannerProvider')
  return c
}
