import { describe, expect, it } from 'vitest'
import { buildWorkbook, parseWorkbook } from './excel'
import { buildSampleData } from './sampleData'
import { parseAmount } from './format'

describe('excel round trip', () => {
  it('exports and imports the same records', async () => {
    const data = buildSampleData()
    const buffer = await buildWorkbook(data, '2026-10').xlsx.writeBuffer()
    const { data: imported, counts } = await parseWorkbook(buffer as ArrayBuffer)

    expect(counts).toEqual({
      transactions: data.transactions.length,
      debts: data.debts.length,
      investments: data.investments.length,
    })

    const byKey = (t: { date: string; amount: number; description: string }) => `${t.date}|${t.amount}|${t.description}`
    expect(imported.transactions.map(byKey).sort()).toEqual(data.transactions.map(byKey).sort())

    const card = imported.debts.find((d) => d.creditor === 'Cartão Banco A')
    expect(card).toMatchObject({ kind: 'credit_card', balance: 3200, monthlyRate: 14.5, overdue: false })

    const planned = imported.investments.filter((i) => i.status === 'planned')
    expect(planned).toHaveLength(2)
  })

  it('creates the expected sheets with formulas in the summary', () => {
    const wb = buildWorkbook(buildSampleData(), '2026-10')
    expect(wb.worksheets.map((s) => s.name)).toEqual(['Resumo', 'Lançamentos', 'Dívidas', 'Investimentos', 'Listas'])
    const income = wb.getWorksheet('Resumo')!.getCell('B4').value as { formula: string }
    expect(income.formula).toContain('SUMIFS')
  })
})

describe('parseAmount', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['1234.56', 1234.56],
    ['R$ 89,90', 89.9],
    ['10', 10],
  ])('parses %s', (raw, expected) => {
    expect(parseAmount(raw)).toBeCloseTo(expected)
  })

  it('returns NaN for garbage', () => {
    expect(parseAmount('abc')).toBeNaN()
  })
})
