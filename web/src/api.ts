import type { WeekDto, DayDto, ExtraItem, ShoppingItem } from './types'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export async function fetchCurrentWeek(): Promise<WeekDto> {
  return json(await fetch(`${BASE}/weeks/current`))
}

export async function fetchWeekByDate(date: string): Promise<WeekDto> {
  return json(await fetch(`${BASE}/weeks/by-date/${date}`))
}

export async function fetchAllWeeks(): Promise<WeekDto[]> {
  return json(await fetch(`${BASE}/weeks`))
}

export async function patchDay(id: number, patch: Partial<Pick<DayDto, 'meal' | 'notes' | 'ingredients'>>): Promise<DayDto> {
  return json(await fetch(`${BASE}/days/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }))
}

export async function fetchShoppingItems(weekId: number): Promise<ShoppingItem[]> {
  return json(await fetch(`${BASE}/weeks/${weekId}/shopping-items`))
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
  return json(await fetch(`${BASE}/weeks/${weekId}/extras`))
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
