import type { Debt, Investment, Transaction } from '../types'
import { ESSENTIAL_CATEGORIES } from './labels'
import { daysInMonth, monthKeyOf, shiftMonth } from './format'

export interface MonthSummary {
  income: number
  expense: number
  balance: number
  /** Share of income left after expenses (can be negative) */
  savingsRate: number
  essentialExpense: number
}

export const transactionsInMonth = (transactions: Transaction[], monthKey: string) =>
  transactions.filter((t) => monthKeyOf(t.date) === monthKey)

export const summarize = (transactions: Transaction[]): MonthSummary => {
  let income = 0
  let expense = 0
  let essentialExpense = 0
  for (const t of transactions) {
    if (t.type === 'income') income += t.amount
    else {
      expense += t.amount
      if (ESSENTIAL_CATEGORIES.has(t.category)) essentialExpense += t.amount
    }
  }
  const balance = income - expense
  return {
    income,
    expense,
    balance,
    savingsRate: income > 0 ? balance / income : 0,
    essentialExpense,
  }
}

export interface CategoryTotal {
  category: string
  total: number
  share: number
}

export const expensesByCategory = (transactions: Transaction[]): CategoryTotal[] => {
  const totals = new Map<string, number>()
  let sum = 0
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount)
    sum += t.amount
  }
  return [...totals.entries()]
    .map(([category, total]) => ({ category, total, share: sum > 0 ? total / sum : 0 }))
    .sort((a, b) => b.total - a.total)
}

export interface DailyPoint {
  day: number
  income: number
  expense: number
  /** Running balance since the first day of the month */
  cumulative: number
}

export const dailySeries = (transactions: Transaction[], monthKey: string): DailyPoint[] => {
  const days = daysInMonth(monthKey)
  const points: DailyPoint[] = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    income: 0,
    expense: 0,
    cumulative: 0,
  }))
  for (const t of transactionsInMonth(transactions, monthKey)) {
    const day = Number(t.date.slice(8, 10))
    const point = points[day - 1]
    if (!point) continue
    if (t.type === 'income') point.income += t.amount
    else point.expense += t.amount
  }
  let running = 0
  for (const p of points) {
    running += p.income - p.expense
    p.cumulative = running
  }
  return points
}

export interface MonthlyPoint extends MonthSummary {
  month: string
}

export const monthlyTrend = (
  transactions: Transaction[],
  endMonth: string,
  months = 6,
): MonthlyPoint[] =>
  Array.from({ length: months }, (_, i) => {
    const month = shiftMonth(endMonth, i - months + 1)
    return { month, ...summarize(transactionsInMonth(transactions, month)) }
  })

export const topExpenses = (transactions: Transaction[], limit = 5) =>
  transactions
    .filter((t) => t.type === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)

export interface DebtSummary {
  totalBalance: number
  totalMinimum: number
  /** Interest the debts generate in one month if nothing is paid */
  monthlyInterest: number
  weightedRate: number
  overdueCount: number
}

export const summarizeDebts = (debts: Debt[]): DebtSummary => {
  let totalBalance = 0
  let totalMinimum = 0
  let monthlyInterest = 0
  let overdueCount = 0
  for (const d of debts) {
    totalBalance += d.balance
    totalMinimum += d.minimumPayment
    monthlyInterest += d.balance * (d.monthlyRate / 100)
    if (d.overdue) overdueCount++
  }
  return {
    totalBalance,
    totalMinimum,
    monthlyInterest,
    weightedRate: totalBalance > 0 ? (monthlyInterest / totalBalance) * 100 : 0,
    overdueCount,
  }
}

/** Converts a monthly rate (%) into the equivalent yearly rate (%). */
export const monthlyToYearly = (monthlyRate: number) =>
  (Math.pow(1 + monthlyRate / 100, 12) - 1) * 100

export interface PortfolioSummary {
  invested: number
  currentValue: number
  profit: number
  monthlyContribution: number
  plannedCount: number
}

