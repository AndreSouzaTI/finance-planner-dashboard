import { useMemo, useState, type FormEvent } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Debt, DebtKind } from '../types'
import { useFinance } from '../state/FinanceContext'
import { DEBT_KIND_LABELS } from '../lib/labels'
import { formatCompactCurrency, formatCurrency, newId, parseAmount } from '../lib/format'
import { monthlyToYearly, summarizeDebts } from '../lib/finance'
import { simulatePayoff, type PayoffResult } from '../lib/debtPlanner'
import { BALANCE_COLOR, EXPENSE_COLOR } from '../lib/palette'
import { Card, Empty, Field, Kpi } from '../components/ui'

interface Draft {
  id?: string
  creditor: string
  kind: DebtKind
  balance: string
  monthlyRate: string
  minimumPayment: string
  dueDay: string
  overdue: boolean
  notes: string
}

const blankDraft = (): Draft => ({
  creditor: '',
  kind: 'credit_card',
  balance: '',
  monthlyRate: '',
  minimumPayment: '',
  dueDay: '10',
  overdue: false,
  notes: '',
})

const toDraft = (d: Debt): Draft => ({
  ...d,
  balance: String(d.balance).replace('.', ','),
  monthlyRate: String(d.monthlyRate).replace('.', ','),
  minimumPayment: String(d.minimumPayment).replace('.', ','),
  dueDay: String(d.dueDay),
})

const describe = (r: PayoffResult) =>
  r.neverPaysOff ? 'O valor não cobre os juros — nunca quita' : `${r.months} meses · ${formatCurrency(r.totalInterest)} de juros`

