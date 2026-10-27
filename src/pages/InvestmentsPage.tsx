import { useMemo, useState, type FormEvent } from 'react'
import { Area, AreaChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Investment, InvestmentKind, InvestmentStatus } from '../types'
import { useFinance } from '../state/FinanceContext'
import { INVESTMENT_KIND_LABELS } from '../lib/labels'
import { formatCompactCurrency, formatCurrency, formatDate, formatPercent, newId, parseAmount, todayIso } from '../lib/format'
import { projectGrowth, summarizePortfolio } from '../lib/finance'
import { BALANCE_COLOR, colorAt, INCOME_COLOR, ANIMATE_CHARTS } from '../lib/palette'
import { Card, Empty, Field, Kpi } from '../components/ui'

interface Draft {
  id?: string
  name: string
  kind: InvestmentKind
  status: InvestmentStatus
  invested: string
  currentValue: string
  monthlyContribution: string
  target: string
  expectedYearlyReturn: string
  startDate: string
  notes: string
}

const blankDraft = (status: InvestmentStatus = 'planned'): Draft => ({
  name: '',
  kind: 'emergency',
  status,
  invested: '',
  currentValue: '',
  monthlyContribution: '',
  target: '',
  expectedYearlyReturn: '10',
  startDate: todayIso(),
  notes: '',
})

const num = (v: number) => (v ? String(v).replace('.', ',') : '')

const toDraft = (i: Investment): Draft => ({
  ...i,
  invested: num(i.invested),
  currentValue: num(i.currentValue),
  monthlyContribution: num(i.monthlyContribution),
  target: num(i.target),
  expectedYearlyReturn: num(i.expectedYearlyReturn),
})

const HORIZONS = [5, 10, 20, 30]

