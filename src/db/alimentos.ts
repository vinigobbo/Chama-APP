import { getBanco } from './database'
import { buscarNaLista, candidatosNaLista, ResultadoBusca } from '../utils/buscaAlimentos'

export type AlimentoTaco = {
  id: number
  nome: string
  nome_normalizado: string
  kcal: number | null
  proteina: number | null
  carboidrato: number | null
  gordura: number | null
  fibra: number | null
}

// a tabela é fixa (597 itens); a pontuação por tokens roda em memória, então carrega uma vez só
let cache: AlimentoTaco[] | null = null

async function todos() {
  if (!cache) {
    const db = getBanco()
    cache = await db.getAllAsync<AlimentoTaco>('SELECT * FROM alimentos_taco ORDER BY id ASC')
  }
  return cache
}

export function limparCacheAlimentos() {
  cache = null
}

export async function buscarAlimentos(termo: string, limite = 30) {
  return buscarNaLista(termo, await todos(), limite)
}

export async function buscarCandidatos(nomeIA: string, n = 5): Promise<ResultadoBusca<AlimentoTaco>[]> {
  return candidatosNaLista(nomeIA, await todos(), n)
}

export async function buscarAlimentoPorId(id: number) {
  const db = getBanco()
  return await db.getFirstAsync<AlimentoTaco>('SELECT * FROM alimentos_taco WHERE id = ?', [id])
}

export async function listarAlimentos() {
  return await todos()
}
