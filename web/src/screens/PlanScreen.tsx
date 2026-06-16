import { usePlanner } from '../state'
import { DayCard } from '../components/DayCard'
import { C } from '../theme'

function addDays(date: Date, n: number) { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function isoOf(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

function weekLabel(startDate: string) {
  const d = new Date(startDate + 'T00:00:00')
  const end = addDays(d, 6)
  const sameMonth = d.getMonth() === end.getMonth()
  const start = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endStr = end.toLocaleDateString('en-US', sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })
  return `${start}–${endStr}`
}

export function PlanScreen() {
  const { week, isCurrentWeek, goPrev, goNext, goToday } = usePlanner()
  const todayIso = isoOf(new Date())

  return (
    <div>
      {/* header */}
      <div className="sticky top-0 z-10" style={{ background: C.paper, padding: '14px 16px 12px', borderBottom: `1px solid ${C.line}` }}>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: '#b8ad9e' }}>This week</p>
            <h1 className="serif truncate" style={{ fontSize: 30, fontWeight: 500, color: C.ink, lineHeight: 1.1 }}>
              {week ? weekLabel(week.startDate) : '…'}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <NavBtn onClick={goPrev} label="Previous week">‹</NavBtn>
            {!isCurrentWeek && (
              <button onClick={goToday}
                style={{ background: '#f6e6dd', border: '1px solid #ecd3c5', color: '#a4502c', borderRadius: 999, fontSize: 12, fontWeight: 600, padding: '6px 11px' }}>
                Today
              </button>
            )}
            <NavBtn onClick={goNext} label="Next week">›</NavBtn>
          </div>
        </div>

        {/* 7-dot overview */}
        {week && (
          <div className="flex gap-1.5 mt-2.5">
            {week.days.map(d => (
              <span key={d.id} title={d.dayName}
                style={{
                  width: 9, height: 9, borderRadius: 9,
                  background: d.meal.trim() ? C.clay : 'transparent',
                  border: d.meal.trim() ? 'none' : `1.5px solid ${C.dash}`,
                }} />
            ))}
          </div>
        )}
      </div>

      {/* day cards */}
      <div className="flex flex-col gap-3" style={{ padding: 16 }}>
        {!week && <p className="text-center py-16" style={{ color: C.muted }}>Loading…</p>}
        {week && week.days.map((d, i) => {
          const date = addDays(new Date(week.startDate + 'T00:00:00'), i)
          return (
            <DayCard
              key={d.id}
              day={d}
              date={date}
              isToday={isCurrentWeek && isoOf(date) === todayIso}
              isSaturday={d.dayOfWeek === 6}
            />
          )
        })}
      </div>
    </div>
  )
}

function NavBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label}
      className="flex items-center justify-center"
      style={{ width: 36, height: 36, borderRadius: 999, background: '#fff', border: `1px solid ${C.line}`, color: C.ink2, fontSize: 20, lineHeight: 1 }}>
      {children}
    </button>
  )
}
