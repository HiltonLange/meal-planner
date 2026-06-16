// The "learning layer" — pure, framework-agnostic functions.
//
// Clusters and ingredient stats are DERIVED from week history (no Meal entity,
// no new persistence). Only two small maps are persisted server-side:
//   - learned ingredient -> aisle  (corrections on the Shop screen)
//   - meal aliases (typed phrase -> canonical cluster name)
//
// Ported from the design prototype's logic class, with buildLibraryFromHistory
// added (the prototype hardcoded its LIBRARY).

import type { WeekDto, Cluster, AliasEntry, AisleKey, Classification, Confidence } from '../types'

// ── Text normalization ──────────────────────────────────────────────

export function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
}

const STOPWORDS = new Set([
  'night', 'bar', 'dinner', 'for', 'the', 'a', 'homemade', 'baked', 'veggie',
  'sunday', 'tuesday', 'easy', 'quick', 'my',
])

function stem(t: string): string {
  return t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t
}

export function tokenize(s: string): string[] {
  return normalize(s).split(' ').filter(t => t && !STOPWORDS.has(t)).map(stem)
}

// Split a free-text ingredient string into individual reminder strings.
export function parseChips(text: string): string[] {
  return (text || '').split(/[,\n]/).map(s => s.trim()).filter(Boolean)
}

// ── Aisles ──────────────────────────────────────────────────────────
// Order IS the in-store walk order.

export const AISLES: { key: AisleKey; label: string; color: string }[] = [
  { key: 'produce', label: 'Produce', color: '#5b9163' },
  { key: 'bakery', label: 'Bakery', color: '#c79a4e' },
  { key: 'meat', label: 'Meat & Fish', color: '#c0584f' },
  { key: 'dairy', label: 'Dairy & Eggs', color: '#6f86b8' },
  { key: 'pantry', label: 'Pantry', color: '#b3793f' },
  { key: 'frozen', label: 'Frozen', color: '#5a93a8' },
  { key: 'other', label: 'Other', color: '#9b8f80' },
]

export function aisleMeta(key: AisleKey) {
  return AISLES.find(a => a.key === key) ?? AISLES[AISLES.length - 1]
}

const KEYWORDS: Record<Exclude<AisleKey, 'other'>, string[]> = {
  meat: ['beef', 'chicken', 'salmon', 'fish', 'shrimp', 'pork', 'bacon', 'sausage', 'turkey', 'steak', 'tuna', 'meat', 'pepperoni', 'ham'],
  dairy: ['milk', 'cheese', 'parmesan', 'mozzarella', 'butter', 'egg', 'yogurt', 'cream', 'feta', 'cheddar'],
  bakery: ['bread', 'tortilla', 'bun', 'bagel', 'dough', 'pita', 'baguette', 'roll', 'croissant'],
  produce: ['lettuce', 'tomato', 'onion', 'garlic', 'basil', 'avocado', 'lemon', 'lime', 'broccoli', 'carrot', 'pepper', 'ginger', 'cilantro', 'spinach', 'potato', 'cucumber', 'apple', 'banana', 'herb', 'scallion', 'mushroom', 'zucchini', 'kale', 'salad', 'thyme', 'celery', 'greens'],
  pantry: ['pasta', 'rice', 'marinara', 'sauce', 'soy', 'oil', 'flour', 'sugar', 'salt', 'bean', 'salsa', 'syrup', 'pancake', 'broth', 'stock', 'noodle', 'spaghetti', 'seasoning', 'oat', 'cereal', 'peanut', 'honey', 'vinegar', 'ketchup', 'mustard', 'coconut', 'curry'],
  frozen: ['frozen', 'ice cream', 'fries', 'popsicle'],
}

const GUESS_ORDER: Exclude<AisleKey, 'other'>[] = ['meat', 'dairy', 'bakery', 'produce', 'pantry', 'frozen']

function dictGuess(name: string): AisleKey | null {
  const n = (name || '').toLowerCase()
  for (const key of GUESS_ORDER) {
    if (KEYWORDS[key].some(w => n.includes(w))) return key
  }
  return null
}

// Three-state: learned (you told us) → guess (dictionary) → unknown (ask).
export function classify(name: string, learned: Record<string, AisleKey>): Classification {
  const n = normalize(name)
  if (learned[n]) return { category: learned[n], confidence: 'learned' as Confidence }
  const g = dictGuess(n)
  if (g) return { category: g, confidence: 'guess' }
  return { category: 'other', confidence: 'unknown' }
}

// ── Cluster derivation from history ─────────────────────────────────

function toSunday(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay())
  return x
}

function relWeeksLabel(weeksAgo: number): string {
  if (weeksAgo <= 0) return 'this week'
  if (weeksAgo === 1) return 'last week'
  if (weeksAgo <= 4) return `${weeksAgo} weeks ago`
  if (weeksAgo <= 8) return 'a month ago'
  return 'a while ago'
}

interface Raw {
  key: string
  name: string          // display name (most recent original casing)
  cooks: number
  lastSunday: number    // ms of most recent cook's week start
  stats: Record<string, number>
}

