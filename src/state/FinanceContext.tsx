import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { Debt, FinanceData, Investment, Transaction } from '../types'
import { emptyData, loadData, saveData } from '../lib/storage'
import { buildSampleData } from '../lib/sampleData'

type Collection = 'transactions' | 'debts' | 'investments'
type ItemOf<C extends Collection> = FinanceData[C][number]

type Action =
  | { type: 'upsert'; collection: Collection; item: Transaction | Debt | Investment }
  | { type: 'remove'; collection: Collection; id: string }
  | { type: 'replace'; data: FinanceData }

const reducer = (state: FinanceData, action: Action): FinanceData => {
  switch (action.type) {
    case 'upsert': {
      const list = state[action.collection] as { id: string }[]
      const exists = list.some((i) => i.id === action.item.id)
      const next = exists
        ? list.map((i) => (i.id === action.item.id ? action.item : i))
        : [...list, action.item]
      return { ...state, [action.collection]: next }
    }
    case 'remove': {
      const list = state[action.collection] as { id: string }[]
      return { ...state, [action.collection]: list.filter((i) => i.id !== action.id) }
    }
    case 'replace':
      return action.data
  }
}

interface FinanceContextValue {
  data: FinanceData
  upsert: <C extends Collection>(collection: C, item: ItemOf<C>) => void
  remove: (collection: Collection, id: string) => void
  replaceAll: (data: FinanceData) => void
  reset: () => void
}

/** `?demo` in the URL opens the app with sample data (used by the live demo link). */
const initialData = (): FinanceData => {
  const stored = loadData()
  const wantsDemo = new URLSearchParams(window.location.search).has('demo')
  const isEmpty = stored.transactions.length + stored.debts.length + stored.investments.length === 0
  return wantsDemo && isEmpty ? buildSampleData() : stored
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, initialData)

  useEffect(() => saveData(data), [data])

  const value = useMemo<FinanceContextValue>(
    () => ({
      data,
      upsert: (collection, item) => dispatch({ type: 'upsert', collection, item }),
      remove: (collection, id) => dispatch({ type: 'remove', collection, id }),
      replaceAll: (next) => dispatch({ type: 'replace', data: next }),
      reset: () => dispatch({ type: 'replace', data: emptyData() }),
    }),
    [data],
  )

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance must be used inside <FinanceProvider>')
  return ctx
}
