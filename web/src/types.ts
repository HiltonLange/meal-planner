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

export interface StapleItem {
  id: number
  name: string
  purchased: boolean
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
