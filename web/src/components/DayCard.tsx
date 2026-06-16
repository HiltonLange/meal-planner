import { useState, useRef, useCallback, useEffect } from 'react'
import type { DayDto } from '../types'
import { patchDay } from '../api'
import { usePlanner } from '../state'
import { C } from '../theme'
import { clusterForMeal, hasDirectSuggestion, fuzzyCluster, suggestMeals, usualsOf } from '../lib/learning'

interface Props {
  day: DayDto
  date: Date
  isToday: boolean
  isSaturday: boolean
}

export function DayCard({ day, date, isToday, isSaturday }: Props) {
  const { library, updateDay, reuseCluster } = usePlanner()
  const [meal, setMeal] = useState(day.meal)
  const [notes, setNotes] = useState(day.notes)
  const [notesOpen, setNotesOpen] = useState(!!day.notes)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback((patch: Partial<Pick<DayDto, 'meal' | 'notes'>>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const updated = await patchDay(day.id, patch)
      updateDay(updated)
    }, 450)
  }, [day.id, updateDay])

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  function changeMeal(v: string) { setMeal(v); save({ meal: v }) }
  function changeNotes(v: string) { setNotes(v); save({ notes: v }) }

  // ── matching (derived) ──
  const exact = clusterForMeal(meal, library)
  const direct = hasDirectSuggestion(meal, library)
  const fuzzy = (!exact && !direct && meal.trim()) ? fuzzyCluster(meal, library) : null
  const showReuse = fuzzy && !dismissed.has(fuzzy.name)
  const suggestions = focused ? suggestMeals(meal, library) : []

  function pickSuggestion(name: string) {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    setMeal(name); save({ meal: name }); setFocused(false)
  }
  function onBlur() {
    blurTimer.current = setTimeout(() => setFocused(false), 150)
  }

  const dayAbbr = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][day.dayOfWeek]

  return (
    <div
      className="relative"
      style={{
        background: isSaturday ? '#f6f1e7' : C.card,
        border: `1px solid ${isToday ? '#e7b79f' : isSaturday ? '#e6ddcd' : C.line}`,
        borderRadius: 20,
        padding: '15px 16px 16px',
      }}
    >
      {isToday && (
        <span style={{ position: 'absolute', left: 0, top: 14, bottom: 14, width: 4, borderRadius: 4, background: C.clay }} />
      )}

      <div className="flex gap-3">
        {/* date stamp */}
        <div className="flex flex-col items-center shrink-0" style={{ width: 44 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: isSaturday ? C.muted : C.ink3 }}>{dayAbbr}</span>
          <span className="serif" style={{ fontSize: 24, lineHeight: 1, color: isSaturday ? C.muted : C.ink }}>{date.getDate()}</span>
        </div>

        {/* meal + below */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <input
              className="serif flex-1 min-w-0 bg-transparent outline-none"
              style={{ fontSize: 22, color: isSaturday ? C.ink2 : C.ink }}
              placeholder={isSaturday ? 'Freebie — takeout?' : "What's for dinner?"}
              value={meal}
              onChange={e => changeMeal(e.target.value)}
              onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); setFocused(true) }}
              onBlur={onBlur}
            />
            {meal && (
              <button onMouseDown={e => e.preventDefault()} onClick={() => changeMeal('')}
                style={{ color: C.muted }} className="text-lg leading-none px-1">×</button>
            )}
          </div>

          {/* linked confirmation */}
          {focused && exact && (
            <div className="flex items-center gap-1.5 mt-1" style={{ fontSize: 12.5, fontWeight: 500, color: C.herbText }}>
              <span style={{ width: 6, height: 6, borderRadius: 6, background: C.herb }} />
              Pulling from your {exact.name} history
            </div>
          )}

          {/* Saturday empty hint */}
          {isSaturday && !meal && !focused && (
            <p className="italic mt-1" style={{ fontSize: 13, color: C.muted }}>Saturday's a freebie — takeout or leftovers?</p>
          )}

          {/* suggestion tray */}
          {suggestions.length > 0 && (
            <div className="mt-2 p-2.5" style={{ background: C.sub, borderRadius: 14 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
                {meal.trim() ? 'Matches' : 'Your regulars'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map(c => (
                  <button
                    key={c.name}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => pickSuggestion(c.name)}
                    style={{ background: C.card, borderRadius: 999, fontSize: 13.5, fontWeight: 500, color: C.ink, padding: '6px 12px', border: `1px solid ${C.line}` }}
                  >
                    {c.fav && <span style={{ color: C.clay, marginRight: 4 }}>★</span>}
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* reuse banner (TM1) */}
          {showReuse && fuzzy && (
            <div className="mt-2 flex items-center gap-2 flex-wrap" style={{ background: C.clayBanner, border: `1px solid ${C.clayBannerBorder}`, borderRadius: 14, padding: '10px 12px' }}>
              <span className="flex-1 min-w-0" style={{ fontSize: 13, color: C.ink2 }}>
                ↩ Looks like your <strong style={{ color: C.ink }}>{fuzzy.name}</strong> · {fuzzy.lastAgo}
              </span>
              <button
                onClick={() => { reuseCluster(meal, fuzzy.name) }}
                style={{ background: C.clay, color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 600, padding: '7px 12px', whiteSpace: 'nowrap' }}
              >
                Reuse{usualsOf(fuzzy).length > 0 ? ` · ${usualsOf(fuzzy).length} usuals` : ''}
              </button>
              <button onClick={() => setDismissed(s => new Set(s).add(fuzzy.name))}
                style={{ color: C.faint, fontSize: 13, padding: '7px 4px', whiteSpace: 'nowrap' }}>Not this</button>
            </div>
          )}

          {/* note toggle + textarea */}
          <button
            onClick={() => setNotesOpen(o => !o)}
            className="mt-2"
            style={{ fontSize: 12.5, fontWeight: 500, color: notes.trim() ? C.clay : C.faint }}
          >
            {notesOpen ? 'Hide note' : notes.trim() ? 'Note' : '+ Add note'}
          </button>
          {notesOpen && (
            <textarea
              className="w-full mt-1.5 outline-none"
              style={{ background: C.sub, border: `1px solid ${C.line}`, borderRadius: 12, fontSize: 13.5, lineHeight: 1.4, color: C.ink2, padding: '8px 10px' }}
              rows={2}
              placeholder="BYT — kids out 8pm, hot day…"
              value={notes}
              onChange={e => changeNotes(e.target.value)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
