import type { DebtKind, InvestmentKind, PaymentMethod, TransactionType } from '../types'

export const INCOME_CATEGORIES = [
  'Salário',
  'Freelance / bico',
  'Vendas',
  'Benefícios',
  'Rendimentos',
  'Outras receitas',
] as const

export const EXPENSE_CATEGORIES = [
  'Moradia',
  'Alimentação',
  'Mercado',
  'Transporte',
  'Contas da casa',
  'Saúde',
  'Educação',
  'Lazer',
  'Assinaturas',
  'Vestuário',
  'Pagamento de dívidas',
  'Investimentos',
  'Outros gastos',
] as const

export const categoriesFor = (type: TransactionType): readonly string[] =>
  type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

/** Essential categories are protected first when the budget is tight. */
export const ESSENTIAL_CATEGORIES = new Set<string>([
  'Moradia',
  'Alimentação',
  'Mercado',
  'Transporte',
  'Contas da casa',
  'Saúde',
])

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  debit: 'Débito',
  credit: 'Cartão de crédito',
  cash: 'Dinheiro',
  boleto: 'Boleto',
  transfer: 'Transferência',
}

export const DEBT_KIND_LABELS: Record<DebtKind, string> = {
  credit_card: 'Cartão de crédito',
  overdraft: 'Cheque especial',
  personal_loan: 'Empréstimo pessoal',
  payroll_loan: 'Consignado',
  financing: 'Financiamento',
  store: 'Crediário / loja',
  other: 'Outra',
}

export const INVESTMENT_KIND_LABELS: Record<InvestmentKind, string> = {
  emergency: 'Reserva de emergência',
  treasury: 'Tesouro Direto',
  cdb: 'CDB',
  lci_lca: 'LCI / LCA',
  stocks: 'Ações',
  reits: 'Fundos imobiliários',
  etf: 'ETFs',
  pension: 'Previdência',
  crypto: 'Criptoativos',
  other: 'Outro',
}