export function DebtsPage() {
  const { data, upsert, remove } = useFinance()
  const [draft, setDraft] = useState<Draft>(blankDraft)
  const [error, setError] = useState('')
  const summary = summarizeDebts(data.debts)
  const [budgetInput, setBudgetInput] = useState('')

  const budget = parseAmount(budgetInput)
  const effectiveBudget = Number.isFinite(budget) && budget > 0 ? budget : Math.max(summary.totalMinimum, 1)

  const plans = useMemo(() => {
    if (data.debts.length === 0) return null
    return {
      avalanche: simulatePayoff(data.debts, effectiveBudget, 'avalanche'),
      snowball: simulatePayoff(data.debts, effectiveBudget, 'snowball'),
    }
  }, [data.debts, effectiveBudget])

  const chartData = useMemo(() => {
    if (!plans) return []
    const length = Math.min(Math.max(plans.avalanche.timeline.length, plans.snowball.timeline.length), 120)
    return Array.from({ length }, (_, i) => ({
      month: i + 1,
      avalanche: plans.avalanche.timeline[i]?.balance ?? 0,
      snowball: plans.snowball.timeline[i]?.balance ?? 0,
    }))
  }, [plans])

  const sorted = [...data.debts].sort((a, b) => b.monthlyRate - a.monthlyRate)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const balance = parseAmount(draft.balance)
    const monthlyRate = parseAmount(draft.monthlyRate || '0')
    const minimumPayment = parseAmount(draft.minimumPayment || '0')
    if (!draft.creditor.trim()) return setError('Informe o credor.')
    if (!(balance > 0)) return setError('Informe o saldo devedor.')
    if (!(monthlyRate >= 0) || !(minimumPayment >= 0)) return setError('Confira juros e parcela.')
    upsert('debts', {
      id: draft.id ?? newId(),
      creditor: draft.creditor.trim(),
      kind: draft.kind,
      balance,
      monthlyRate,
      minimumPayment,
      dueDay: Math.min(31, Math.max(1, Number(draft.dueDay) || 1)),
      overdue: draft.overdue,
      notes: draft.notes.trim(),
    })
    setError('')
    setDraft(blankDraft())
  }

  const savings = plans ? plans.snowball.totalInterest - plans.avalanche.totalInterest : 0

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Dívidas</h2>
          <p>Saiba quanto deve, quanto pagam de juros e a melhor ordem para quitar.</p>
        </div>
      </div>

      <div className="grid grid-kpi">
        <Kpi label="Total devido" value={formatCurrency(summary.totalBalance)} tone={summary.totalBalance > 0 ? 'negative' : undefined} />
        <Kpi label="Parcelas mínimas / mês" value={formatCurrency(summary.totalMinimum)} />
        <Kpi
          label="Juros gerados por mês"
          value={formatCurrency(summary.monthlyInterest)}
          hint={summary.totalBalance > 0 ? `taxa média ${summary.weightedRate.toFixed(1).replace('.', ',')}% a.m.` : undefined}
          tone={summary.monthlyInterest > 0 ? 'negative' : undefined}
        />
        <Kpi label="Em atraso" value={String(summary.overdueCount)} />
      </div>

      <Card title={draft.id ? 'Editar dívida' : 'Nova dívida'}>
        <form className="form" onSubmit={submit}>
          <Field label="Credor">
            <input value={draft.creditor} placeholder="Ex.: Cartão Banco X" onChange={(e) => setDraft({ ...draft, creditor: e.target.value })} />
          </Field>
          <Field label="Tipo">
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as DebtKind })}>
              {Object.entries(DEBT_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Saldo devedor (R$)">
            <input inputMode="decimal" value={draft.balance} placeholder="0,00" onChange={(e) => setDraft({ ...draft, balance: e.target.value })} />
          </Field>
          <Field label="Juros ao mês (%)">
            <input inputMode="decimal" value={draft.monthlyRate} placeholder="Ex.: 12,5" onChange={(e) => setDraft({ ...draft, monthlyRate: e.target.value })} />
          </Field>
          <Field label="Parcela mensal (R$)">
            <input inputMode="decimal" value={draft.minimumPayment} placeholder="0,00" onChange={(e) => setDraft({ ...draft, minimumPayment: e.target.value })} />
          </Field>
          <Field label="Dia do vencimento">
            <input type="number" min={1} max={31} value={draft.dueDay} onChange={(e) => setDraft({ ...draft, dueDay: e.target.value })} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={draft.overdue} onChange={(e) => setDraft({ ...draft, overdue: e.target.checked })} />
            Está em atraso
          </label>
          <Field label="Observações" wide>
            <input value={draft.notes} placeholder="Ex.: proposta de acordo, contato do credor" onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
          <div className="btn-row">
            <button className="btn btn-primary" type="submit">
              {draft.id ? 'Salvar' : 'Adicionar'}
            </button>
            {draft.id && (
              <button className="btn" type="button" onClick={() => setDraft(blankDraft())}>
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

      <Card title="Suas dívidas" aside="ordenadas pelos juros mais altos">
        {sorted.length === 0 ? (
          <Empty>Nenhuma dívida cadastrada. 🎉</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Credor</th>
                  <th>Tipo</th>
                  <th className="num">Saldo</th>
                  <th className="num">Juros a.m.</th>
                  <th className="num">Juros a.a.</th>
                  <th className="num">Parcela</th>
                  <th>Venc.</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => (
                  <tr key={d.id}>
                    <td>
                      {d.creditor}
                      {d.notes && <div className="muted small">{d.notes}</div>}
                    </td>
                    <td className="muted">{DEBT_KIND_LABELS[d.kind]}</td>
                    <td className="num">{formatCurrency(d.balance)}</td>
                    <td className="num">{d.monthlyRate.toLocaleString('pt-BR')}%</td>
                    <td className="num muted">{Math.round(monthlyToYearly(d.monthlyRate)).toLocaleString('pt-BR')}%</td>
                    <td className="num">{formatCurrency(d.minimumPayment)}</td>
                    <td className="tabular">dia {d.dueDay}</td>
                    <td>
                      <span className={`badge ${d.overdue ? 'badge-danger' : 'badge-success'}`}>{d.overdue ? 'Atrasada' : 'Em dia'}</span>
                    </td>
                    <td className="num">
                      <button className="btn btn-sm" onClick={() => setDraft(toDraft(d))}>
                        Editar
                      </button>{' '}
                      <button className="btn btn-sm btn-danger" onClick={() => remove('debts', d.id)}>
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

      {plans && (
        <Card title="Simulador de quitação" aside="avalanche × bola de neve">
          <div className="form" style={{ marginBottom: 16 }}>
            <Field label="Quanto consigo pagar por mês, no total (R$)">
              <input
                inputMode="decimal"
                value={budgetInput}
                placeholder={formatCurrency(summary.totalMinimum)}
                onChange={(e) => setBudgetInput(e.target.value)}
              />
            </Field>
            <p className="muted small" style={{ margin: 0 }}>
              Todas as dívidas recebem a parcela mínima e o que sobrar vai para a prioritária.
            </p>
          </div>

          <div className="grid grid-2" style={{ marginBottom: 16 }}>
            <div className="insight insight-info">
              <strong>Avalanche (juros mais altos primeiro)</strong>
              <p>{describe(plans.avalanche)}</p>
              <p className="small">Ordem: {plans.avalanche.payoffOrder.map((p) => p.creditor).join(' → ') || '—'}</p>
            </div>
            <div className="insight insight-warning">
              <strong>Bola de neve (menor saldo primeiro)</strong>
              <p>{describe(plans.snowball)}</p>
              <p className="small">Ordem: {plans.snowball.payoffOrder.map((p) => p.creditor).join(' → ') || '—'}</p>
            </div>
          </div>

          {!plans.avalanche.neverPaysOff && savings > 1 && (
            <p className="small" style={{ marginTop: 0 }}>
              A avalanche economiza <strong>{formatCurrency(savings)}</strong> em juros. A bola de neve dá vitórias mais rápidas — escolha a que
              você vai conseguir manter.
            </p>
          )}

          <div className="chart">
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted)" tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted)" tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={formatCompactCurrency} width={70} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                  formatter={(v) => formatCurrency(Number(v))}
                  labelFormatter={(m) => `Mês ${m}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="avalanche" name="Avalanche" stroke={BALANCE_COLOR} strokeWidth={2} dot={false} />
                <Line dataKey="snowball" name="Bola de neve" stroke={EXPENSE_COLOR} strokeWidth={2} dot={false} strokeDasharray="5 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  )
}
