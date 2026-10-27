import ExcelJS from 'exceljs'
import type { Debt, DebtKind, FinanceData, Investment, InvestmentKind, PaymentMethod, Transaction } from '../types'
import {
  DEBT_KIND_LABELS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  INVESTMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
} from './labels'
import { newId, todayIso } from './format'

/** Rows pre-formatted with validation and formulas so the sheet works on its own. */
const INPUT_ROWS = 1000
const DEBT_ROWS = 50
const INVESTMENT_ROWS = 50

const TYPE_LABELS = { income: 'Ganho', expense: 'Gasto' } as const
const STATUS_LABELS = { active: 'Ativo', planned: 'Planejado' } as const

const BRL = '"R$" #,##0.00;[Red]-"R$" #,##0.00'
const PCT = '0.0%'
const DATE = 'dd/mm/yyyy'

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
const SOFT_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF3FF' } }
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } }

const toExcelDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const invert = <K extends string>(labels: Record<K, string>) =>
  Object.fromEntries(Object.entries(labels).map(([k, v]) => [String(v).toLowerCase(), k])) as Record<string, K>

const styleHeader = (sheet: ExcelJS.Worksheet) => {
  const header = sheet.getRow(1)
  header.font = HEADER_FONT
  header.fill = HEADER_FILL
  header.alignment = { vertical: 'middle' }
  header.height = 22
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

const listFormula = (sheet: string, col: string, count: number) => [`${sheet}!$${col}$2:$${col}$${count + 1}`]

const LISTS: [string, readonly string[]][] = [
  ['Tipos', Object.values(TYPE_LABELS)],
  ['Categorias', [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]],
  ['Formas de pagamento', Object.values(PAYMENT_METHOD_LABELS)],
  ['Tipos de dívida', Object.values(DEBT_KIND_LABELS)],
  ['Tipos de investimento', Object.values(INVESTMENT_KIND_LABELS)],
  ['Situação', Object.values(STATUS_LABELS)],
  ['Sim/Não', ['Sim', 'Não']],
]

/** Range of each list on the hidden "Listas" sheet, used by data validation. */
const LIST_REFS: Record<string, string[]> = Object.fromEntries(
  LISTS.map(([title, values], c) => [title, listFormula('Listas', String.fromCharCode(65 + c), values.length)]),
)

const addListsSheet = (wb: ExcelJS.Workbook) => {
  const sheet = wb.addWorksheet('Listas')
  LISTS.forEach(([title, values], c) => {
    sheet.getCell(1, c + 1).value = title
    values.forEach((v, r) => (sheet.getCell(r + 2, c + 1).value = v))
    sheet.getColumn(c + 1).width = 26
  })
  styleHeader(sheet)
  sheet.state = 'hidden'
}

const validate = (sheet: ExcelJS.Worksheet, col: string, rows: number, formulae: string[]) => {
  for (let r = 2; r <= rows + 1; r++) {
    sheet.getCell(`${col}${r}`).dataValidation = { type: 'list', allowBlank: true, formulae, showErrorMessage: true }
  }
}

const addTransactionsSheet = (wb: ExcelJS.Workbook, items: Transaction[]) => {
  const sheet = wb.addWorksheet('Lançamentos', { properties: { tabColor: { argb: 'FF10B981' } } })
  sheet.columns = [
    { header: 'Data', key: 'date', width: 13, style: { numFmt: DATE } },
    { header: 'Descrição', key: 'description', width: 34 },
    { header: 'Categoria', key: 'category', width: 22 },
    { header: 'Tipo', key: 'type', width: 10 },
    { header: 'Valor', key: 'amount', width: 15, style: { numFmt: BRL } },
    { header: 'Forma de pagamento', key: 'paymentMethod', width: 20 },
  ]
  for (const t of [...items].sort((a, b) => a.date.localeCompare(b.date))) {
    sheet.addRow({
      date: toExcelDate(t.date),
      description: t.description,
      category: t.category,
      type: TYPE_LABELS[t.type],
      amount: t.amount,
      paymentMethod: PAYMENT_METHOD_LABELS[t.paymentMethod],
    })
  }
  const rows = Math.max(INPUT_ROWS, items.length + 200)
  validate(sheet, 'C', rows, LIST_REFS['Categorias'])
  validate(sheet, 'D', rows, LIST_REFS['Tipos'])
  validate(sheet, 'F', rows, LIST_REFS['Formas de pagamento'])
  styleHeader(sheet)
  sheet.autoFilter = 'A1:F1'
}

const addDebtsSheet = (wb: ExcelJS.Workbook, debts: Debt[]) => {
  const sheet = wb.addWorksheet('Dívidas', { properties: { tabColor: { argb: 'FFEF4444' } } })
  sheet.columns = [
    { header: 'Credor', width: 26 },
    { header: 'Tipo', width: 20 },
    { header: 'Saldo devedor', width: 16, style: { numFmt: BRL } },
    { header: 'Juros a.m. (%)', width: 14, style: { numFmt: '0.00' } },
    { header: 'Juros a.a. (equiv.)', width: 18, style: { numFmt: PCT } },
    { header: 'Parcela mensal', width: 16, style: { numFmt: BRL } },
    { header: 'Dia venc.', width: 10 },
    { header: 'Em atraso', width: 11 },
    { header: 'Juros gerados/mês', width: 18, style: { numFmt: BRL } },
    { header: 'Observações', width: 36 },
  ]
  const rows = Math.max(DEBT_ROWS, debts.length + 20)
  for (let i = 0; i < rows; i++) {
    const d = debts[i]
    const r = i + 2
    sheet.getRow(r).values = [
      d?.creditor,
      d ? DEBT_KIND_LABELS[d.kind] : undefined,
      d?.balance,
      d?.monthlyRate,
      { formula: `IF(D${r}="","",(1+D${r}/100)^12-1)` },
      d?.minimumPayment,
      d?.dueDay,
      d ? (d.overdue ? 'Sim' : 'Não') : undefined,
      { formula: `IF(C${r}="","",C${r}*D${r}/100)` },
      d?.notes || undefined,
    ]
  }
  validate(sheet, 'B', rows, LIST_REFS['Tipos de dívida'])
  validate(sheet, 'H', rows, LIST_REFS['Sim/Não'])
  styleHeader(sheet)
  sheet.addConditionalFormatting({
    ref: `D2:D${rows + 1}`,
    rules: [
      { type: 'cellIs', operator: 'greaterThan', formulae: ['5'], priority: 1, style: { font: { color: { argb: 'FFC92A2A' }, bold: true } } },
    ],
  })
}

const addInvestmentsSheet = (wb: ExcelJS.Workbook, investments: Investment[]) => {
  const sheet = wb.addWorksheet('Investimentos', { properties: { tabColor: { argb: 'FF3B82F6' } } })
  sheet.columns = [
    { header: 'Nome', width: 30 },
    { header: 'Tipo', width: 22 },
    { header: 'Situação', width: 12 },
    { header: 'Valor aplicado', width: 16, style: { numFmt: BRL } },
    { header: 'Valor atual', width: 16, style: { numFmt: BRL } },
    { header: 'Rendimento', width: 16, style: { numFmt: BRL } },
    { header: 'Aporte mensal', width: 15, style: { numFmt: BRL } },
    { header: 'Meta', width: 15, style: { numFmt: BRL } },
    { header: 'Progresso', width: 11, style: { numFmt: PCT } },
    { header: 'Rent. esperada (% a.a.)', width: 22, style: { numFmt: '0.00' } },
    { header: 'Início', width: 13, style: { numFmt: DATE } },
    { header: 'Observações', width: 36 },
  ]
  const rows = Math.max(INVESTMENT_ROWS, investments.length + 20)
  for (let i = 0; i < rows; i++) {
    const inv = investments[i]
    const r = i + 2
    sheet.getRow(r).values = [
      inv?.name,
      inv ? INVESTMENT_KIND_LABELS[inv.kind] : undefined,
      inv ? STATUS_LABELS[inv.status] : undefined,
      inv?.invested,
      inv?.currentValue,
      { formula: `IF(A${r}="","",E${r}-D${r})` },
      inv?.monthlyContribution,
      inv?.target || undefined,
      { formula: `IF(OR(H${r}="",H${r}=0),"",MIN(1,E${r}/H${r}))` },
      inv?.expectedYearlyReturn,
      inv ? toExcelDate(inv.startDate) : undefined,
      inv?.notes || undefined,
    ]
  }
  validate(sheet, 'B', rows, LIST_REFS['Tipos de investimento'])
  validate(sheet, 'C', rows, LIST_REFS['Situação'])
  styleHeader(sheet)
}

const addSummarySheet = (wb: ExcelJS.Workbook, referenceMonth: string) => {
  const sheet = wb.addWorksheet('Resumo', { properties: { tabColor: { argb: 'FF2563EB' } } })
  sheet.getColumn(1).width = 30
  sheet.getColumn(2).width = 18
  sheet.getColumn(3).width = 18
  sheet.getColumn(4).width = 18
  sheet.getColumn(5).width = 4
  sheet.getColumn(6).width = 26
  sheet.getColumn(7).width = 18
  sheet.getColumn(8).width = 12

  const L = "'Lançamentos'"
  const sumIf = (type: string, from: string, to: string, extra = '') =>
    `SUMIFS(${L}!$E:$E,${L}!$D:$D,"${type}",${L}!$A:$A,">="&${from},${L}!$A:$A,"<="&${to}${extra})`

  sheet.getCell('A1').value = 'Resumo financeiro'
  sheet.getCell('A1').font = { bold: true, size: 16 }
  sheet.getCell('A2').value = 'Mês de referência (altere a data):'
  const [y, m] = referenceMonth.split('-').map(Number)
  sheet.getCell('B2').value = new Date(Date.UTC(y, m - 1, 1))
  sheet.getCell('B2').numFmt = 'mmm/yyyy'
  sheet.getCell('B2').fill = SOFT_FILL
  sheet.getCell('B2').font = { bold: true }
  sheet.getCell('C2').value = { formula: 'EOMONTH(B2,0)' }
  sheet.getCell('C2').numFmt = DATE
  sheet.getCell('C2').font = { color: { argb: 'FF8A94A3' } }

  const kpis: [string, string, string][] = [
    ['Ganhos do mês', sumIf('Ganho', '$B$2', '$C$2'), BRL],
    ['Gastos do mês', sumIf('Gasto', '$B$2', '$C$2'), BRL],
    ['Saldo do mês', 'B4-B5', BRL],
    ['Taxa de poupança', 'IF(B4=0,0,B6/B4)', PCT],
    ['Dívidas em aberto', "SUM('Dívidas'!$C:$C)", BRL],
    ['Juros das dívidas por mês', "SUM('Dívidas'!$I:$I)", BRL],
    ['Parcelas de dívidas por mês', "SUM('Dívidas'!$F:$F)", BRL],
    ['Comprometimento da renda', 'IF(B4=0,0,B10/B4)', PCT],
    ['Patrimônio investido', 'SUMIFS(Investimentos!$E:$E,Investimentos!$C:$C,"Ativo")', BRL],
    ['Aportes planejados por mês', 'SUM(Investimentos!$G:$G)', BRL],
  ]
  kpis.forEach(([label, formula, fmt], i) => {
    const r = i + 4
    sheet.getCell(`A${r}`).value = label
    const cell = sheet.getCell(`B${r}`)
    cell.value = { formula }
    cell.numFmt = fmt
    cell.font = { bold: true }
  })
  sheet.addConditionalFormatting({
    ref: 'B6',
    rules: [{ type: 'cellIs', operator: 'lessThan', formulae: ['0'], priority: 1, style: { font: { color: { argb: 'FFC92A2A' }, bold: true } } }],
  })

  // Expenses by category for the reference month
  sheet.getCell('F3').value = 'Gastos por categoria'
  sheet.getCell('G3').value = 'Total'
  sheet.getCell('H3').value = '% do mês'
  ;['F3', 'G3', 'H3'].forEach((a) => {
    sheet.getCell(a).font = HEADER_FONT
    sheet.getCell(a).fill = HEADER_FILL
  })
  EXPENSE_CATEGORIES.forEach((cat, i) => {
    const r = i + 4
    sheet.getCell(`F${r}`).value = cat
    sheet.getCell(`G${r}`).value = { formula: sumIf('Gasto', '$B$2', '$C$2', `,${L}!$C:$C,F${r}`) }
    sheet.getCell(`G${r}`).numFmt = BRL
    sheet.getCell(`H${r}`).value = { formula: `IF($B$5=0,0,G${r}/$B$5)` }
    sheet.getCell(`H${r}`).numFmt = PCT
  })
  const catEnd = EXPENSE_CATEGORIES.length + 3
  sheet.addConditionalFormatting({
    ref: `H4:H${catEnd}`,
    rules: [{ type: 'dataBar', priority: 1, minLength: 0, maxLength: 100, cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }], color: { argb: 'FFF97316' } } as unknown as ExcelJS.ConditionalFormattingRule],
  })

  // Last 12 months trend
  const start = 16
  ;['Mês', 'Ganhos', 'Gastos', 'Saldo'].forEach((h, i) => {
    const cell = sheet.getCell(start, i + 1)
    cell.value = h
    cell.font = HEADER_FONT
    cell.fill = HEADER_FILL
  })
  sheet.getCell(start - 1, 1).value = 'Últimos 12 meses'
  sheet.getCell(start - 1, 1).font = { bold: true, size: 13 }
  for (let i = 0; i < 12; i++) {
    const r = start + 1 + i
    sheet.getCell(`A${r}`).value = { formula: `EDATE($B$2,${i - 11})` }
    sheet.getCell(`A${r}`).numFmt = 'mmm/yyyy'
    sheet.getCell(`B${r}`).value = { formula: sumIf('Ganho', `$A${r}`, `EOMONTH($A${r},0)`) }
    sheet.getCell(`C${r}`).value = { formula: sumIf('Gasto', `$A${r}`, `EOMONTH($A${r},0)`) }
    sheet.getCell(`D${r}`).value = { formula: `B${r}-C${r}` }
    ;['B', 'C', 'D'].forEach((c) => (sheet.getCell(`${c}${r}`).numFmt = BRL))
  }

  sheet.getCell(`A${start + 14}`).value =
    'Dica: registre tudo na aba Lançamentos. Este resumo, as fórmulas das dívidas e dos investimentos se atualizam sozinhos.'
  sheet.getCell(`A${start + 14}`).font = { italic: true, color: { argb: 'FF5F6B7A' } }
}

