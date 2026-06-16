import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle, createRef } from 'react'
import type { DayDto, ExtraItem } from '../types'
import { patchDay, fetchExtras, addExtra, deleteExtra, generateShoppingItems } from '../api'
import { usePlanner } from '../state'
import { C } from '../theme'
import { parseChips, normalize, clusterForMeal, usualsOf, oneOffsOf } from '../lib/learning'

function serialize(chips: string[]) { return chips.join(', ') }

interface FieldHandle { flush: () => Promise<void> }

// ── One meal's ingredient card: fast chips + tiered hints (TM2) ──────
const MealCard = forwardRef<FieldHandle, { day: DayDto; dateNum: number }>(function MealCard({ day, dateNum }, ref) {
  const { library, updateDay } = usePlanner()
  const [chips, setChips] = useState<string[]>(() => parseChips(day.ingredients))
  const [input, setInput] = useState('')
  const [revealOneOffs, setRevealOneOffs] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const chipsRef = useRef(chips); chipsRef.current = chips
  const inputRef2 = useRef(input); inputRef2.current = input

  const persist = useCallback((next: string[]): Promise<void> => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const ingredients = serialize(next)
    updateDay({ ...day, ingredients })
    return patchDay(day.id, { ingredients }).then(updateDay).then(() => {}).catch(() => {})
  }, [day, updateDay])
  const persistRef = useRef(persist); persistRef.current = persist

  const schedule = useCallback((next: string[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persist(next), 500)
  }, [persist])

  useImperativeHandle(ref, () => ({
    flush: () => {
      const pending = parseChips(inputRef2.current)
      const final = pending.length ? [...chipsRef.current, ...pending] : chipsRef.current
      if (pending.length) { setChips(final); setInput('') }
      return persistRef.current(final)
    },
  }))

  // flush pending edits on unmount (tab away) instead of dropping them
  useEffect(() => () => {
    if (saveTimer.current || inputRef2.current.trim()) {
      const pending = parseChips(inputRef2.current)
      persistRef.current(pending.length ? [...chipsRef.current, ...pending] : chipsRef.current)
    }
  }, [])

  const has = (name: string) => chips.some(c => normalize(c) === normalize(name))
  function addChips(names: string[], from?: string[]) {
    const base = from ?? chips
    const next = [...base]
    for (const n of names) if (n.trim() && !next.some(c => normalize(c) === normalize(n))) next.push(n.trim())
    if (next.length === base.length) return base
    setChips(next); setInput(''); schedule(next); return next
  }
  function commit(text: string) { return addChips(parseChips(text)) }
  function removeChip(i: number) { const next = chips.filter((_, j) => j !== i); setChips(next); schedule(next); inputRef.current?.focus() }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    if (v.includes(',') || v.includes('\n')) commit(v); else setInput(v)
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commit(input) }
    if (e.key === 'Backspace' && input === '' && chips.length) {
      const last = chips[chips.length - 1]; const next = chips.slice(0, -1)
      setChips(next); setInput(last); schedule(next)
    }
  }

  // hints (TM2)
  const cluster = clusterForMeal(day.meal, library)
  const usuals = (cluster ? usualsOf(cluster) : []).filter(n => !has(n))
  const oneOffs = (cluster ? oneOffsOf(cluster) : []).filter(o => !has(o.name))

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, padding: 14 }}>
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: C.clay }}>
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][day.dayOfWeek]} {dateNum}
        </span>
        <span className="serif flex-1 truncate" style={{ fontSize: 19, color: C.ink }}>{day.meal}</span>
        <span style={{ fontSize: 12, color: C.muted2 }}>{chips.length || ''}</span>
      </div>

      {/* chips */}
      <div className="flex flex-wrap items-center mt-2" style={{ gap: 7 }} onClick={() => inputRef.current?.focus()}>
        {chips.map((chip, i) => (
          <span key={`${i}-${chip}`} className="inline-flex items-center" style={{ background: C.clayTint, border: `1px solid ${C.clayBorderSoft}`, borderRadius: 999, fontSize: 14, fontWeight: 500, color: C.ink, padding: '5px 6px 5px 11px', whiteSpace: 'nowrap', gap: 6 }}>
            {chip}
            <button onClick={e => { e.stopPropagation(); removeChip(i) }}
              className="flex items-center justify-center" style={{ width: 18, height: 18, borderRadius: 999, background: 'rgba(164,80,44,0.14)', color: '#a4502c', fontSize: 12, lineHeight: 1 }}>×</button>
          </span>
        ))}
        <input ref={inputRef} className="flex-1 bg-transparent outline-none" style={{ minWidth: 90, fontSize: 14, color: C.ink, padding: '5px 2px' }}
          placeholder={chips.length ? 'add…' : 'add ingredients…'}
          value={input} onChange={onInputChange} onKeyDown={onKeyDown}
          onBlur={() => { if (input.trim()) commit(input) }}
          onPaste={e => { e.preventDefault(); commit(input + e.clipboardData.getData('text')) }}
        />
      </div>

      {/* hints */}
      {(usuals.length > 0 || oneOffs.length > 0) && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px dashed ${C.line}` }}>
          {usuals.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, marginBottom: 6 }}>Usuals for {cluster!.name}</p>
              <div className="flex flex-wrap" style={{ gap: 7 }}>
                {usuals.map(n => <GhostChip key={n} label={n} onClick={() => addChips([n])} />)}
              </div>
            </>
          )}
          {oneOffs.length > 0 && (
            !revealOneOffs ? (
              <button onClick={() => setRevealOneOffs(true)} style={{ fontSize: 12.5, fontWeight: 500, color: C.clay, marginTop: usuals.length ? 8 : 0 }}>
                + {oneOffs.length} thing{oneOffs.length > 1 ? 's' : ''} you've added before
              </button>
            ) : (
              <div className="mt-2">
                <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, marginBottom: 6 }}>You've added before</p>
                <div className="flex flex-wrap" style={{ gap: 7 }}>
                  {oneOffs.map(o => <GhostChip key={o.name} label={o.name} badge={`×${o.count}`} faint onClick={() => addChips([o.name])} />)}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
})

function GhostChip({ label, badge, faint, onClick }: { label: string; badge?: string; faint?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center" style={{
      gap: 5, background: 'transparent', border: `1px dashed ${faint ? C.dash : '#d8cdbd'}`, borderRadius: 999,
      fontSize: 13.5, fontWeight: 500, color: faint ? C.faint : C.ink2, padding: '5px 11px', whiteSpace: 'nowrap', opacity: faint ? 0.9 : 1,
    }}>
      <span style={{ color: C.herb, fontWeight: 700 }}>+</span>{label}
      {badge && <span style={{ fontSize: 11, color: C.muted2 }}>{badge}</span>}
    </button>
  )
}

// ── Extras card ─────────────────────────────────────────────────────
function ExtrasCard({ weekId }: { weekId: number }) {
  const [extras, setExtras] = useState<ExtraItem[]>([])
  const [draft, setDraft] = useState('')
  useEffect(() => { fetchExtras(weekId).then(setExtras) }, [weekId])

  async function add() {
    const name = draft.trim(); if (!name) return
    setDraft('')
    const tempId = -Date.now()
    setExtras(p => [...p, { id: tempId, weekId, name, addedDate: new Date().toISOString() }])
    try { const saved = await addExtra(weekId, name); setExtras(p => p.map(e => e.id === tempId ? saved : e)) }
    catch { setExtras(p => p.filter(e => e.id !== tempId)); setDraft(name) }
  }
  async function del(id: number) {
    const snap = extras; setExtras(p => p.filter(e => e.id !== id))
    if (id < 0) return
    try { await deleteExtra(id) } catch { setExtras(snap) }
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, padding: 14 }}>
      <div className="flex items-baseline justify-between">
        <span className="serif" style={{ fontSize: 19, color: C.ink }}>Extras</span>
        <span style={{ fontSize: 11, color: C.muted }}>Starts fresh each week</span>
      </div>
      <div className="flex flex-wrap mt-2" style={{ gap: 7 }}>
        {extras.map(e => (
          <span key={e.id} className="inline-flex items-center" style={{ gap: 6, background: '#eef0ea', border: '1px solid #dfe4d8', borderRadius: 999, fontSize: 14, color: C.ink2, padding: '5px 6px 5px 11px' }}>
            {e.name}
            <button onClick={() => del(e.id)} className="flex items-center justify-center" style={{ width: 18, height: 18, borderRadius: 999, background: 'rgba(90,80,70,0.12)', color: C.ink3, fontSize: 12, lineHeight: 1 }}>×</button>
          </span>
        ))}
        <input className="flex-1 bg-transparent outline-none" style={{ minWidth: 110, fontSize: 14, color: C.ink, padding: '5px 2px' }}
          placeholder="paper towels, dog food…" value={draft}
          onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} onBlur={add} />
      </div>
    </div>
  )
}

// ── List screen ─────────────────────────────────────────────────────
export function ListScreen() {
  const { week, setPhase } = usePlanner()
  const [generating, setGenerating] = useState(false)
  const meals = (week?.days ?? []).filter(d => d.meal.trim())
  const fieldRefs = useRef(meals.map(() => createRef<FieldHandle>()))
  useEffect(() => { fieldRefs.current = meals.map((_, i) => fieldRefs.current[i] ?? createRef()) }, [meals.length])

  if (!week) return <p className="text-center py-16" style={{ color: C.muted }}>Loading…</p>

  // generate count: unique normalized ingredient + extra names is computed server-side;
  // here we approximate from current day ingredients for the CTA label.
  const count = new Set(meals.flatMap(d => parseChips(d.ingredients).map(normalize))).size

  async function start() {
    await Promise.all(fieldRefs.current.map(r => r.current?.flush()))
    setGenerating(true)
    await generateShoppingItems(week!.id)
    setPhase('shop')
  }

  return (
    <div>
      <div className="sticky top-0 z-10" style={{ background: C.paper, padding: '14px 16px 12px', borderBottom: `1px solid ${C.line}` }}>
        <h1 className="serif" style={{ fontSize: 28, fontWeight: 500, color: C.ink }}>The list</h1>
        <p style={{ fontSize: 12.5, color: C.ink3 }}>Everything you need to pick up this week</p>
      </div>

      <div className="flex flex-col gap-3" style={{ padding: '16px 16px 96px' }}>
        {meals.length === 0
          ? <p className="text-center py-10" style={{ color: C.muted }}>Plan some meals first.</p>
          : meals.map((d, i) => {
              const date = new Date(week.startDate + 'T00:00:00'); date.setDate(date.getDate() + d.dayOfWeek)
              return <MealCard key={d.id} ref={fieldRefs.current[i]} day={d} dateNum={date.getDate()} />
            })}
        <ExtrasCard weekId={week.id} />
      </div>

      <div className="absolute left-0 right-0" style={{ position: 'sticky', bottom: 0, padding: '10px 16px 14px', background: `linear-gradient(to top, ${C.paper} 60%, transparent)` }}>
        <button onClick={start} disabled={generating || meals.length === 0}
          className="w-full flex items-center justify-center"
          style={{ height: 56, borderRadius: 16, background: C.clay, color: '#fff', fontSize: 16, fontWeight: 600, boxShadow: '0 8px 22px rgba(164,80,44,0.32)', opacity: generating || meals.length === 0 ? 0.5 : 1 }}>
          {generating ? 'Generating…' : `Generate & start shopping${count ? ` · ${count} items` : ''} →`}
        </button>
      </div>
    </div>
  )
}
