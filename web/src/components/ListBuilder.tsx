import { useState, useCallback, useRef, useEffect } from 'react'
import type { WeekDto, DayDto, StapleItem } from '../types'
import { patchDay, fetchStaples, addStaple, deleteStaple, generateShoppingItems } from '../api'

interface Props {
  week: WeekDto
  onDone: () => void
}

function parseChips(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

function serializeChips(chips: string[]): string {
  return chips.join(', ')
}

function IngredientField({ day }: { day: DayDto }) {
  const [chips, setChips] = useState<string[]>(() => parseChips(day.ingredients))
  const [inputValue, setInputValue] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const save = useCallback((updatedChips: string[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      patchDay(day.id, { ingredients: serializeChips(updatedChips) })
    }, 600)
  }, [day.id])

  // Flush pending input on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  function commitInput(text: string, newChips?: string[]) {
    const parsed = parseChips(text)
    if (parsed.length === 0) return newChips ?? chips
    const updated = [...(newChips ?? chips), ...parsed]
    setChips(updated)
    setInputValue('')
    save(updated)
    return updated
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    // Split immediately on comma or newline
    if (val.includes(',') || val.includes('\n')) {
      commitInput(val)
    } else {
      setInputValue(val)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitInput(inputValue)
    }
    if (e.key === 'Backspace' && inputValue === '' && chips.length > 0) {
      // Pop last chip back into input for editing
      const last = chips[chips.length - 1]
      const updated = chips.slice(0, -1)
      setChips(updated)
      setInputValue(last)
      save(updated)
    }
  }

  function handleBlur() {
    if (inputValue.trim()) {
      commitInput(inputValue)
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    commitInput(inputValue + text)
  }

  function removeChip(index: number) {
    const updated = chips.filter((_, i) => i !== index)
    setChips(updated)
    save(updated)
    inputRef.current?.focus()
  }

  if (!day.meal.trim()) return null

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium text-slate-200">{day.dayName}</span>
        <span className="text-xs text-slate-500">{day.meal}</span>
      </div>
      <div
        className="bg-slate-700 rounded-lg px-2 py-2 flex flex-wrap gap-1.5 min-h-[44px] cursor-text focus-within:ring-2 focus-within:ring-emerald-500"
        onClick={() => inputRef.current?.focus()}
      >
        {chips.map((chip, i) => (
          <span
            key={`${i}-${chip}`}
            className="inline-flex items-center gap-1 bg-slate-600 text-slate-100 text-sm rounded-md px-2.5 py-1"
          >
            {chip}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); removeChip(i) }}
              className="text-slate-400 hover:text-red-400 text-xs leading-none ml-0.5"
            >×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="flex-1 min-w-[120px] bg-transparent text-slate-100 text-sm outline-none placeholder:text-slate-500 py-1"
          placeholder={chips.length === 0 ? 'tomato paste, garlic, bread...' : 'add more...'}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onPaste={handlePaste}
        />
      </div>
    </div>
  )
}

export function ListBuilder({ week, onDone }: Props) {
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
    onDone()
  }

  const mealsWithIngredients = week.days.filter(d => d.meal.trim())

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-4 py-3">
        <span className="font-semibold text-slate-100">Build List</span>
        <p className="text-xs text-slate-500 mt-0.5">Ingredients per meal + anything else you need</p>
      </div>

      <div className="flex flex-col gap-5 p-4 pb-28">

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
              className="flex-1 bg-slate-700 text-slate-100 rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-500"
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

      {/* Bottom CTA, sits above the tab bar */}
      <div className="fixed bottom-14 left-0 right-0 p-3 bg-gradient-to-t from-slate-900 via-slate-900/95 to-transparent">
        <button
          onClick={handleStartShopping}
          disabled={generating || mealsWithIngredients.length === 0}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold disabled:opacity-40"
        >
          {generating ? 'Generating…' : 'Generate & Start Shopping →'}
        </button>
      </div>
    </div>
  )
}