export const buildWorkbook = (data: FinanceData, referenceMonth = todayIso().slice(0, 7)) => {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Finance Planner'
  wb.created = new Date()
  wb.calcProperties.fullCalcOnLoad = true

  addSummarySheet(wb, referenceMonth)
  addTransactionsSheet(wb, data.transactions)
  addDebtsSheet(wb, data.debts)
  addInvestmentsSheet(wb, data.investments)
  addListsSheet(wb)
  return wb
}

export const exportWorkbook = async (data: FinanceData, referenceMonth?: string) => {
  const buffer = await buildWorkbook(data, referenceMonth).xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/* ---------- Import ---------- */

type CellValue = ExcelJS.CellValue

const plain = (v: CellValue): unknown => {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return v.result
    if ('richText' in v) return v.richText.map((t) => t.text).join('')
    if ('text' in v) return v.text
  }
  return v
}

const asText = (v: CellValue) => {
  const p = plain(v)
  return p === null || p === undefined ? '' : String(p).trim()
}

const asNumber = (v: CellValue) => {
  const p = plain(v)
  if (typeof p === 'number') return p
  const s = String(p ?? '').replace(/[R$\s]/g, '')
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s)
  return Number.isFinite(n) ? n : 0
}

const asIsoDate = (v: CellValue) => {
  const p = plain(v)
  if (p instanceof Date) return p.toISOString().slice(0, 10)
  if (typeof p === 'number') return new Date(Math.round((p - 25569) * 86_400_000)).toISOString().slice(0, 10)
  const s = String(p ?? '').trim()
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ''
}

