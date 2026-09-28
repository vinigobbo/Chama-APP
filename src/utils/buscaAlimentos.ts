import { normalizar } from './texto'
import { SINONIMOS, IDS_PREFERIDOS } from '../data/sinonimosAlimentos'

// Busca por pontuação de tokens: ordem livre, sem exigir que todos existam, ignorando pontuação,
// acento e palavras de ligação. Plural e gênero são unificados ("fritas" = "frito", "crua" = "cru").

export type AlimentoBusca = { id: number; nome: string; nome_normalizado: string }

export type ResultadoBusca<T extends AlimentoBusca> = {
  alimento: T
  cobertura: number // fração dos termos da consulta encontrados no nome (0 a 1)
  casamentoAutomatico: boolean // bom o bastante pra ser escolhido sem o usuário
}

const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'e', 'em', 'a', 'o', 'as', 'os', 'ao', 'na', 'no', 'para'])

const RADICAIS_ESPECIAIS: Record<string, string> = { crua: 'cru', crus: 'cru', cruas: 'cru', paes: 'pao' }

// grupos de estado de preparo; cru contra qualquer cozimento é conflito forte
const ESTADOS: Record<string, string> = {
  cru: 'cru',
  cozido: 'cozido',
  vapor: 'cozido',
  grelhado: 'grelhado',
  frito: 'frito',
  saute: 'frito',
  assado: 'assado',
  refogado: 'refogado',
  ensopado: 'ensopado',
  torrado: 'torrado',
}

export function radical(token: string) {
  if (RADICAIS_ESPECIAIS[token]) return RADICAIS_ESPECIAIS[token]
  let t = token
  if (t.length >= 4 && t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1)
  if (t.length >= 4 && t.endsWith('a')) t = t.slice(0, -1) + 'o'
  return t
}

type Token = { bruto: string; radical: string; estado: string | null }

function tokenizar(normalizado: string): Token[] {
  const vistos = new Set<string>()
  const tokens: Token[] = []
  for (const bruto of normalizado.split(' ')) {
    if (!bruto || STOPWORDS.has(bruto)) continue
    const r = radical(bruto)
    if (vistos.has(r)) continue
    vistos.add(r)
    tokens.push({ bruto, radical: r, estado: ESTADOS[r] ?? null })
  }
  return tokens
}

export function aplicarSinonimos(normalizado: string) {
  let texto = ` ${normalizado} `
  for (const [de, para] of SINONIMOS) {
    texto = texto.split(` ${de} `).join(` ${para} `)
  }
  return texto.trim()
}

const cacheTokens = new Map<string, Token[]>()
function tokensDoNome(nomeNormalizado: string) {
  let t = cacheTokens.get(nomeNormalizado)
  if (!t) {
    t = tokenizar(nomeNormalizado)
    cacheTokens.set(nomeNormalizado, t)
  }
  return t
}

type Pontuacao<T> = {
  alimento: T
  cobertura: number
  exatos: number
  exatosNaoEstado: number
  casouNaoEstado: boolean
  conflito: 'nenhum' | 'fraco' | 'forte'
  estadoConfere: boolean
  primeiroTermo: boolean
  preferido: boolean
  extras: number
}

