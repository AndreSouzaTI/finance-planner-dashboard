import { useState } from 'react'
import './App.css'
import { FinanceProvider } from './state/FinanceContext'
import { todayIso } from './lib/format'
import { DataPage } from './pages/DataPage'
import { DashboardPage } from './pages/DashboardPage'
import { DebtsPage } from './pages/DebtsPage'
import { InvestmentsPage } from './pages/InvestmentsPage'
import { TransactionsPage } from './pages/TransactionsPage'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'transactions', label: 'Lançamentos' },
  { id: 'debts', label: 'Dívidas' },
  { id: 'investments', label: 'Investimentos' },
  { id: 'data', label: 'Planilha e dados' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard')
  const [month, setMonth] = useState(() => todayIso().slice(0, 7))

  return (
    <FinanceProvider>
      <div className="app">
        <header className="header">
          <div className="brand">
            <div className="brand-logo" aria-hidden>
              R$
            </div>
            <div>
              <h1>Finance Planner</h1>
              <p>Orçamento, dívidas e investimentos em um só lugar</p>
            </div>
          </div>
        </header>

        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} className="tab" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>

        <main>
          {tab === 'dashboard' && <DashboardPage month={month} onMonthChange={setMonth} />}
          {tab === 'transactions' && <TransactionsPage month={month} onMonthChange={setMonth} />}
          {tab === 'debts' && <DebtsPage />}
          {tab === 'investments' && <InvestmentsPage />}
          {tab === 'data' && <DataPage month={month} />}
        </main>
      </div>
    </FinanceProvider>
  )
}
