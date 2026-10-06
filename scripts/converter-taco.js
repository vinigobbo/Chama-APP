const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const [csvPath, pdfPath] = process.argv.slice(2)
if (!csvPath || !pdfPath) {
  console.error('uso: node scripts/converter-taco.js <taco-db-nutrientes.csv> <taco.pdf>')
  process.exit(1)
}
function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function textoDoPdf(arquivo) {
  const bruto = fs.readFileSync(arquivo)
  const s = bruto.toString('latin1')
  const re = /stream\r?\n/g
  const paginas = []
  let m
  while ((m = re.exec(s))) {
    const inicio = m.index + m[0].length
    const fim = s.indexOf('endstream', inicio)
    if (fim < 0) break
    try {
      const conteudo = zlib.inflateSync(bruto.subarray(inicio, fim)).toString('latin1')
      const partes = conteudo.match(/\((?:\\.|[^\\)])*\)/g) || []
      paginas.push(partes.map(p => p.slice(1, -1).replace(/\\([()\\])/g, '$1')).join(''))
    } catch (e) {
    }
    re.lastIndex = fim
  }
  return paginas
}

function lerCsv(arquivo) {
  const linhas = fs.readFileSync(arquivo, 'utf8').split(/\r?\n/).filter(l => l.trim())
  return linhas.slice(1).map(linha => {
    const campos = []
    let atual = '', aspas = false
    for (const ch of linha) {
      if (ch === '"') aspas = !aspas
      else if (ch === ',' && !aspas) { campos.push(atual.trim()); atual = '' }
      else atual += ch
    }
    campos.push(atual.trim())
    return campos
  })
}

function converterValor(v) {
  if (v === 'Tr') return 0
  if (v === '' || v === 'NA' || v === '*') return null
  const n = Number(v)
  if (Number.isNaN(n)) throw new Error(`valor inesperado: "${v}"`)
  return n
}

const escapar = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const CORRECOES = {
  472: {
    esperado: c => c[2] === '1' && c[3] === '' && c[4] === '216' && c[5] === '902',
    valores: { kcal: 216, proteina: null, carboidrato: null, gordura: null, fibra: null },
    kj: 902,
  },
  474: {
    esperado: c => c[2] === '2' && c[3] === '92.4' && c[4] === '41' && c[5] === '170',
    valores: { kcal: 41, proteina: 0.6, carboidrato: 3.3, gordura: 0, fibra: null },
    kj: 170,
  },
}

const centesimal = textoDoPdf(pdfPath)
  .filter(p => p.includes('Tabela 1.') && p.includes('Umidade'))
  .join(' ')
  .replace(/\s+/g, ' ')

const linhas = lerCsv(csvPath)
const saida = []
const falhas = []
let cursor = 0
for (const c of linhas) {
  const id = Number(c[0])
  const valoresPdf = c.slice(2, 13).filter(v => v !== '').map(v => v.replace('.', ','))
  const re = new RegExp('(?:^| )' + id + ' (\\D.*?) ' + valoresPdf.map(escapar).join(' ') + '(?= |$)')
  const m = re.exec(centesimal.slice(cursor))
  if (!m || m[1].length > 120) {
    falhas.push(c.slice(0, 13).join(' ; '))
    continue
  }
  cursor += m.index + m[0].length
  const nome = m[1].trim()

  let valores = {
    kcal: converterValor(c[3]),
    proteina: converterValor(c[5]),
    carboidrato: converterValor(c[8]),
    gordura: converterValor(c[6]),
    fibra: converterValor(c[9]),
  }
  let kj = converterValor(c[4])
  const correcao = CORRECOES[id]
  if (correcao) {
    if (!correcao.esperado(c)) {
      falhas.push(`${id}: correção manual não se aplica mais, revisar: ${c.slice(0, 13).join(' ; ')}`)
      continue
    }
    valores = correcao.valores
    kj = correcao.kj
  }

  if (valores.kcal !== null && kj !== null && Math.abs(kj - valores.kcal * 4.184) > Math.max(3, valores.kcal * 0.03)) {
    falhas.push(`${id}: kcal ${valores.kcal} e kJ ${kj} não batem`)
    continue
  }
  if ((valores.kcal === null) !== (kj === null)) {
    falhas.push(`${id}: só um de kcal/kJ está preenchido`)
    continue
  }

  saida.push({ id, nome, nome_normalizado: normalizar(nome), ...valores })
}

if (falhas.length) {
  console.error(`${falhas.length} linha(s) não bateram com o PDF oficial:`)
  falhas.forEach(f => console.error('  ' + f))
  process.exit(1)
}

const destino = path.join(__dirname, '..', 'assets', 'taco.json')
fs.writeFileSync(destino, '[\r\n' + saida.map(a => JSON.stringify(a)).join(',\r\n') + '\r\n]\r\n', 'utf8')
console.log(`${saida.length} alimentos gravados em ${path.relative(process.cwd(), destino)}`)
