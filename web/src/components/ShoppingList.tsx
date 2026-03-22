import { useState, useEffect } from 'react'
import { fetchShopping, fetchStaples, addStaple, deleteStaple, toggleStaplePurchased, resetStaplesPurchased } from '../api'
import type { ShoppingResponse, StapleItem } from '../types'

const DAY_CHECKED_KEY = (weekId: number) => `mp-checked-${weekId}`

interface Props {
  weekId: number
  onBack: () => void
}

export function ShoppingList({ weekId, onBack }: Props) {
  const [shopping, setShopping] = useState<ShoppingResponse | null>(null)
  const [staples, setStaples] = useState<StapleItem[]>([])
  const [checkedDayItems, setCheckedDayItems] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(DAY_CHECKED_KEY(weekId))
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch { return new Set() }
  })
  const [newStaple, setNewStaple] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchShopping(weekId), fetchStaples()]).then(([s, st]) => {
      setShopping(s)
      setStaples(st)
      setLoading(false)
    })
  }, [weekId])

  function toggleDayItem(key: string) {
    setCheckedDayItems(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      localStorage.setItem(DAY_CHECKED_KEY(weekId), JSON.stringify([...next]))
      return next
    })
  }

  async function toggleStaple(id: number) {
    const updated = await toggleStaplePurchased(id)
    setStaples(prev => prev.map(s => s.id === id ? updated : s))
  }

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

  async function handleResetAll() {
    setCheckedDayItems(new Set())
    localStorage.removeItem(DAY_CHECKED_KEY(weekId))
    await resetStaplesPurchased()
    setStaples(prev => prev.map(s => ({ ...s, purchased: false })))
  }

  const dayItems = shopping?.dayItems ?? []
  const checkedCount = checkedDayItems.size + staples.filter(s => s.purchased).length
  const totalCount = dayItems.length + staples.length

  return (
    <div className="flex flex-col min-h-svh bg-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 text-xl leading-none"
          aria-label="Back"
        >‹</button>
        <span className="font-semibold text-slate-100 flex-1">Shopping List</span>
        {totalCount > 0 && (
          <span className="text-sm text-slate-400">{checkedCount}/{totalCount}</span>
        )}
        <button
          onClick={handleResetAll}
          className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-col gap-1 p-4 pb-8">
        {loading && <div className="text-center text-slate-500 py-16">Loading…</div>}

        {/* Day ingredients */}
        {!loading && dayItems.length > 0 && (
          <>
            {dayItems.map((item, i) => {
              const key = `${item.dayName}-${item.name}-${i}`
              const checked = checkedDayItems.has(key)
              return (
                <button
                  key={key}
                  onClick={() => toggleDayItem(key)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    checked ? 'bg-slate-800/50' : 'bg-slate-800'
                  }`}
                >
                  <span className={`w-6 h-6 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${
                    checked ? 'border-indigo-500 bg-indigo-500' : 'border-slate-600'
                  }`}>
                    {checked && <span className="text-white text-xs">✓</span>}
                  </span>
                  <span className={`flex-1 text-base ${checked ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                    {item.name}
                  </span>
                  <span className="text-xs text-slate-600">{item.dayName}</span>
                </button>
              )
            })}
          </>
        )}

        {/* Divider + Staples */}
        {!loading && (
          <>
            <div className="flex items-center gap-3 mt-4 mb-2">
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-xs uppercase tracking-wide text-slate-500">Staples</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>

            {staples.map(staple => (
              <div key={staple.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${staple.purchased ? 'bg-slate-800/50' : 'bg-slate-800'}`}>
                <button
                  onClick={() => toggleStaple(staple.id)}
                  className={`w-6 h-6 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${
                    staple.purchased ? 'border-indigo-500 bg-indigo-500' : 'border-slate-600'
                  }`}
                  aria-label={staple.purchased ? 'Uncheck' : 'Check'}
                >
                  {staple.purchased && <span className="text-white text-xs">✓</span>}
                </button>
                <span className={`flex-1 text-base ${staple.purchased ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                  {staple.name}
                </span>
                <button
                  onClick={() => handleDeleteStaple(staple.id)}
                  className="text-slate-600 hover:text-red-400 px-2 text-lg leading-none"
                  aria-label="Remove"
                >×</button>
              </div>
            ))}

            {/* Add staple */}
            <div className="flex gap-2 mt-2">
              <input
                className="flex-1 bg-slate-700 text-slate-100 rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
                placeholder="Add staple item…"
                value={newStaple}
                onChange={e => setNewStaple(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddStaple()}
              />
              <button
                onClick={handleAddStaple}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium"
              >
                Add
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
