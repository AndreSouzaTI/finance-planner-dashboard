import { useRef, useState, type ChangeEvent } from 'react'
import type { FinanceData } from '../types'
import { useFinance } from '../state/FinanceContext'
import { emptyData, isFinanceData } from '../lib/storage'
import { buildSampleData } from '../lib/sampleData'
import { todayIso } from '../lib/format'
import { Card } from '../components/ui'

type Status = { tone: 'positive' | 'negative'; text: string } | null

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const merge = (current: FinanceData, incoming: FinanceData): FinanceData => ({
  version: 1,
  transactions: [...current.transactions, ...incoming.transactions],
  debts: [...current.debts, ...incoming.debts],
  investments: [...current.investments, ...incoming.investments],
})

export function DataPage({ month }: { month: string }) {
  const { data, replaceAll, reset } = useFinance()
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const excelInput = useRef<HTMLInputElement>(null)
  const jsonInput = useRef<HTMLInputElement>(null)

  const run = async (task: () => Promise<string>) => {
    setBusy(true)
    try {
      setStatus({ tone: 'positive', text: await task() })
    } catch (e) {
      setStatus({ tone: 'negative', text: e instanceof Error ? e.message : 'Algo deu errado.' })
    } finally {
      setBusy(false)
    }
  }

  const exportExcel = (source: FinanceData, filename: string) =>
    run(async () => {
      const { exportWorkbook } = await import('../lib/excel')
      download(await exportWorkbook(source, month), filename)
      return `Planilha "${filename}" gerada.`
    })

  const importExcel = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    run(async () => {
      const { parseWorkbook } = await import('../lib/excel')
      const { data: incoming, counts } = await parseWorkbook(await file.arrayBuffer())
      replaceAll(mode === 'merge' ? merge(data, incoming) : incoming)
      return `Importado: ${counts.transactions} lançamentos, ${counts.debts} dívidas e ${counts.investments} investimentos.`
    })
  }

  const exportJson = () => {
    download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `backup-financas-${todayIso()}.json`)
    setStatus({ tone: 'positive', text: 'Backup JSON gerado.' })
  }

  const importJson = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    run(async () => {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isFinanceData(parsed)) throw new Error('Arquivo de backup inválido.')
      replaceAll(parsed)
      return 'Backup restaurado.'
    })
  }

  const counts = `${data.transactions.length} lançamentos · ${data.debts.length} dívidas · ${data.investments.length} investimentos`

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Planilha e dados</h2>
          <p>Seus dados ficam só neste navegador. Exporte para Excel ou faça backup quando quiser.</p>
        </div>
        <span className="badge badge-info">{counts}</span>
      </div>

      {status && (
        <div className={`insight ${status.tone === 'positive' ? 'insight-success' : 'insight-danger'}`} role="status">
          <strong>{status.text}</strong>
        </div>
      )}

      <div className="grid grid-2">
        <Card title="Exportar para Excel">
          <p className="muted small" style={{ marginTop: 0 }}>
            Gera uma planilha automatizada com abas de Resumo (fórmulas por mês e categoria, últimos 12 meses), Lançamentos, Dívidas e
            Investimentos, com listas suspensas e cálculos prontos. Funciona sozinha no Excel, LibreOffice ou Google Planilhas.
          </p>
          <div className="btn-row">
            <button className="btn btn-primary" disabled={busy} onClick={() => exportExcel(data, `financas-${todayIso()}.xlsx`)}>
              Exportar meus dados
            </button>
            <button className="btn" disabled={busy} onClick={() => exportExcel(emptyData(), 'planilha-financeira-modelo.xlsx')}>
              Baixar modelo em branco
            </button>
          </div>
        </Card>

        <Card title="Importar planilha">
          <p className="muted small" style={{ marginTop: 0 }}>
            Use uma planilha exportada por aqui (ou o modelo preenchido à mão). As abas Lançamentos, Dívidas e Investimentos são lidas.
          </p>
          <div className="btn-row" style={{ alignItems: 'center' }}>
            <div className="segmented">
              <button aria-pressed={mode === 'merge'} onClick={() => setMode('merge')}>
                Adicionar aos dados
              </button>
              <button aria-pressed={mode === 'replace'} onClick={() => setMode('replace')}>
                Substituir tudo
              </button>
            </div>
            <button className="btn btn-primary" disabled={busy} onClick={() => excelInput.current?.click()}>
              Escolher arquivo .xlsx
            </button>
            <input ref={excelInput} type="file" accept=".xlsx" hidden onChange={importExcel} />
          </div>
        </Card>

        <Card title="Backup">
          <p className="muted small" style={{ marginTop: 0 }}>
            Cópia completa em JSON para guardar ou levar para outro computador.
          </p>
          <div className="btn-row">
            <button className="btn" onClick={exportJson}>
              Baixar backup
            </button>
            <button className="btn" onClick={() => jsonInput.current?.click()}>
              Restaurar backup
            </button>
            <input ref={jsonInput} type="file" accept="application/json,.json" hidden onChange={importJson} />
          </div>
        </Card>

        <Card title="Demonstração e limpeza">
          <p className="muted small" style={{ marginTop: 0 }}>
            Carregue dados fictícios para conhecer o painel, ou apague tudo para começar do zero.
          </p>
          <div className="btn-row">
            <button
              className="btn"
              onClick={() => {
                if (confirm('Substituir os dados atuais pelos dados de exemplo?')) {
                  replaceAll(buildSampleData())
                  setStatus({ tone: 'positive', text: 'Dados de exemplo carregados.' })
                }
              }}
            >
              Carregar exemplo
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm('Apagar todos os dados deste navegador? Faça um backup antes, se precisar.')) {
                  reset()
                  setStatus({ tone: 'positive', text: 'Todos os dados foram apagados.' })
                }
              }}
            >
              Apagar tudo
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
