import type { FinanceData } from '../types'

const STORAGE_KEY = 'finance-planner:data'

export const emptyData = (): FinanceData => ({
  version: 1,
  transactions: [],
  debts: [],
  investments: [],
})

export const isFinanceData = (value: unknown): value is FinanceData => {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<FinanceData>
  return (
    data.version === 1 &&
    Array.isArray(data.transactions) &&
    Array.isArray(data.debts) &&
    Array.isArray(data.investments)
  )
}

/** Storage can be unavailable (private mode, blocked cookies), so every access is guarded. */
export const loadData = (): FinanceData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyData()
    const parsed: unknown = JSON.parse(raw)
    return isFinanceData(parsed) ? parsed : emptyData()
  } catch {
    return emptyData()
  }
}

export const saveData = (data: FinanceData) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Data stays in memory for this session.
  }
}