const rowsOf = (sheet: ExcelJS.Worksheet | undefined) => {
  const out: CellValue[][] = []
  sheet?.eachRow((row, n) => {
    if (n === 1) return
    out.push(Array.from({ length: 12 }, (_, i) => row.getCell(i + 1).value))
  })
  return out
}

export interface ImportResult {
  data: FinanceData
  counts: { transactions: number; debts: number; investments: number }
}

export const parseWorkbook = async (buffer: ArrayBuffer): Promise<ImportResult> => {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const sheetNamed = (name: string) =>
    wb.worksheets.find((s) => s.name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() === name)

  const payment = invert(PAYMENT_METHOD_LABELS)
  const debtKinds = invert(DEBT_KIND_LABELS)
  const invKinds = invert(INVESTMENT_KIND_LABELS)

  const transactions: Transaction[] = []
  for (const r of rowsOf(sheetNamed('lancamentos'))) {
    const date = asIsoDate(r[0])
    const amount = asNumber(r[4])
    if (!date || !(amount > 0)) continue
    const typeText = asText(r[3]).toLowerCase()
    transactions.push({
      id: newId(),
      date,
      description: asText(r[1]) || 'Sem descrição',
      category: asText(r[2]) || 'Outros gastos',
      type: typeText.startsWith('ganho') || typeText.startsWith('receita') ? 'income' : 'expense',
      amount: Math.abs(amount),
      paymentMethod: (payment[asText(r[5]).toLowerCase()] ?? 'pix') as PaymentMethod,
    })
  }

  const debts: Debt[] = []
  for (const r of rowsOf(sheetNamed('dividas'))) {
    const creditor = asText(r[0])
    if (!creditor) continue
    debts.push({
      id: newId(),
      creditor,
      kind: (debtKinds[asText(r[1]).toLowerCase()] ?? 'other') as DebtKind,
      balance: asNumber(r[2]),
      monthlyRate: asNumber(r[3]),
      minimumPayment: asNumber(r[5]),
      dueDay: Math.min(31, Math.max(1, asNumber(r[6]) || 1)),
      overdue: asText(r[7]).toLowerCase().startsWith('s'),
      notes: asText(r[9]),
    })
  }

  const investments: Investment[] = []
  for (const r of rowsOf(sheetNamed('investimentos'))) {
    const name = asText(r[0])
    if (!name) continue
    investments.push({
      id: newId(),
      name,
      kind: (invKinds[asText(r[1]).toLowerCase()] ?? 'other') as InvestmentKind,
      status: asText(r[2]).toLowerCase().startsWith('plan') ? 'planned' : 'active',
      invested: asNumber(r[3]),
      currentValue: asNumber(r[4]),
      monthlyContribution: asNumber(r[6]),
      target: asNumber(r[7]),
      expectedYearlyReturn: asNumber(r[9]),
      startDate: asIsoDate(r[10]) || todayIso(),
      notes: asText(r[11]),
    })
  }

  return {
    data: { version: 1, transactions, debts, investments },
    counts: { transactions: transactions.length, debts: debts.length, investments: investments.length },
  }
}
