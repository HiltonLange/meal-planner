import { PlannerProvider, usePlanner } from './state'
import { TabBar } from './components/TabBar'
import { PlanScreen } from './screens/PlanScreen'
import { ListScreen } from './screens/ListScreen'
import { ShopScreen } from './screens/ShopScreen'
import { C } from './theme'
import './index.css'

export default function App() {
  return (
    <PlannerProvider>
      <Shell />
    </PlannerProvider>
  )
}

function Shell() {
  const { phase } = usePlanner()
  return (
    <div className="flex justify-center" style={{ background: C.deviceBg, minHeight: '100svh' }}>
      <div className="w-full flex flex-col" style={{ maxWidth: 480, height: '100svh', background: C.paper }}>
        <main className="flex-1 overflow-y-auto">
          {phase === 'plan' && <PlanScreen />}
          {phase === 'list' && <ListScreen />}
          {phase === 'shop' && <ShopScreen />}
        </main>
        <TabBar />
      </div>
    </div>
  )
}
