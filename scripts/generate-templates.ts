import { mkdirSync } from 'node:fs'
import { buildWorkbook } from '../src/lib/excel'
import { emptyData } from '../src/lib/storage'
import { buildSampleData } from '../src/lib/sampleData'

mkdirSync('templates', { recursive: true })

await buildWorkbook(emptyData()).xlsx.writeFile('templates/planilha-financeira-modelo.xlsx')
await buildWorkbook(buildSampleData()).xlsx.writeFile('templates/planilha-financeira-exemplo.xlsx')

console.log('Planilhas geradas em templates/')
