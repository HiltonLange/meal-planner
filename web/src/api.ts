import type { WeekDto, DayDto, ExtraItem, ShoppingItem, AisleEntry, AliasEntry, AisleKey } from './types'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

// Reads must bypass the browser HTTP cache — these GETs have no cache headers,
// so heuristic caching can otherwise serve stale week/list data after a reload.
const GET: RequestInit = { cache: 'no-store' }

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export async function fetchCurrentWeek(): Promise<WeekDto> {
  return json(await fetch(`${BASE}/weeks/current`, GET))
}

export async function fetchWeekByDate(date: string): Promise<WeekDto> {
  return json(await fetch(`${BASE}/weeks/by-date/${date}`, GET))
}

export async function fetchAllWeeks(): Promise<WeekDto[]> {
  return json(await fetch(`${BASE}/weeks`, GET))
}

export async function patchDay(id: number, patch: Partial<Pick<DayDto, 'meal' | 'notes' | 'ingredients'>>): Promise<DayDto> {
  return json(await fetch(`${BASE}/days/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }))
}

export async function fetchShoppingItems(weekId: number): Promise<ShoppingItem[]> {
  return json(await fetch(`${BASE}/weeks/${weekId}/shopping-items`, GET))
}

export async function generateShoppingItems(weekId: number): Promise<ShoppingItem[]> {
  return json(await fetch(`${BASE}/weeks/${weekId}/shopping-items/generate`, { method: 'POST' }))
}

export async function toggleShoppingItemPurchased(id: number): Promise<ShoppingItem> {
  return json(await fetch(`${BASE}/shopping-items/${id}/purchased`, { method: 'PATCH' }))
}

export async function deleteShoppingItem(id: number): Promise<void> {
  await fetch(`${BASE}/shopping-items/${id}`, { method: 'DELETE' })
}

export async function resetShoppingItems(weekId: number): Promise<void> {
  await fetch(`${BASE}/weeks/${weekId}/shopping-items/reset`, { method: 'POST' })
}

export async function fetchExtras(weekId: number): Promise<ExtraItem[]> {
  return json(await fetch(`${BASE}/weeks/${weekId}/extras`, GET))
}

export async function addExtra(weekId: number, name: string): Promise<ExtraItem> {
  return json(await fetch(`${BASE}/weeks/${weekId}/extras`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }))
}

export async function deleteExtra(id: number): Promise<void> {
  await fetch(`${BASE}/extras/${id}`, { method: 'DELETE' })
}

// ── Learning maps (family-scoped) ───────────────────────────────────

export async function fetchAisleMap(): Promise<AisleEntry[]> {
  return json(await fetch(`${BASE}/ingredient-aisles`, GET))
}

export async function setIngredientAisle(name: string, aisle: AisleKey): Promise<AisleEntry> {
  return json(await fetch(`${BASE}/ingredient-aisles/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aisle }),
  }))
}

export async function fetchMealAliases(): Promise<AliasEntry[]> {
  return json(await fetch(`${BASE}/meal-aliases`, GET))
}

export async function addMealAlias(canonical: string, alias: string): Promise<AliasEntry> {
  return json(await fetch(`${BASE}/meal-aliases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canonical, alias }),
  }))
}
