import { useState } from 'react'
import { WeekView } from './components/WeekView'
import { ShoppingList } from './components/ShoppingList'
import './index.css'

type View = { page: 'week' } | { page: 'shopping'; weekId: number }

export default function App() {
  const [view, setView] = useState<View>({ page: 'week' })

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
      onShowShopping={weekId => setView({ page: 'shopping', weekId })}
    />
  )
}
