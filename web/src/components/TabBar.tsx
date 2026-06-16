import type { ReactNode } from 'react'
import { usePlanner } from '../state'
import type { Phase } from '../state'
import { C } from '../theme'

const ICON: Record<Phase, ReactNode> = {
  plan: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="4.5" width="17" height="16" rx="3" />
      <path d="M3.5 9h17M8 3v3M16 3v3" />
    </svg>
  ),
  list: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  ),
  shop: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7h14l-1 12H6L5 7Z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </svg>
  ),
}

const TABS: { key: Phase; label: string }[] = [
  { key: 'plan', label: 'Plan' },
  { key: 'list', label: 'List' },
  { key: 'shop', label: 'Shop' },
]

export function TabBar() {
  const { phase, setPhase } = usePlanner()
  return (
    <nav
      className="shrink-0 flex"
      style={{
        background: C.paper,
        borderTop: `1px solid ${C.line}`,
        padding: '8px 12px calc(16px + env(safe-area-inset-bottom))',
        boxShadow: '0 -6px 18px rgba(40,28,18,0.04)',
      }}
    >
      {TABS.map(t => {
        const active = phase === t.key
        return (
          <button
            key={t.key}
            onClick={() => setPhase(t.key)}
            className="flex-1 flex flex-col items-center gap-1 py-1"
            style={{ color: active ? C.clay : '#bdb3a4' }}
          >
            {ICON[t.key]}
            <span style={{ fontSize: 11, fontWeight: 600 }}>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
