import type { WeekDto, DayDto, StapleItem, ShoppingResponse } from './types'

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

export async function fetchShopping(weekId: number): Promise<ShoppingResponse> {
  return json(await fetch(`${BASE}/weeks/${weekId}/shopping`))
}

export async function fetchStaples(): Promise<StapleItem[]> {
  return json(await fetch(`${BASE}/staples`))
}

export async function addStaple(name: string): Promise<StapleItem> {
  return json(await fetch(`${BASE}/staples`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }))
}

export async function toggleStaplePurchased(id: number): Promise<StapleItem> {
  return json(await fetch(`${BASE}/staples/${id}/purchased`, { method: 'PATCH' }))
}

export async function deleteStaple(id: number): Promise<void> {
  await fetch(`${BASE}/staples/${id}`, { method: 'DELETE' })
}

export async function resetStaplesPurchased(): Promise<void> {
  await fetch(`${BASE}/staples/reset-purchased`, { method: 'POST' })
}
