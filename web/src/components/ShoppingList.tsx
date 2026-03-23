import { useState, useEffect, useRef } from 'react'
import type { ShoppingItem } from '../types'
import { fetchShoppingItems, toggleShoppingItemPurchased, resetShoppingItems } from '../api'

const POLL_INTERVAL = 4000

interface Props {
  weekId: number
  onBack: () => void
}

export function ShoppingList({ weekId, onBack }: Props) {
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)
  // Track optimistic toggles so the UI feels instant
  const pendingToggles = useRef<Set<number>>(new Set())

  async function load() {
    const fetched = await fetchShoppingItems(weekId)
    setItems(fetched)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [weekId])

  async function toggle(item: ShoppingItem) {
    if (pendingToggles.current.has(item.id)) return
    pendingToggles.current.add(item.id)

    // Optimistic update
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, purchased: !i.purchased } : i))

    try {
      const updated = await toggleShoppingItemPurchased(item.id)
      setItems(prev => prev.map(i => i.id === item.id ? updated : i))
    } finally {
      pendingToggles.current.delete(item.id)
    }
  }

  async function handleReset() {
    await resetShoppingItems(weekId)
    await load()
  }

  // Group: unpurchased first, then purchased
  const unpurchased = items.filter(i => !i.purchased)
  const purchased = items.filter(i => i.purchased)

  // Build display list with section breaks for day groups (only in unpurchased)
  function renderItems(list: ShoppingItem[]) {
    let lastDayPlanId: number | null | undefined = undefined
    return list.map(item => {
      const showDivider = item.dayPlanId !== lastDayPlanId
      lastDayPlanId = item.dayPlanId
      return { item, showDivider }
    })
  }

  const totalCount = items.length
  const checkedCount = purchased.length

  return (
    <div className="flex flex-col min-h-svh bg-slate-900">
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 text-xl leading-none"
        >‹</button>
        <span className="font-semibold text-slate-100 flex-1">Shopping</span>
        {totalCount > 0 && (
          <span className="text-sm text-slate-400">{checkedCount}/{totalCount}</span>
        )}
        <button
          onClick={handleReset}
          className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded"
        >Reset</button>
      </div>

      <div className="flex flex-col p-4 pb-8 gap-1">
        {loading && <div className="text-center text-slate-500 py-16">Loading…</div>}

        {!loading && items.length === 0 && (
          <p className="text-center text-slate-500 py-16">No items. Go back and build your list.</p>
        )}

        {/* Unpurchased */}
        {renderItems(unpurchased).map(({ item, showDivider }) => (
          <div key={item.id}>
            {showDivider && item.dayPlanId === null && unpurchased.some(i => i.dayPlanId !== null) && (
              <div className="flex items-center gap-3 mt-3 mb-1">
                <div className="flex-1 h-px bg-slate-700" />
                <span className="text-xs uppercase tracking-wide text-slate-600">Staples</span>
                <div className="flex-1 h-px bg-slate-700" />
              </div>
            )}
            <ItemRow item={item} onToggle={() => toggle(item)} />
          </div>
        ))}

        {/* Purchased (collapsed section) */}
        {purchased.length > 0 && (
          <>
            <div className="flex items-center gap-3 mt-4 mb-1">
              <div className="flex-1 h-px bg-slate-700/50" />
              <span className="text-xs uppercase tracking-wide text-slate-600">Done ({purchased.length})</span>
              <div className="flex-1 h-px bg-slate-700/50" />
            </div>
            {purchased.map(item => (
              <ItemRow key={item.id} item={item} onToggle={() => toggle(item)} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function ItemRow({ item, onToggle }: { item: ShoppingItem; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
        item.purchased ? 'bg-slate-800/40' : 'bg-slate-800'
      }`}
    >
      <span className={`w-6 h-6 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
        item.purchased ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'
      }`}>
        {item.purchased && <span className="text-white text-xs font-bold">✓</span>}
      </span>
      <span className={`flex-1 text-base ${item.purchased ? 'line-through text-slate-500' : 'text-slate-100'}`}>
        {item.name}
      </span>
    </button>
  )
}