export function InvestmentsPage() {
  const { data, upsert, remove } = useFinance()
  const [draft, setDraft] = useState<Draft>(() => blankDraft())
  const [error, setError] = useState('')
  const [years, setYears] = useState(10)
  const summary = summarizePortfolio(data.investments)

  const active = data.investments.filter((i) => i.status === 'active')
  const planned = data.investments.filter((i) => i.status === 'planned')

  const allocation = useMemo(() => {
    const totals = new Map<InvestmentKind, number>()
    for (const i of active) totals.set(i.kind, (totals.get(i.kind) ?? 0) + i.currentValue)
    return [...totals.entries()]
      .map(([kind, value]) => ({ name: INVESTMENT_KIND_LABELS[kind], value }))
      .filter((a) => a.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [active])

  const projection = useMemo(() => {
    const all = data.investments
    const contribution = all.reduce((s, i) => s + i.monthlyContribution, 0)
    const weight = all.reduce((s, i) => s + i.monthlyContribution + i.currentValue, 0)
    const rate = weight > 0 ? all.reduce((s, i) => s + i.expectedYearlyReturn * (i.monthlyContribution + i.currentValue), 0) / weight : 0
    return { rate, contribution, points: projectGrowth(summary.currentValue, contribution, rate, years) }
  }, [data.investments, summary.currentValue, years])

  const final = projection.points[projection.points.length - 1]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const values = {
      invested: parseAmount(draft.invested || '0'),
      currentValue: parseAmount(draft.currentValue || draft.invested || '0'),
      monthlyContribution: parseAmount(draft.monthlyContribution || '0'),
      target: parseAmount(draft.target || '0'),
      expectedYearlyReturn: parseAmount(draft.expectedYearlyReturn || '0'),
    }
    if (!draft.name.trim()) return setError('Dê um nome ao investimento ou plano.')
    if (Object.values(values).some((v) => !(v >= 0))) return setError('Confira os valores informados.')
    const planned = draft.status === 'planned'
    upsert('investments', {
      id: draft.id ?? newId(),
      name: draft.name.trim(),
      kind: draft.kind,
      status: draft.status,
      ...values,
      invested: planned ? 0 : values.invested,
      currentValue: planned ? 0 : values.currentValue,
      startDate: draft.startDate,
      notes: draft.notes.trim(),
    })
    setError('')
    setDraft(blankDraft(draft.status))
  }

  const renderTable = (items: Investment[], isPlanned: boolean) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            {!isPlanned && <th className="num">Aplicado</th>}
            {!isPlanned && <th className="num">Valor atual</th>}
            <th className="num">Aporte/mês</th>
            <th className="num">Meta</th>
            <th>Progresso</th>
            <th>{isPlanned ? 'Início previsto' : 'Desde'}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const progress = i.target > 0 ? Math.min(1, i.currentValue / i.target) : 0
            return (
              <tr key={i.id}>
                <td>
                  {i.name}
                  {i.notes && <div className="muted small">{i.notes}</div>}
                </td>
                <td className="muted">{INVESTMENT_KIND_LABELS[i.kind]}</td>
                {!isPlanned && <td className="num">{formatCurrency(i.invested)}</td>}
                {!isPlanned && (
                  <td className={`num ${i.currentValue >= i.invested ? 'positive' : 'negative'}`}>{formatCurrency(i.currentValue)}</td>
                )}
                <td className="num">{formatCurrency(i.monthlyContribution)}</td>
                <td className="num">{i.target ? formatCurrency(i.target) : '—'}</td>
                <td style={{ minWidth: 120 }}>
                  {i.target > 0 ? (
                    <>
                      <div className="bar">
                        <div style={{ width: `${progress * 100}%`, background: INCOME_COLOR }} />
                      </div>
                      <span className="muted small">{formatPercent(progress)}</span>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="tabular">{formatDate(i.startDate)}</td>
                <td className="num">
                  <button className="btn btn-sm" onClick={() => setDraft(toDraft(i))}>
                    Editar
                  </button>{' '}
                  <button className="btn btn-sm btn-danger" onClick={() => remove('investments', i.id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Investimentos</h2>
          <p>Acompanhe o que já investe e planeje os próximos passos, de longo prazo.</p>
        </div>
      </div>

      <div className="grid grid-kpi">
        <Kpi label="Valor atual" value={formatCurrency(summary.currentValue)} />
        <Kpi label="Total aplicado" value={formatCurrency(summary.invested)} />
        <Kpi
          label="Rendimento"
          value={formatCurrency(summary.profit)}
          tone={summary.profit >= 0 ? 'positive' : 'negative'}
          hint={summary.invested > 0 ? formatPercent(summary.profit / summary.invested) : undefined}
        />
        <Kpi label="Aportes planejados / mês" value={formatCurrency(summary.monthlyContribution)} />
      </div>

      <Card title={draft.id ? 'Editar investimento' : 'Novo investimento ou plano'}>
        <form className="form" onSubmit={submit}>
          <div className="field">
            <span>Situação</span>
            <div className="segmented">
              <button type="button" aria-pressed={draft.status === 'active'} onClick={() => setDraft({ ...draft, status: 'active' })}>
                Já investido
              </button>
              <button type="button" aria-pressed={draft.status === 'planned'} onClick={() => setDraft({ ...draft, status: 'planned' })}>
                Plano futuro
              </button>
            </div>
          </div>
          <Field label="Nome">
            <input value={draft.name} placeholder="Ex.: Reserva de emergência" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Tipo">
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as InvestmentKind })}>
              {Object.entries(INVESTMENT_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          {draft.status === 'active' && (
            <>
              <Field label="Valor aplicado (R$)">
                <input inputMode="decimal" value={draft.invested} placeholder="0,00" onChange={(e) => setDraft({ ...draft, invested: e.target.value })} />
              </Field>
              <Field label="Valor atual (R$)">
                <input inputMode="decimal" value={draft.currentValue} placeholder="igual ao aplicado" onChange={(e) => setDraft({ ...draft, currentValue: e.target.value })} />
              </Field>
            </>
          )}
          <Field label="Aporte mensal (R$)">
            <input inputMode="decimal" value={draft.monthlyContribution} placeholder="0,00" onChange={(e) => setDraft({ ...draft, monthlyContribution: e.target.value })} />
          </Field>
          <Field label="Meta (R$)">
            <input inputMode="decimal" value={draft.target} placeholder="opcional" onChange={(e) => setDraft({ ...draft, target: e.target.value })} />
          </Field>
          <Field label="Rentabilidade esperada (% ao ano)">
            <input inputMode="decimal" value={draft.expectedYearlyReturn} onChange={(e) => setDraft({ ...draft, expectedYearlyReturn: e.target.value })} />
          </Field>
          <Field label={draft.status === 'planned' ? 'Início previsto' : 'Data de início'}>
            <input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
          </Field>
          <Field label="Observações" wide>
            <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
          <div className="btn-row">
            <button className="btn btn-primary" type="submit">
              {draft.id ? 'Salvar' : 'Adicionar'}
            </button>
            {draft.id && (
              <button className="btn" type="button" onClick={() => setDraft(blankDraft(draft.status))}>
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

      <div className="grid grid-2">
        <Card title="Projeção de longo prazo" aside={`${projection.rate.toFixed(1).replace('.', ',')}% a.a. estimado`}>
          <div className="segmented" style={{ marginBottom: 12 }}>
            {HORIZONS.map((h) => (
              <button key={h} aria-pressed={years === h} onClick={() => setYears(h)}>
                {h} anos
              </button>
            ))}
          </div>
          {projection.contribution === 0 && summary.currentValue === 0 ? (
            <Empty>Cadastre um investimento ou plano com aporte mensal para ver a projeção.</Empty>
          ) : (
            <>
              <p className="small" style={{ marginTop: 0 }}>
                Aportando {formatCurrency(projection.contribution)}/mês, em {years} anos você teria cerca de{' '}
                <strong>{formatCurrency(final.value)}</strong>, sendo {formatCurrency(final.contributed)} de aportes.
              </p>
              <div className="chart">
                <ResponsiveContainer>
                  <AreaChart data={projection.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="year" stroke="var(--muted)" tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(y) => `${y}a`} />
                    <YAxis stroke="var(--muted)" tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={formatCompactCurrency} width={70} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                      formatter={(v) => formatCurrency(Number(v))}
                      labelFormatter={(y) => `Ano ${y}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area isAnimationActive={ANIMATE_CHARTS} dataKey="value" name="Patrimônio" stroke={BALANCE_COLOR} fill={BALANCE_COLOR} fillOpacity={0.18} strokeWidth={2} />
                    <Area isAnimationActive={ANIMATE_CHARTS} dataKey="contributed" name="Aportes" stroke={INCOME_COLOR} fill={INCOME_COLOR} fillOpacity={0.12} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="muted small" style={{ marginBottom: 0 }}>
                Simulação nominal com juros compostos mensais. Rentabilidade passada ou estimada não garante resultado futuro.
              </p>
            </>
          )}
        </Card>

        <Card title="Distribuição da carteira">
          {allocation.length === 0 ? (
            <Empty>Nenhum investimento ativo ainda.</Empty>
          ) : (
            <div className="chart">
              <ResponsiveContainer>
                <PieChart>
                  <Pie isAnimationActive={ANIMATE_CHARTS} data={allocation} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={allocation.length > 1 ? 1.5 : 0}>
                    {allocation.map((a, i) => (
                      <Cell key={a.name} fill={colorAt(i)} stroke="var(--surface)" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} formatter={(v) => formatCurrency(Number(v))} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card title="Carteira atual" aside={`${active.length} posição(ões)`}>
        {active.length === 0 ? <Empty>Nada investido ainda — tudo bem, comece pela reserva de emergência.</Empty> : renderTable(active, false)}
      </Card>

      <Card title="Investimentos futuros" aside={`${planned.length} plano(s)`}>
        {planned.length === 0 ? <Empty>Anote aqui os investimentos que pretende fazer.</Empty> : renderTable(planned, true)}
      </Card>
    </div>
  )
}