function pontuar<T extends AlimentoBusca>(consulta: Token[], alimento: T, aceitarPrefixo: boolean): Pontuacao<T> {
  const nome = tokensDoNome(alimento.nome_normalizado)
  const usados = new Set<number>()
  let soma = 0, total = 0, exatos = 0, exatosNaoEstado = 0
  let casouNaoEstado = false

  for (const q of consulta) {
    // o alimento pesa mais que o preparo: "coração de frango assado" fica mais perto de
    // coração grelhado do que de coxa assada
    const pesoTermo = q.estado ? 0.5 : 1
    total += pesoTermo
    let idx = nome.findIndex(n => n.radical === q.radical)
    let peso = 1
    if (idx < 0 && aceitarPrefixo && q.bruto.length >= 2) {
      idx = nome.findIndex(n => n.bruto.startsWith(q.bruto) || n.radical.startsWith(q.radical))
      peso = 0.6
    }
    if (idx < 0) continue
    usados.add(idx)
    soma += peso * pesoTermo
    if (peso === 1) {
      exatos++
      if (!q.estado) exatosNaoEstado++
    }
    if (!q.estado) casouNaoEstado = true
  }

  const estadosConsulta = new Set(consulta.filter(t => t.estado).map(t => t.estado))
  const estadosNome = new Set(nome.filter(t => t.estado).map(t => t.estado))
  let conflito: Pontuacao<T>['conflito'] = 'nenhum'
  if (estadosConsulta.size && estadosNome.size && ![...estadosConsulta].some(e => estadosNome.has(e))) {
    conflito = estadosConsulta.has('cru') || estadosNome.has('cru') ? 'forte' : 'fraco'
  }
  const estadoConfere = [...estadosConsulta].every(e => estadosNome.has(e))

  return {
    alimento,
    cobertura: total ? soma / total : 0,
    exatos,
    exatosNaoEstado,
    casouNaoEstado,
    conflito,
    estadoConfere,
    primeiroTermo: nome.length > 0 && consulta.some(q => q.radical === nome[0].radical),
    preferido: IDS_PREFERIDOS.has(alimento.id),
    extras: nome.length - usados.size,
  }
}

function comparar<T extends AlimentoBusca>(a: Pontuacao<T>, b: Pontuacao<T>) {
  return (
    Number(a.conflito === 'forte') - Number(b.conflito === 'forte') ||
    b.cobertura - a.cobertura ||
    b.exatos - a.exatos ||
    Number(a.conflito === 'fraco') - Number(b.conflito === 'fraco') ||
    Number(b.primeiroTermo) - Number(a.primeiroTermo) ||
    Number(b.preferido) - Number(a.preferido) ||
    a.extras - b.extras ||
    a.alimento.nome.length - b.alimento.nome.length ||
    a.alimento.id - b.alimento.id
  )
}

function executar<T extends AlimentoBusca>(termo: string, alimentos: T[], aceitarPrefixo: boolean) {
  const consulta = tokenizar(aplicarSinonimos(normalizar(termo)))
  if (!consulta.length) return { consulta, pontuados: [] as Pontuacao<T>[] }
  const soEstados = consulta.every(t => t.estado)
  const pontuados = alimentos
    .map(a => pontuar(consulta, a, aceitarPrefixo))
    // precisa casar algum termo que não seja só o estado de preparo ("cozido" sozinho não basta)
    .filter(p => p.cobertura > 0 && (p.casouNaoEstado || soEstados))
    .sort(comparar)
  return { consulta, pontuados }
}

// false quando um é cru e o outro cozido/grelhado/etc. (usado pra conferir o id que a IA escolheu)
export function estadoCompativel(nome: string, alimento: AlimentoBusca) {
  const consulta = tokenizar(aplicarSinonimos(normalizar(nome)))
  return pontuar(consulta, alimento, false).conflito !== 'forte'
}

// Busca digitada pelo usuário: aceita palavra incompleta; resultados com estado oposto vão pro fim.
export function buscarNaLista<T extends AlimentoBusca>(termo: string, alimentos: T[], limite = 30): T[] {
  return executar(termo, alimentos, true).pontuados.slice(0, limite).map(p => p.alimento)
}

// Candidatos pra um nome vindo da IA: só palavras inteiras e nunca cru contra cozido.
// casamentoAutomatico: sem conflito de estado, o estado pedido aparece no nome e pelo menos
// 2/3 dos termos que não são estado batem exatamente.
export function candidatosNaLista<T extends AlimentoBusca>(nome: string, alimentos: T[], n = 5): ResultadoBusca<T>[] {
  const { consulta, pontuados } = executar(nome, alimentos, false)
  const naoEstado = consulta.filter(t => !t.estado).length
  return pontuados
    .filter(p => p.conflito !== 'forte')
    .slice(0, n)
    .map(p => ({
      alimento: p.alimento,
      cobertura: p.cobertura,
      casamentoAutomatico:
        p.conflito === 'nenhum' && p.estadoConfere && naoEstado > 0 && p.exatosNaoEstado / naoEstado >= 2 / 3,
    }))
}
