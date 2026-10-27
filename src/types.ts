export type TransactionType = 'income' | 'expense'

export type PaymentMethod = 'pix' | 'debit' | 'credit' | 'cash' | 'boleto' | 'transfer'

export interface Transaction {
  id: string
  /** ISO date (yyyy-mm-dd) */
  date: string
  description: string
  amount: number
  type: TransactionType
  category: string
  paymentMethod: PaymentMethod
}

export type DebtKind =
  | 'credit_card'
  | 'overdraft'
  | 'personal_loan'
  | 'payroll_loan'
  | 'financing'
  | 'store'
  | 'other'

export interface Debt {
  id: string
  creditor: string
  kind: DebtKind
  /** Outstanding balance today */
  balance: number
  /** Monthly interest rate in percent (e.g. 12.5 = 12.5% a.m.) */
  monthlyRate: number
  /** Minimum or agreed monthly payment */
  minimumPayment: number
  dueDay: number
  overdue: boolean
  notes: string
}

export type InvestmentKind =
  | 'emergency'
  | 'treasury'
  | 'cdb'
  | 'lci_lca'
  | 'stocks'
  | 'reits'
  | 'etf'
  | 'pension'
  | 'crypto'
  | 'other'

export type InvestmentStatus = 'active' | 'planned'

export interface Investment {
  id: string
  name: string
  kind: InvestmentKind
  status: InvestmentStatus
  /** Amount already invested (0 for planned) */
  invested: number
  /** Current market value (0 for planned) */
  currentValue: number
  /** Planned monthly contribution */
  monthlyContribution: number
  /** Target amount for this position or plan */
  target: number
  /** Expected yearly return in percent, used for projections */
  expectedYearlyReturn: number
  startDate: string
  notes: string
}

export interface FinanceData {
  version: 1
  transactions: Transaction[]
  debts: Debt[]
  investments: Investment[]
}
