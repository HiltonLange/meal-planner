import { useState, useEffect, useRef } from 'react'
import type { ShoppingItem, AisleKey } from '../types'
import { fetchShoppingItems, toggleShoppingItemPurchased, resetShoppingItems, addExtra, generateShoppingItems } from '../api'
import { usePlanner } from '../state'
import { C } from '../theme'
import { classify, aisleMeta, AISLES } from '../lib/learning'

const POLL = 4000
type Grouping = 'aisle' | 'meal'

export function ShopScreen() {
  const { week, learned, learnAisle } = usePlanner()
  const weekId = week?.id ?? 0
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [grouping, setGrouping] = useState<Grouping>('aisle')
  const [doneOpen, setDoneOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const pending = useRef<Set<number>>(new Set())

  async function load() {
    if (!weekId) return
    const fresh = await fetchShoppingItems(weekId)
    setItems(prev => {
      if (pending.current.size === 0) return fresh
      const byId = new Map(prev.map(i => [i.id, i]))
      return fresh.map(i => pending.current.has(i.id) ? (byId.get(i.id) ?? i) : i)
    })
    setLoading(false)
  }
  useEffect(() => {
    if (!weekId) return
    load(); const t = setInterval(load, POLL); return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekId])

  async function toggle(it: ShoppingItem) {
    if (pending.current.has(it.id)) return
    pending.current.add(it.id)
    setItems(p => p.map(i => i.id === it.id ? { ...i, purchased: !i.purchased } : i))
    try { const u = await toggleShoppingItemPurchased(it.id); setItems(p => p.map(i => i.id === it.id ? u : i)) }
    finally { pending.current.delete(it.id) }
  }

  async function quickAdd() {
    const name = draft.trim(); if (!name || !weekId) return
    setDraft('')
    const temp: ShoppingItem = { id: -Date.now(), weekId, dayPlanId: null, name, purchased: false, sortOrder: 9999 }
    setItems(p => [...p, temp])
    try { await addExtra(weekId, name); const fresh = await generateShoppingItems(weekId); setItems(fresh) }
    catch { setItems(p => p.filter(i => i.id !== temp.id)) }
  }

  async function reset() { await resetShoppingItems(weekId); await load() }

  function moveTo(it: ShoppingItem, aisle: AisleKey) { learnAisle(it.name, aisle); setEditing(null) }

  const mealName = (dayPlanId: number | null) =>
    dayPlanId == null ? 'Extras' : (week?.days.find(d => d.id === dayPlanId)?.meal || 'Meal')

  const purchased = items.filter(i => i.purchased)
  const unpurchased = items.filter(i => !i.purchased)
  const total = items.length
  const pct = total ? Math.round((purchased.length / total) * 100) : 0

  // build ordered groups of unpurchased items
  type Group = { key: string; label: string; color: string; items: ShoppingItem[] }
  let groups: Group[] = []
  if (grouping === 'aisle') {
    groups = AISLES.map(a => ({
      key: a.key, label: a.label, color: a.color,
      items: unpurchased.filter(i => classify(i.name, learned).category === a.key),
    })).filter(g => g.items.length)
  } else {
    const byMeal = new Map<string, ShoppingItem[]>()
    for (const i of unpurchased) {
      const k = String(i.dayPlanId ?? 'extras')
      const arr = byMeal.get(k)
      if (arr) arr.push(i); else byMeal.set(k, [i])
    }
    groups = [...byMeal.entries()].map(([k, its]) => ({
      key: k, label: mealName(k === 'extras' ? null : Number(k)), color: C.clay, items: its,
    }))
  }

  return (
    <div onClick={() => editing !== null && setEditing(null)}>
      {/* header */}
      <div className="sticky top-0 z-20" style={{ background: C.paper, padding: '14px 16px 12px', borderBottom: `1px solid ${C.line}` }}>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="serif" style={{ fontSize: 28, fontWeight: 500, color: C.ink }}>Shopping</h1>
            <p style={{ fontSize: 12.5, color: C.ink3 }}>{grouping === 'aisle' ? 'Ordered for your store walk' : 'Grouped by meal'}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="serif" style={{ fontSize: 26, color: C.clay }}>{purchased.length}/{total}</span>
            <button onClick={reset} style={{ fontSize: 12.5, color: C.ink3 }}>Reset</button>
          </div>
        </div>

        {/* progress bar */}
        <div className="mt-2.5" style={{ height: 7, borderRadius: 7, background: C.track, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: C.herb, transition: 'width 0.3s ease' }} />
        </div>

        {/* segmented toggle + legend */}
        <div className="flex items-center justify-between mt-2.5">
          <div className="flex" style={{ background: C.track, borderRadius: 11, padding: 3 }}>
            <Seg active={grouping === 'meal'} onClick={() => setGrouping('meal')}>By meal</Seg>
            <Seg active={grouping === 'aisle'} onClick={() => setGrouping('aisle')}>By aisle</Seg>
          </div>
          {grouping === 'aisle' && (
            <span style={{ fontSize: 11, color: '#897e71' }}>
              <span style={{ color: C.ink2 }}>●</span> learned&nbsp;&nbsp;<span>○</span> a guess — tap to fix
            </span>
          )}
        </div>
      </div>

      {/* quick add */}
      <div className="flex gap-2" style={{ padding: '12px 16px 4px' }}>
        <input className="flex-1 outline-none" style={{ height: 46, borderRadius: 12, background: C.card, border: `1px solid ${C.line}`, fontSize: 15, color: C.ink, padding: '0 14px' }}
          placeholder="Add to the cart…" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && quickAdd()} />
        <button onClick={quickAdd} className="flex items-center justify-center" style={{ width: 46, height: 46, borderRadius: 12, background: C.clayTint, color: C.clayDeep, fontSize: 24, lineHeight: 1 }}>+</button>
      </div>

      <div style={{ padding: '8px 16px 24px' }}>
        {loading && <p className="text-center py-16" style={{ color: C.muted }}>Loading…</p>}
        {!loading && total === 0 && <p className="text-center py-16" style={{ color: C.muted }}>Nothing yet — build your list.</p>}

        {/* groups */}
        {groups.map(g => (
          <div key={g.key} className="mb-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span style={{ width: 9, height: 9, borderRadius: 9, background: g.color }} />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: '#7a7062' }}>{g.label}</span>
              <span style={{ fontSize: 12, color: C.muted2 }}>{g.items.length}</span>
              <span className="flex-1" style={{ height: 1, background: C.line }} />
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 18 }}>
              {g.items.map((it, idx) => (
                <Row key={it.id} item={it} learned={learned} showTag={grouping === 'aisle'}
                  editing={editing === it.id} onToggle={() => toggle(it)}
                  onTag={() => setEditing(editing === it.id ? null : it.id)} onMove={a => moveTo(it, a)}
                  divider={idx > 0} />
              ))}
            </div>
          </div>
        ))}

        {/* done drawer */}
        {purchased.length > 0 && (
          <div className="mt-2">
            <button onClick={() => setDoneOpen(o => !o)} style={{ fontSize: 13, fontWeight: 600, color: C.ink3 }}>
              {doneOpen ? '▾' : '▸'} Done ({purchased.length})
            </button>
            {doneOpen && (
              <div className="mt-1.5" style={{ background: C.mutedSurface, borderRadius: 14, overflow: 'hidden' }}>
                {purchased.map((it, idx) => (
                  <Row key={it.id} item={it} learned={learned} showTag={false}
                    editing={false} onToggle={() => toggle(it)} onTag={() => {}} onMove={() => {}} divider={idx > 0} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      borderRadius: 9, fontSize: 12.5, fontWeight: 600, padding: '5px 12px',
      background: active ? '#fff' : 'transparent', color: active ? C.ink : C.ink3,
      boxShadow: active ? '0 1px 3px rgba(40,28,18,0.12)' : 'none',
    }}>{children}</button>
  )
}

function Row({ item, learned, showTag, editing, onToggle, onTag, onMove, divider }: {
  item: ShoppingItem; learned: Record<string, AisleKey>; showTag: boolean; editing: boolean
  onToggle: () => void; onTag: () => void; onMove: (a: AisleKey) => void; divider: boolean
}) {
  const cls = classify(item.name, learned)
  return (
    <div className="relative flex items-center gap-3" style={{ padding: '12px 14px', borderTop: divider ? `1px solid ${C.lineRow}` : 'none' }}>
      <button onClick={onToggle} className="flex items-center justify-center shrink-0"
        style={{ width: 27, height: 27, borderRadius: 999, border: item.purchased ? 'none' : `2px solid ${C.dash}`, background: item.purchased ? C.herb : 'transparent' }}>
        {item.purchased && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4.5 4.5L19 7" /></svg>}
      </button>
      <span className="flex-1" style={{ fontSize: 17, fontWeight: 500, color: item.purchased ? '#b0a596' : C.ink, textDecoration: item.purchased ? 'line-through' : 'none' }}>{item.name}</span>

      {showTag && !item.purchased && (
        <button onClick={e => { e.stopPropagation(); onTag() }}>
          <AisleTag cat={cls.category} confidence={cls.confidence} />
        </button>
      )}

      {editing && (
        <div className="absolute z-30" style={{ top: '100%', right: 8, background: '#fff', borderRadius: 14, boxShadow: '0 16px 36px rgba(40,28,18,0.2)', padding: 6, minWidth: 170 }} onClick={e => e.stopPropagation()}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: C.muted, padding: '3px 6px 7px' }}>Move to aisle</p>
          {AISLES.map(a => (
            <button key={a.key} onClick={() => onMove(a.key)} className="w-full flex items-center gap-2.5" style={{ padding: '8px 8px', borderRadius: 8, fontSize: 14, color: C.ink }}>
              <span style={{ width: 9, height: 9, borderRadius: 9, background: a.color }} />
              <span className="flex-1 text-left">{a.label}</span>
              {cls.category === a.key && <span style={{ color: C.herb }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AisleTag({ cat, confidence }: { cat: AisleKey; confidence: 'learned' | 'guess' | 'unknown' }) {
  const meta = aisleMeta(cat)
  if (confidence === 'unknown') {
    return <span style={{ fontSize: 12.5, fontWeight: 600, color: C.clay, border: `1px dashed ${C.clayBorderSoft}`, borderRadius: 999, padding: '3px 10px' }}>Which aisle?</span>
  }
  const guess = confidence === 'guess'
  return (
    <span className="inline-flex items-center" style={{
      gap: 5, fontSize: 12.5, color: C.ink3, borderRadius: 999, padding: '3px 10px',
      border: guess ? `1px dashed ${C.dashGuess}` : '1px solid transparent',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 8, background: guess ? 'transparent' : meta.color, border: guess ? `1.5px solid ${meta.color}` : 'none' }} />
      {meta.label}
    </span>
  )
}
