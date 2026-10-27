import type { ReactNode } from 'react'
import { formatMonthLong, shiftMonth } from '../lib/format'

export function Card({ title, aside, children }: { title?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {title && (
        <div className="card-title">
          <h3>{title}</h3>
          {aside && <span>{aside}</span>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'positive' | 'negative'
}) {
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone ?? ''}`}>{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  )
}

export function MonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return (
    <div className="month-picker" role="group" aria-label="Mês">
      <button className="icon-btn" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Mês anterior">
        ‹
      </button>
      <strong>{formatMonthLong(month)}</strong>
      <button className="icon-btn" onClick={() => onChange(shiftMonth(month, 1))} aria-label="Próximo mês">
        ›
      </button>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`field ${wide ? 'field-wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}