// Build clusters from PAST weeks (exclude the week currently being edited).
// `aliases` merges typed phrases into their canonical cluster.
export function buildLibraryFromHistory(weeks: WeekDto[], aliases: AliasEntry[]): Cluster[] {
  const raw = new Map<string, Raw>()

  for (const w of weeks) {
    const sunday = toSunday(new Date(w.startDate + 'T00:00:00')).getTime()
    for (const d of w.days) {
      const meal = d.meal?.trim()
      if (!meal) continue
      const key = normalize(meal)
      if (!key) continue
      let r = raw.get(key)
      if (!r) { r = { key, name: meal, cooks: 0, lastSunday: 0, stats: {} }; raw.set(key, r) }
      r.cooks += 1
      if (sunday >= r.lastSunday) { r.lastSunday = sunday; r.name = meal } // latest casing wins
      const ings = new Set(parseChips(d.ingredients).map(normalize).filter(Boolean))
      for (const ing of ings) r.stats[ing] = (r.stats[ing] || 0) + 1
    }
  }

  // alias key -> canonical key. Canonical display preferred from an existing raw.
  const aliasToCanon = new Map<string, string>()
  for (const a of aliases) {
    const ak = normalize(a.alias)
    const ck = normalize(a.canonical)
    if (ak && ck && ak !== ck) aliasToCanon.set(ak, ck)
  }

  // Merge each raw cluster into its canonical bucket.
  const merged = new Map<string, Raw & { aliases: Set<string> }>()
  const canonOf = (k: string) => aliasToCanon.get(k) ?? k
  for (const r of raw.values()) {
    const ck = canonOf(r.key)
    let m = merged.get(ck)
    if (!m) {
      m = { key: ck, name: r.name, cooks: 0, lastSunday: 0, stats: {}, aliases: new Set() }
      merged.set(ck, m)
    }
    m.cooks += r.cooks
    if (r.lastSunday >= m.lastSunday) m.lastSunday = r.lastSunday
    if (r.key === ck && r.lastSunday >= 0) m.name = r.name // canonical's own casing
    for (const [ing, n] of Object.entries(r.stats)) m.stats[ing] = (m.stats[ing] || 0) + n
    if (r.key !== ck) m.aliases.add(r.key)
  }
  // Fold in alias strings even when the alias phrase was never itself cooked.
  for (const [ak, ck] of aliasToCanon) {
    const m = merged.get(ck)
    if (m && ak !== ck) m.aliases.add(ak)
  }

  const nowSunday = toSunday(new Date()).getTime()
  const out: Cluster[] = []
  for (const m of merged.values()) {
    const weeksAgo = Math.round((nowSunday - m.lastSunday) / (7 * 86400_000))
    out.push({
      name: m.name,
      aliases: [...m.aliases],
      cooks: m.cooks,
      lastAgo: relWeeksLabel(weeksAgo),
      fav: m.cooks >= 3,
      stats: m.stats,
    })
  }
  // Most-cooked first.
  out.sort((a, b) => b.cooks - a.cooks)
  return out
}

// ── Cluster matching ────────────────────────────────────────────────

function aliasesFor(c: Cluster): string[] {
  return [c.name, ...c.aliases]
}

// Exact link: typed text equals a cluster's name or any learned alias.
export function clusterForMeal(meal: string, library: Cluster[]): Cluster | null {
  const m = normalize(meal)
  if (!m) return null
  return library.find(c => aliasesFor(c).some(a => normalize(a) === m)) ?? null
}

// Is the typed text a clean substring of a known name? (then the tray handles it)
export function hasDirectSuggestion(meal: string, library: Cluster[]): boolean {
  const m = normalize(meal)
  if (!m) return false
  return library.some(c => aliasesFor(c).some(a => normalize(a).includes(m)))
}

// Fuzzy near-miss: token overlap against names/aliases. Best cluster ≥ 0.5.
export function fuzzyCluster(meal: string, library: Cluster[]): Cluster | null {
  const qt = tokenize(meal)
  if (!qt.length) return null
  let best: Cluster | null = null
  let bestScore = 0
  for (const c of library) {
    for (const a of aliasesFor(c)) {
      const nt = tokenize(a)
      if (!nt.length) continue
      const inter = qt.filter(t => nt.includes(t)).length
      const score = inter / Math.max(qt.length, nt.length)
      if (score > bestScore) { bestScore = score; best = c }
    }
  }
  return bestScore >= 0.5 ? best : null
}

// ── Ingredient hints (tiered) ───────────────────────────────────────

function usualThreshold(c: Cluster): number {
  return Math.max(2, Math.ceil(c.cooks * 0.6))
}

// Ingredients used in ≥60% of past cooks, ranked by frequency.
export function usualsOf(c: Cluster): string[] {
  const t = usualThreshold(c)
  return Object.entries(c.stats).filter(([, n]) => n >= t).sort((a, b) => b[1] - a[1]).map(([k]) => k)
}

// The one-offs (below threshold), with their frequency.
export function oneOffsOf(c: Cluster): { name: string; count: number }[] {
  const t = usualThreshold(c)
  return Object.entries(c.stats).filter(([, n]) => n < t).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ name: k, count: n }))
}

// ── Suggestion tray ─────────────────────────────────────────────────

// Empty query → "your regulars" (favorites first, then most-cooked).
// Partial text → clusters whose name/alias contains it.
export function suggestMeals(query: string, library: Cluster[], limit = 6): Cluster[] {
  const q = normalize(query)
  if (!q) {
    return [...library].sort((a, b) => Number(b.fav) - Number(a.fav) || b.cooks - a.cooks).slice(0, limit)
  }
  return library.filter(c => aliasesFor(c).some(a => normalize(a).includes(q))).slice(0, limit)
}

// Convert an AisleEntry[] into a lookup map.
export function aisleMap(entries: { name: string; aisle: AisleKey }[]): Record<string, AisleKey> {
  const m: Record<string, AisleKey> = {}
  for (const e of entries) m[normalize(e.name)] = e.aisle
  return m
}