export const summarizePortfolio = (investments: Investment[]): PortfolioSummary => {
  let invested = 0
  let currentValue = 0
  let monthlyContribution = 0
  let plannedCount = 0
  for (const i of investments) {
    if (i.status === 'planned') {
      plannedCount++
    } else {
      invested += i.invested
      currentValue += i.currentValue
    }
    monthlyContribution += i.monthlyContribution
  }
  return { invested, currentValue, profit: currentValue - invested, monthlyContribution, plannedCount }
}

/**
 * Future value of an initial amount plus monthly contributions, compounded monthly.
 * Returns one point per year so it can be charted directly.
 */
export const projectGrowth = (
  initial: number,
  monthlyContribution: number,
  yearlyReturn: number,
  years: number,
) => {
  const monthlyRate = Math.pow(1 + yearlyReturn / 100, 1 / 12) - 1
  const points = [{ year: 0, value: initial, contributed: initial }]
  let value = initial
  let contributed = initial
  for (let month = 1; month <= years * 12; month++) {
    value = value * (1 + monthlyRate) + monthlyContribution
    contributed += monthlyContribution
    if (month % 12 === 0) points.push({ year: month / 12, value, contributed })
  }
  return points
}

export type InsightLevel = 'danger' | 'warning' | 'success' | 'info'

export interface Insight {
  level: InsightLevel
  title: string
  detail: string
}

/** Plain-language observations derived from the month and the debts. */
export const buildInsights = (
  month: MonthSummary,
  categories: CategoryTotal[],
  debts: Debt[],
): Insight[] => {
  const insights: Insight[] = []
  const debtSummary = summarizeDebts(debts)

  if (month.income === 0 && month.expense === 0) {
    return [
      {
        level: 'info',
        title: 'Nenhum lançamento neste mês',
        detail: 'Registre ganhos e gastos do dia a dia para ver a análise do mês.',
      },
    ]
  }

  if (month.balance < 0) {
    insights.push({
      level: 'danger',
      title: 'Você gastou mais do que ganhou',
      detail: `O mês está negativo. Corte primeiro o que não é essencial e evite cobrir a diferença com cartão ou cheque especial.`,
    })
  } else if (month.savingsRate >= 0.1) {
    insights.push({
      level: 'success',
      title: 'Sobrou dinheiro no mês',
      detail: 'Direcione a sobra para a dívida de juros mais altos ou para a reserva de emergência.',
    })
  }

  const expensive = [...debts].sort((a, b) => b.monthlyRate - a.monthlyRate)[0]
  if (expensive && expensive.monthlyRate >= 5) {
    insights.push({
      level: 'danger',
      title: `${expensive.creditor}: ${expensive.monthlyRate.toLocaleString('pt-BR')}% ao mês`,
      detail: `Equivale a ~${Math.round(monthlyToYearly(expensive.monthlyRate))}% ao ano. É a primeira dívida a negociar ou quitar.`,
    })
  }

  if (debtSummary.overdueCount > 0) {
    insights.push({
      level: 'warning',
      title: `${debtSummary.overdueCount} dívida(s) em atraso`,
      detail: 'Dívidas atrasadas costumam ter os maiores descontos em renegociação. Só aceite parcelas que caibam no orçamento.',
    })
  }

  if (month.income > 0 && debtSummary.totalMinimum / month.income > 0.3) {
    insights.push({
      level: 'warning',
      title: 'Parcelas comprometem mais de 30% da renda',
      detail: 'Considere renegociar prazos ou trocar dívida cara por uma mais barata.',
    })
  }

  const top = categories.find((c) => !ESSENTIAL_CATEGORIES.has(c.category))
  if (top && top.share >= 0.15) {
    insights.push({
      level: 'info',
      title: `${top.category} é seu maior gasto não essencial`,
      detail: `Representa ${Math.round(top.share * 100)}% das despesas do mês.`,
    })
  }

  return insights
}
