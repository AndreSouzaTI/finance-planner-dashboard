import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useFinance } from '../state/FinanceContext'
import {
  buildInsights,
  dailySeries,
  expensesByCategory,
  monthlyTrend,
  summarize,
  summarizeDebts,
  summarizePortfolio,
  topExpenses,
  transactionsInMonth,
} from '../lib/finance'
import { formatCompactCurrency, formatCurrency, formatDate, formatMonthShort, formatPercent } from '../lib/format'
import { BALANCE_COLOR, colorAt, EXPENSE_COLOR, INCOME_COLOR, ANIMATE_CHARTS } from '../lib/palette'
import { buildSampleData } from '../lib/sampleData'
import { Card, Empty, Kpi, MonthPicker } from '../components/ui'

const tooltipStyle = {
  contentStyle: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
  },
  labelStyle: { color: 'var(--muted)' },
}

const axisProps = {
  stroke: 'var(--muted)',
  tick: { fill: 'var(--muted)', fontSize: 12 },
  tickLine: false,
  axisLine: false,
}

const money = (v: unknown) => formatCurrency(Number(v))

export function DashboardPage({ month, onMonthChange }: { month: string; onMonthChange: (m: string) => void }) {
  const { data, replaceAll } = useFinance()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const monthItems = useMemo(() => transactionsInMonth(data.transactions, month), [data.transactions, month])
  const summary = useMemo(() => summarize(monthItems), [monthItems])
  const categories = useMemo(() => expensesByCategory(monthItems), [monthItems])
  const daily = useMemo(() => dailySeries(data.transactions, month), [data.transactions, month])
  const trend = useMemo(() => monthlyTrend(data.transactions, month, 6), [data.transactions, month])
  const debts = useMemo(() => summarizeDebts(data.debts), [data.debts])
  const portfolio = useMemo(() => summarizePortfolio(data.investments), [data.investments])
  const insights = useMemo(() => buildInsights(summary, categories, data.debts), [summary, categories, data.debts])

  const biggest = useMemo(
    () => topExpenses(selectedCategory ? monthItems.filter((t) => t.category === selectedCategory) : monthItems, 6),
    [monthItems, selectedCategory],
  )

  const isEmpty = data.transactions.length === 0 && data.debts.length === 0 && data.investments.length === 0

  if (isEmpty) {
    return (
      <div className="page">
        <section className="card welcome">
          <h2>Bem-vindo ao seu planejador financeiro</h2>
          <p>
            Registre ganhos e gastos do dia a dia, organize suas dívidas e planeje investimentos. Os dados ficam salvos
            apenas neste navegador e podem ser exportados para uma planilha Excel a qualquer momento.
          </p>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={() => replaceAll(buildSampleData())}>
              Carregar dados de exemplo
            </button>
          </div>
          <p className="small">Ou comece pela aba Lançamentos.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Visão geral</h2>
          <p>Como está o seu dinheiro neste mês.</p>
        </div>
        <MonthPicker month={month} onChange={onMonthChange} />
      </div>

      <div className="grid grid-kpi">
        <Kpi label="Ganhos do mês" value={formatCurrency(summary.income)} tone="positive" />
        <Kpi label="Gastos do mês" value={formatCurrency(summary.expense)} tone="negative" />
        <Kpi
          label="Saldo do mês"
          value={formatCurrency(summary.balance)}
          tone={summary.balance >= 0 ? 'positive' : 'negative'}
          hint={summary.income > 0 ? `${formatPercent(summary.savingsRate)} da renda` : undefined}
        />
        <Kpi
          label="Gastos essenciais"
          value={formatCurrency(summary.essentialExpense)}
          hint={summary.income > 0 ? `${formatPercent(summary.essentialExpense / summary.income)} da renda` : undefined}
        />
        <Kpi
          label="Dívidas em aberto"
          value={formatCurrency(debts.totalBalance)}
          tone={debts.totalBalance > 0 ? 'negative' : undefined}
          hint={debts.monthlyInterest > 0 ? `≈ ${formatCurrency(debts.monthlyInterest)} de juros/mês` : undefined}
        />
        <Kpi
          label="Investido"
          value={formatCurrency(portfolio.currentValue)}
          hint={portfolio.plannedCount > 0 ? `${portfolio.plannedCount} plano(s) futuro(s)` : undefined}
        />
      </div>

      {insights.length > 0 && (
        <Card title="O que os números dizem">
          <div className="insights">
            {insights.map((i) => (
              <div key={i.title} className={`insight insight-${i.level}`}>
                <strong>{i.title}</strong>
                <p>{i.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-2">
        <Card title="Dia a dia" aside="gastos por dia e saldo acumulado">
          <div className="chart">
            <ResponsiveContainer>
              <ComposedChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" {...axisProps} interval={4} />
                <YAxis {...axisProps} tickFormatter={formatCompactCurrency} width={70} />
                <Tooltip {...tooltipStyle} formatter={money} labelFormatter={(d) => `Dia ${d}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar isAnimationActive={ANIMATE_CHARTS} dataKey="expense" name="Gastos" fill={EXPENSE_COLOR} radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Line isAnimationActive={ANIMATE_CHARTS} dataKey="cumulative" name="Saldo acumulado" stroke={BALANCE_COLOR} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Para onde vai o dinheiro" aside="clique numa fatia para filtrar">
          {categories.length === 0 ? (
            <Empty>Sem gastos neste mês.</Empty>
          ) : (
            <div className="chart">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    isAnimationActive={ANIMATE_CHARTS}
                    data={categories}
                    dataKey="total"
                    nameKey="category"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={categories.length > 1 ? 1.5 : 0}
                    onClick={(entry: { category?: string }) =>
                      setSelectedCategory((cur) => (cur === entry.category ? null : (entry.category ?? null)))
                    }
                    cursor="pointer"
                  >
                    {categories.map((c, i) => (
                      <Cell
                        key={c.category}
                        fill={colorAt(i)}
                        stroke="var(--surface)"
                        opacity={selectedCategory && selectedCategory !== c.category ? 0.35 : 1}
                      />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={money} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card
          title={selectedCategory ? `Maiores gastos · ${selectedCategory}` : 'Maiores gastos do mês'}
          aside={
            selectedCategory ? (
              <button className="btn btn-sm" onClick={() => setSelectedCategory(null)}>
                Limpar filtro
              </button>
            ) : undefined
          }
        >
          {biggest.length === 0 ? (
            <Empty>Sem gastos para mostrar.</Empty>
          ) : (
            <ul className="rank">
              {biggest.map((t) => (
                <li key={t.id}>
                  <div className="rank-row">
                    <span>
                      {t.description} <span className="muted small">· {formatDate(t.date)}</span>
                    </span>
                    <strong className="tabular">{formatCurrency(t.amount)}</strong>
                  </div>
                  <div className="bar">
                    <div
                      style={{
                        width: `${(t.amount / biggest[0].amount) * 100}%`,
                        background: colorAt(Math.max(0, categories.findIndex((c) => c.category === t.category))),
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Gastos por categoria">
          {categories.length === 0 ? (
            <Empty>Sem gastos neste mês.</Empty>
          ) : (
            <ul className="rank">
              {categories.map((c, i) => (
                <li key={c.category}>
                  <div className="rank-row">
                    <span>{c.category}</span>
                    <span className="tabular">
                      {formatCurrency(c.total)} <span className="muted small">({formatPercent(c.share)})</span>
                    </span>
                  </div>
                  <div className="bar">
                    <div style={{ width: `${c.share * 100}%`, background: colorAt(i) }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Últimos 6 meses" aside="clique numa barra para abrir o mês">
        <div className="chart">
          <ResponsiveContainer>
            <BarChart
              data={trend}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              onClick={(state) => {
                const label = state?.activeLabel
                if (typeof label === 'string') onMonthChange(label)
              }}
            >
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" {...axisProps} tickFormatter={formatMonthShort} />
              <YAxis {...axisProps} tickFormatter={formatCompactCurrency} width={70} />
              <Tooltip {...tooltipStyle} formatter={money} labelFormatter={(m) => formatMonthShort(String(m))} cursor={{ fill: 'var(--surface-2)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar isAnimationActive={ANIMATE_CHARTS} dataKey="income" name="Ganhos" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} cursor="pointer" />
              <Bar isAnimationActive={ANIMATE_CHARTS} dataKey="expense" name="Gastos" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
