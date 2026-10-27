import { useMemo, useState, type FormEvent } from 'react'
import type { PaymentMethod, Transaction, TransactionType } from '../types'
import { useFinance } from '../state/FinanceContext'
import { categoriesFor, PAYMENT_METHOD_LABELS } from '../lib/labels'
import { formatCurrency, formatDate, newId, parseAmount, todayIso } from '../lib/format'
import { summarize, transactionsInMonth } from '../lib/finance'
import { Card, Empty, Field, MonthPicker } from '../components/ui'

interface Draft {
  id?: string
  date: string
  description: string
  amount: string
  type: TransactionType
  category: string
  paymentMethod: PaymentMethod
}

const blankDraft = (type: TransactionType = 'expense'): Draft => ({
  date: todayIso(),
  description: '',
  amount: '',
  type,
  category: categoriesFor(type)[0],
  paymentMethod: 'pix',
})

type Filter = 'all' | TransactionType

export function TransactionsPage({ month, onMonthChange }: { month: string; onMonthChange: (m: string) => void }) {
  const { data, upsert, remove } = useFinance()
  const [draft, setDraft] = useState<Draft>(blankDraft)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  const monthItems = useMemo(() => transactionsInMonth(data.transactions, month), [data.transactions, month])
  const summary = summarize(monthItems)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return monthItems
      .filter((t) => filter === 'all' || t.type === filter)
      .filter((t) => !q || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [monthItems, filter, query])

  const setType = (type: TransactionType) =>
    setDraft((d) => ({ ...d, type, category: categoriesFor(type)[0] }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const amount = parseAmount(draft.amount)
    if (!draft.description.trim()) return setError('Informe uma descrição.')
    if (!(amount > 0)) return setError('Informe um valor maior que zero.')
    const item: Transaction = {
      id: draft.id ?? newId(),
      date: draft.date,
      description: draft.description.trim(),
      amount: Math.round(amount * 100) / 100,
      type: draft.type,
      category: draft.category,
      paymentMethod: draft.paymentMethod,
    }
    upsert('transactions', item)
    setError('')
    setDraft({ ...blankDraft(draft.type), date: draft.date })
  }

  const edit = (t: Transaction) =>
    setDraft({ ...t, amount: String(t.amount).replace('.', ',') })

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Lançamentos</h2>
          <p>Anote tudo o que entra e sai, todos os dias.</p>
        </div>
        <MonthPicker month={month} onChange={onMonthChange} />
      </div>

      <Card title={draft.id ? 'Editar lançamento' : 'Novo lançamento'}>
        <form className="form" onSubmit={submit}>
          <div className="field">
            <span>Tipo</span>
            <div className="segmented">
              <button type="button" aria-pressed={draft.type === 'expense'} onClick={() => setType('expense')}>
                Gasto
              </button>
              <button type="button" aria-pressed={draft.type === 'income'} onClick={() => setType('income')}>
                Ganho
              </button>
            </div>
          </div>
          <Field label="Data">
            <input type="date" value={draft.date} required onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </Field>
          <Field label="Descrição">
            <input
              value={draft.description}
              placeholder={draft.type === 'income' ? 'Ex.: salário' : 'Ex.: mercado'}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </Field>
          <Field label="Valor (R$)">
            <input
              inputMode="decimal"
              value={draft.amount}
              placeholder="0,00"
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            />
          </Field>
          <Field label="Categoria">
            <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              {categoriesFor(draft.type).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Forma de pagamento">
            <select
              value={draft.paymentMethod}
              onChange={(e) => setDraft({ ...draft, paymentMethod: e.target.value as PaymentMethod })}
            >
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <div className="btn-row">
            <button className="btn btn-primary" type="submit">
              {draft.id ? 'Salvar' : 'Adicionar'}
            </button>
            {draft.id && (
              <button className="btn" type="button" onClick={() => setDraft(blankDraft(draft.type))}>
                Cancelar
              </button>
            )}
          </div>
          {error && (
            <p className="field-wide negative small" role="alert">
              {error}
            </p>
          )}
        </form>
      </Card>

      <Card
        title="Lançamentos do mês"
        aside={
          <>
            <span className="positive">{formatCurrency(summary.income)}</span> ·{' '}
            <span className="negative">{formatCurrency(summary.expense)}</span>
          </>
        }
      >
        <div className="btn-row" style={{ marginBottom: 12 }}>
          <div className="segmented">
            {(['all', 'expense', 'income'] as Filter[]).map((f) => (
              <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === 'all' ? 'Todos' : f === 'expense' ? 'Gastos' : 'Ganhos'}
              </button>
            ))}
          </div>
          <div className="field" style={{ flex: '1 1 200px' }}>
            <input placeholder="Buscar descrição ou categoria" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        {visible.length === 0 ? (
          <Empty>Nenhum lançamento encontrado neste mês.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Pagamento</th>
                  <th className="num">Valor</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id}>
                    <td className="tabular">{formatDate(t.date)}</td>
                    <td>{t.description}</td>
                    <td>
                      <span className="badge">{t.category}</span>
                    </td>
                    <td className="muted">{PAYMENT_METHOD_LABELS[t.paymentMethod]}</td>
                    <td className={`num ${t.type === 'income' ? 'positive' : 'negative'}`}>
                      {t.type === 'income' ? '+' : '−'} {formatCurrency(t.amount)}
                    </td>
                    <td className="num">
                      <button className="btn btn-sm" onClick={() => edit(t)}>
                        Editar
                      </button>{' '}
                      <button className="btn btn-sm btn-danger" onClick={() => remove('transactions', t.id)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
