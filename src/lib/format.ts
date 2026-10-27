const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })

export const formatCurrency = (value: number) => brl.format(value)
export const formatCompactCurrency = (value: number) => brlCompact.format(value)
/** Formats a ratio (0.25 → "25%"). */
export const formatPercent = (ratio: number) => pct.format(ratio)

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MONTHS_LONG = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** "2026-10" → "out/26" */
export const formatMonthShort = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map(Number)
  return `${MONTHS[m - 1]}/${String(y).slice(2)}`
}

/** "2026-10" → "outubro de 2026" */
export const formatMonthLong = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map(Number)
  return `${MONTHS_LONG[m - 1]} de ${y}`
}

/** "2026-10-05" → "05/10/2026" */
export const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export const monthKeyOf = (iso: string) => iso.slice(0, 7)

export const todayIso = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export const shiftMonth = (monthKey: string, delta: number) => {
  const [y, m] = monthKey.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

export const daysInMonth = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** Parses "1.234,56", "1234.56" or "1234,5" into a number. */
export const parseAmount = (raw: string) => {
  const cleaned = raw.trim().replace(/[R$\s]/g, '')
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned
  const value = Number(normalized)
  return Number.isFinite(value) ? value : NaN
}
