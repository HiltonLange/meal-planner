import { useState, useCallback, useRef, useEffect } from 'react'
import type { WeekDto, DayDto, StapleItem } from '../types'
import { patchDay, fetchStaples, addStaple, deleteStaple, generateShoppingItems } from '../api'

interface Props {
  week: WeekDto
  onStartShopping: () => void
  onBack: () => void
}

function IngredientField({ day }: { day: DayDto }) {
  const [value, setValue] = useState(day.ingredients)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback((text: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => patchDay(day.id, { ingredients: text }), 600)
  }, [day.id])

  if (!day.meal.trim()) return null

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium text-slate-200">{day.dayName}</span>
        <span className="text-xs text-slate-500">{day.meal}</span>
      </div>
      <textarea
        className="bg-slate-700 text-slate-100 rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500 min-h-[64px]"
        placeholder="tomato paste, garlic, bread..."
        value={value}
        onChange={e => { setValue(e.target.value); save(e.target.value) }}
      />
    </div>
  )
}

export function ListBuilder({ week, onStartShopping, onBack }: Props) {
  const [staples, setStaples] = useState<StapleItem[]>([])
  const [newStaple, setNewStaple] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetchStaples().then(setStaples)
  }, [])

  async function handleAddStaple() {
    const name = newStaple.trim()
    if (!name) return
    const item = await addStaple(name)
    setStaples(prev => [...prev, item])
    setNewStaple('')
  }

  async function handleDeleteStaple(id: number) {
    await deleteStaple(id)
    setStaples(prev => prev.filter(s => s.id !== id))
  }

  async function handleStartShopping() {
    setGenerating(true)
    await generateShoppingItems(week.id)
    onStartShopping()
  }

  const mealsWithIngredients = week.days.filter(d => d.meal.trim())

  return (
    <div className="flex flex-col min-h-svh bg-slate-900">
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 text-xl leading-none"
        >‹</button>
        <span className="font-semibold text-slate-100 flex-1">Shopping List</span>
      </div>

      <div className="flex flex-col gap-5 p-4 pb-32">

        {/* Ingredients per meal */}
        {mealsWithIngredients.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Add meals to the week first.</p>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wide text-slate-500">What do you need to pick up?</p>
            {mealsWithIngredients.map(day => (
              <IngredientField key={day.id} day={day} />
            ))}
          </>
        )}

        {/* Staples */}
        <div className="flex flex-col gap-2 mt-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Staples &amp; other items</p>
          {staples.map(s => (
            <div key={s.id} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2">
              <span className="flex-1 text-slate-200">{s.name}</span>
              <button
                onClick={() => handleDeleteStaple(s.id)}
                className="text-slate-600 hover:text-red-400 text-lg leading-none px-1"
              >×</button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              className="flex-1 bg-slate-700 text-slate-100 rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
              placeholder="bread, bagels, vanilla syrup..."
              value={newStaple}
              onChange={e => setNewStaple(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddStaple()}
            />
            <button
              onClick={handleAddStaple}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg"
            >Add</button>
          </div>
        </div>
      </div>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/95 backdrop-blur border-t border-slate-700">
        <button
          onClick={handleStartShopping}
          disabled={generating || mealsWithIngredients.length === 0}
          className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-lg disabled:opacity-40"
        >
          {generating ? 'Generating…' : 'Start Shopping →'}
        </button>
      </div>
    </div>
  )
}
