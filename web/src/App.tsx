import { useState } from 'react'
import type { WeekDto } from './types'
import { WeekView } from './components/WeekView'
import { ListBuilder } from './components/ListBuilder'
import { ShoppingList } from './components/ShoppingList'
import './index.css'

type View =
  | { page: 'week' }
  | { page: 'list-builder'; week: WeekDto }
  | { page: 'shopping'; weekId: number }

export default function App() {
  const [view, setView] = useState<View>({ page: 'week' })

  if (view.page === 'list-builder') {
    return (
      <ListBuilder
        week={view.week}
        onBack={() => setView({ page: 'week' })}
        onStartShopping={() => setView({ page: 'shopping', weekId: view.week.id })}
      />
    )
  }

  if (view.page === 'shopping') {
    return (
      <ShoppingList
        weekId={view.weekId}
        onBack={() => setView({ page: 'week' })}
      />
    )
  }

  return (
    <WeekView
      onShowShopping={week => setView({ page: 'list-builder', week })}
    />
  )
}
