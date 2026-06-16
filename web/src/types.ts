export interface DayDto {
  id: number
  dayOfWeek: number
  dayName: string
  meal: string
  notes: string
  ingredients: string
}

export interface WeekDto {
  id: number
  startDate: string // "2026-03-22"
  days: DayDto[]
}

export interface ExtraItem {
  id: number
  weekId: number
  name: string
  addedDate: string
}

export interface ShoppingItem {
  id: number
  weekId: number
  dayPlanId: number | null
  name: string
  purchased: boolean
  sortOrder: number
}

// ── Learning layer ──────────────────────────────────────────────────

export type AisleKey =
  | 'produce' | 'bakery' | 'meat' | 'dairy' | 'pantry' | 'frozen' | 'other'

export type Confidence = 'learned' | 'guess' | 'unknown'

// Persisted learned maps (API shapes)
export interface AisleEntry { name: string; aisle: AisleKey }
export interface AliasEntry { alias: string; canonical: string }

// A meal cluster DERIVED from history (not persisted). `stats` is per-ingredient
// frequency across past cooks of this cluster.
export interface Cluster {
  name: string
  aliases: string[]
  cooks: number
  lastAgo: string          // human label, e.g. "2 weeks ago"
  fav: boolean
  stats: Record<string, number>
}

export interface Classification { category: AisleKey; confidence: Confidence }
