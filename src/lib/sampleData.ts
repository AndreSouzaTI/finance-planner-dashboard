import type { FinanceData, Transaction } from '../types'
import { shiftMonth, todayIso } from './format'

/**
 * Realistic demo data for a tight budget with debts, spread over the last
 * six months so every chart has something to show.
 */
export const buildSampleData = (): FinanceData => {
  const currentMonth = todayIso().slice(0, 7)
  const transactions: Transaction[] = []
  let seq = 0
  const add = (month: string, day: number, t: Omit<Transaction, 'id' | 'date'>) => {
    transactions.push({ ...t, id: `demo-t${++seq}`, date: `${month}-${String(day).padStart(2, '0')}` })
  }

  for (let i = 5; i >= 0; i--) {
    const m = shiftMonth(currentMonth, -i)
    const wobble = (n: number) => Math.round(n * (0.9 + ((i * 7 + n) % 20) / 100))
    add(m, 5, { description: 'Salário', amount: 2150, type: 'income', category: 'Salário', paymentMethod: 'transfer' })
    if (i % 2 === 0)
      add(m, 18, { description: 'Bico de fim de semana', amount: wobble(350), type: 'income', category: 'Freelance / bico', paymentMethod: 'pix' })
    add(m, 6, { description: 'Aluguel', amount: 750, type: 'expense', category: 'Moradia', paymentMethod: 'pix' })
    add(m, 8, { description: 'Luz e água', amount: wobble(190), type: 'expense', category: 'Contas da casa', paymentMethod: 'boleto' })
    add(m, 9, { description: 'Internet + celular', amount: 120, type: 'expense', category: 'Contas da casa', paymentMethod: 'boleto' })
    add(m, 7, { description: 'Mercado do mês', amount: wobble(420), type: 'expense', category: 'Mercado', paymentMethod: 'debit' })
    add(m, 21, { description: 'Mercado (reposição)', amount: wobble(160), type: 'expense', category: 'Mercado', paymentMethod: 'debit' })
    add(m, 10, { description: 'Recarga transporte', amount: 180, type: 'expense', category: 'Transporte', paymentMethod: 'pix' })
    add(m, 12, { description: 'Lanches e delivery', amount: wobble(210), type: 'expense', category: 'Alimentação', paymentMethod: 'credit' })
    add(m, 15, { description: 'Streaming e apps', amount: 65, type: 'expense', category: 'Assinaturas', paymentMethod: 'credit' })
    add(m, 20, { description: 'Parcela cartão (acordo)', amount: 180, type: 'expense', category: 'Pagamento de dívidas', paymentMethod: 'boleto' })
    add(m, 25, { description: 'Parcela crediário loja', amount: 95, type: 'expense', category: 'Pagamento de dívidas', paymentMethod: 'boleto' })
    add(m, 27, { description: 'Saída com amigos', amount: wobble(140), type: 'expense', category: 'Lazer', paymentMethod: 'credit' })
    if (i === 2) add(m, 14, { description: 'Farmácia', amount: 86, type: 'expense', category: 'Saúde', paymentMethod: 'debit' })
    if (i === 0) add(m, 3, { description: 'Reserva de emergência', amount: 50, type: 'expense', category: 'Investimentos', paymentMethod: 'pix' })
  }

  return {
    version: 1,
    transactions,
    debts: [
      { id: 'demo-d1', creditor: 'Cartão Banco A', kind: 'credit_card', balance: 3200, monthlyRate: 14.5, minimumPayment: 180, dueDay: 20, overdue: false, notes: 'Saiu do rotativo para parcelamento.' },
      { id: 'demo-d2', creditor: 'Cheque especial', kind: 'overdraft', balance: 650, monthlyRate: 7.9, minimumPayment: 0, dueDay: 1, overdue: false, notes: '' },
      { id: 'demo-d3', creditor: 'Crediário Loja X', kind: 'store', balance: 780, monthlyRate: 4.2, minimumPayment: 95, dueDay: 25, overdue: false, notes: '' },
      { id: 'demo-d4', creditor: 'Conta antiga (Serasa)', kind: 'other', balance: 1400, monthlyRate: 2, minimumPayment: 0, dueDay: 10, overdue: true, notes: 'Verificar proposta de desconto.' },
    ],
    investments: [
      { id: 'demo-i1', name: 'Reserva no Tesouro Selic', kind: 'emergency', status: 'active', invested: 150, currentValue: 154, monthlyContribution: 50, target: 6000, expectedYearlyReturn: 10, startDate: shiftMonth(currentMonth, -2) + '-03', notes: 'Meta: 3 meses de gastos essenciais.' },
      { id: 'demo-i2', name: 'Tesouro IPCA+ (aposentadoria)', kind: 'treasury', status: 'planned', invested: 0, currentValue: 0, monthlyContribution: 100, target: 50000, expectedYearlyReturn: 11, startDate: shiftMonth(currentMonth, 8) + '-01', notes: 'Começar depois de quitar o cartão.' },
      { id: 'demo-i3', name: 'ETF de ações globais', kind: 'etf', status: 'planned', invested: 0, currentValue: 0, monthlyContribution: 80, target: 30000, expectedYearlyReturn: 12, startDate: shiftMonth(currentMonth, 12) + '-01', notes: '' },
    ],
  }
}
