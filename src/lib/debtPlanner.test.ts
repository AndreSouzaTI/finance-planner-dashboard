import { describe, expect, it } from 'vitest'
import type { Debt } from '../types'
import { budgetToPayOffIn, simulatePayoff } from './debtPlanner'

const debt = (id: string, balance: number, monthlyRate: number, minimumPayment: number): Debt => ({
  id,
  creditor: id,
  kind: 'other',
  balance,
  monthlyRate,
  minimumPayment,
  dueDay: 10,
  overdue: false,
  notes: '',
})

const debts = [debt('cartao', 3000, 12, 100), debt('loja', 500, 3, 50), debt('emprestimo', 2000, 5, 100)]

describe('simulatePayoff', () => {
  it('pays a single interest-free debt in the expected number of months', () => {
    const r = simulatePayoff([debt('a', 1000, 0, 100)], 250, 'avalanche')
    expect(r.months).toBe(4)
    expect(r.totalInterest).toBe(0)
    expect(r.totalPaid).toBeCloseTo(1000)
    expect(r.neverPaysOff).toBe(false)
  })

  it('avalanche pays the highest rate first, snowball the smallest balance first', () => {
    const avalanche = simulatePayoff(debts, 800, 'avalanche')
    const snowball = simulatePayoff(debts, 800, 'snowball')
    expect(avalanche.payoffOrder[0].id).toBe('cartao')
    expect(snowball.payoffOrder[0].id).toBe('loja')
  })

  it('avalanche never costs more interest than snowball', () => {
    const avalanche = simulatePayoff(debts, 800, 'avalanche')
    const snowball = simulatePayoff(debts, 800, 'snowball')
    expect(avalanche.totalInterest).toBeLessThanOrEqual(snowball.totalInterest)
  })

  it('total paid equals original balance plus interest', () => {
    const r = simulatePayoff(debts, 800, 'avalanche')
    const original = debts.reduce((s, d) => s + d.balance, 0)
    expect(r.totalPaid).toBeCloseTo(original + r.totalInterest, 2)
    expect(r.timeline[r.timeline.length - 1].balance).toBeCloseTo(0)
  })

  it('detects budgets that never outpace interest', () => {
    const r = simulatePayoff([debt('rotativo', 5000, 15, 0)], 500, 'avalanche')
    expect(r.neverPaysOff).toBe(true)
  })

  it('does not mutate the input debts', () => {
    const input = [debt('a', 1000, 2, 100)]
    simulatePayoff(input, 300, 'snowball')
    expect(input[0].balance).toBe(1000)
  })
})

describe('budgetToPayOffIn', () => {
  it('finds a budget that clears the debts within the deadline', () => {
    const budget = budgetToPayOffIn(debts, 24)
    expect(simulatePayoff(debts, budget, 'avalanche').months).toBeLessThanOrEqual(24)
    expect(simulatePayoff(debts, budget - 20, 'avalanche').months).toBeGreaterThan(24)
  })

  it('is zero when there is nothing to pay', () => {
    expect(budgetToPayOffIn([], 12)).toBe(0)
  })
})
