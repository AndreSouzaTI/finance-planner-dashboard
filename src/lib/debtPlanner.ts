import type { Debt } from '../types'

export type PayoffStrategy = 'avalanche' | 'snowball'

export interface PayoffResult {
  strategy: PayoffStrategy
  months: number
  totalInterest: number
  totalPaid: number
  /** Month (1-based) in which each debt reached zero */
  payoffOrder: { id: string; creditor: string; month: number }[]
  /** Remaining total balance at the end of each month */
  timeline: { month: number; balance: number }[]
  /** True when payments never outpace interest within the horizon */
  neverPaysOff: boolean
}

const MAX_MONTHS = 600

/**
 * Simulates paying all debts with a fixed monthly budget.
 * Every debt receives its minimum payment; whatever is left goes to the
 * priority debt (highest rate for avalanche, smallest balance for snowball).
 * Freed-up minimums roll over to the next debt.
 */
export const simulatePayoff = (
  debts: Debt[],
  monthlyBudget: number,
  strategy: PayoffStrategy,
): PayoffResult => {
  const open = debts
    .filter((d) => d.balance > 0)
    .map((d) => ({ id: d.id, creditor: d.creditor, balance: d.balance, rate: d.monthlyRate / 100, min: d.minimumPayment }))

  const priority = () =>
    open
      .filter((d) => d.balance > 0.005)
      .sort((a, b) => (strategy === 'avalanche' ? b.rate - a.rate || a.balance - b.balance : a.balance - b.balance || b.rate - a.rate))

  const payoffOrder: PayoffResult['payoffOrder'] = []
  const timeline: PayoffResult['timeline'] = []
  let totalInterest = 0
  let totalPaid = 0
  let month = 0

  while (open.some((d) => d.balance > 0.005) && month < MAX_MONTHS) {
    month++
    for (const d of open) {
      if (d.balance <= 0.005) continue
      const interest = d.balance * d.rate
      d.balance += interest
      totalInterest += interest
    }

    let available = monthlyBudget
    for (const d of open) {
      if (d.balance <= 0.005 || available <= 0) continue
      const pay = Math.min(d.min, d.balance, available)
      d.balance -= pay
      available -= pay
      totalPaid += pay
    }

    for (const d of priority()) {
      if (available <= 0) break
      const pay = Math.min(d.balance, available)
      d.balance -= pay
      available -= pay
      totalPaid += pay
    }

    for (const d of open) {
      if (d.balance <= 0.005 && !payoffOrder.some((p) => p.id === d.id)) {
        d.balance = 0
        payoffOrder.push({ id: d.id, creditor: d.creditor, month })
      }
    }

    timeline.push({ month, balance: open.reduce((s, d) => s + d.balance, 0) })
  }

  return {
    strategy,
    months: month,
    totalInterest,
    totalPaid,
    payoffOrder,
    timeline,
    neverPaysOff: open.some((d) => d.balance > 0.005),
  }
}

/**
 * Smallest monthly budget (rounded up to R$ 10) that clears every debt within
 * the given number of months. Uses binary search over simulatePayoff.
 */
export const budgetToPayOffIn = (debts: Debt[], months: number, strategy: PayoffStrategy = 'avalanche') => {
  const total = debts.reduce((s, d) => s + d.balance, 0)
  if (total <= 0) return 0
  const fits = (budget: number) => {
    const r = simulatePayoff(debts, budget, strategy)
    return !r.neverPaysOff && r.months <= months
  }
  let lo = 0
  let hi = Math.max(total, 1)
  while (!fits(hi)) hi *= 2
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2
    if (fits(mid)) hi = mid
    else lo = mid
  }
  return Math.ceil(hi / 10) * 10
}
