import { describe, expect, it } from 'vitest'
import type { Debt, Transaction } from '../types'
import {
  buildInsights,
  dailySeries,
  expensesByCategory,
  monthlyToYearly,
  monthlyTrend,
  projectGrowth,
  summarize,
  summarizeDebts,
  topExpenses,
  transactionsInMonth,
} from './finance'

const tx = (date: string, amount: number, type: Transaction['type'], category: string): Transaction => ({
  id: `${date}-${amount}-${category}`,
  date,
  description: category,
  amount,
  type,
  category,
  paymentMethod: 'pix',
})

const debt = (over: Partial<Debt>): Debt => ({
  id: over.creditor ?? 'd',
  creditor: 'Banco',
  kind: 'other',
  balance: 1000,
  monthlyRate: 2,
  minimumPayment: 100,
  dueDay: 10,
  overdue: false,
  notes: '',
  ...over,
})

const october: Transaction[] = [
  tx('2026-10-05', 2000, 'income', 'Salário'),
  tx('2026-10-06', 800, 'expense', 'Moradia'),
  tx('2026-10-10', 300, 'expense', 'Lazer'),
  tx('2026-10-10', 100, 'expense', 'Lazer'),
  tx('2026-10-31', 200, 'expense', 'Mercado'),
]
const all = [...october, tx('2026-09-05', 1900, 'income', 'Salário'), tx('2026-09-07', 2100, 'expense', 'Moradia')]

describe('summarize', () => {
  it('totals income, expense, balance and essentials', () => {
    const s = summarize(october)
    expect(s.income).toBe(2000)
    expect(s.expense).toBe(1400)
    expect(s.balance).toBe(600)
    expect(s.savingsRate).toBeCloseTo(0.3)
    expect(s.essentialExpense).toBe(1000)
  })

  it('reports a zero savings rate when there is no income', () => {
    expect(summarize([tx('2026-10-01', 50, 'expense', 'Lazer')]).savingsRate).toBe(0)
  })
})

describe('transactionsInMonth', () => {
  it('keeps only entries of the given month', () => {
    expect(transactionsInMonth(all, '2026-09')).toHaveLength(2)
    expect(transactionsInMonth(all, '2026-10')).toHaveLength(5)
  })
})

describe('expensesByCategory', () => {
  it('groups, sorts by total and computes shares', () => {
    const cats = expensesByCategory(october)
    expect(cats.map((c) => c.category)).toEqual(['Moradia', 'Lazer', 'Mercado'])
    expect(cats[1].total).toBe(400)
    expect(cats.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1)
  })
})

describe('dailySeries', () => {
  it('has one point per day and a running balance', () => {
    const series = dailySeries(all, '2026-10')
    expect(series).toHaveLength(31)
    expect(series[9].expense).toBe(400)
    expect(series[30].cumulative).toBe(600)
  })
})

describe('monthlyTrend', () => {
  it('returns the requested months ending at the reference month', () => {
    const trend = monthlyTrend(all, '2026-10', 3)
    expect(trend.map((t) => t.month)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(trend[1].balance).toBe(-200)
  })

  it('crosses year boundaries', () => {
    expect(monthlyTrend([], '2026-01', 2).map((t) => t.month)).toEqual(['2025-12', '2026-01'])
  })
})

describe('topExpenses', () => {
  it('returns the largest expenses first', () => {
    expect(topExpenses(october, 2).map((t) => t.amount)).toEqual([800, 300])
  })
})

describe('debts', () => {
  it('summarizes balance, interest and overdue count', () => {
    const s = summarizeDebts([debt({ balance: 1000, monthlyRate: 10, overdue: true }), debt({ creditor: 'B', balance: 1000, monthlyRate: 2 })])
    expect(s.totalBalance).toBe(2000)
    expect(s.monthlyInterest).toBeCloseTo(120)
    expect(s.weightedRate).toBeCloseTo(6)
    expect(s.overdueCount).toBe(1)
  })

  it('converts monthly to yearly rates with compounding', () => {
    expect(monthlyToYearly(1)).toBeCloseTo(12.68, 2)
    expect(monthlyToYearly(0)).toBe(0)
  })
})

describe('projectGrowth', () => {
  it('matches the closed-form future value with zero return', () => {
    const points = projectGrowth(1000, 100, 0, 2)
    expect(points).toHaveLength(3)
    expect(points[2].value).toBeCloseTo(3400)
    expect(points[2].contributed).toBeCloseTo(3400)
  })

  it('compounds the yearly rate', () => {
    const points = projectGrowth(1000, 0, 10, 1)
    expect(points[1].value).toBeCloseTo(1100, 6)
  })
})

describe('buildInsights', () => {
  it('flags a negative month and expensive debt', () => {
    const month = summarize([tx('2026-10-01', 1000, 'income', 'Salário'), tx('2026-10-02', 1500, 'expense', 'Lazer')])
    const insights = buildInsights(month, expensesByCategory([]), [debt({ creditor: 'Cartão', monthlyRate: 14 })])
    const titles = insights.map((i) => i.title)
    expect(insights[0].level).toBe('danger')
    expect(titles.some((t) => t.startsWith('Cartão'))).toBe(true)
  })

  it('asks for data when the month is empty', () => {
    expect(buildInsights(summarize([]), [], [])[0].level).toBe('info')
  })
})
