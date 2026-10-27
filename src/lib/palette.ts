/** Categorical palette tuned to stay legible on both light and dark surfaces. */
export const CHART_COLORS = [
  '#3b82f6',
  '#f97316',
  '#10b981',
  '#a855f7',
  '#eab308',
  '#ec4899',
  '#14b8a6',
  '#ef4444',
  '#6366f1',
  '#84cc16',
  '#0ea5e9',
  '#f43f5e',
  '#8b5cf6',
]

export const INCOME_COLOR = '#10b981'
export const EXPENSE_COLOR = '#f97316'
export const BALANCE_COLOR = '#3b82f6'

export const colorAt = (index: number) => CHART_COLORS[index % CHART_COLORS.length]
