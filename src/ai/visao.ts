import { obterChaveGemini } from './chave'
import { provedorGemini } from './gemini'
import { listarAlimentos } from '../db/alimentos'
import type { ItemCatalogo } from './prompt'
import { ErroVisao } from './erros'

export { ErroVisao, MENSAGENS_ERRO } from './erros'
export type { TipoErroVisao } from './erros'

// Camada de visão: a IA só identifica o alimento, o peso e (se achar) o id na tabela.
// Calorias e macros sempre vêm da tabela TACO, nunca daqui.

export type ItemIdentificado = {
  nome: string
  peso_g: number | null
  alimento_id: number | null // já validado contra o catálogo; null = cair na busca por nome
  confianca: number | null
}

export type OpcoesProvedor = {
  chave: string
  catalogo: ItemCatalogo[]
  sinal?: AbortSignal
}

// Interface de provedor: pra trocar de IA, basta outra implementação disto.
// Deve lançar ErroVisao e devolver o JSON cru da IA (validado por validarResposta).
export interface ProvedorVisao {
  nome: string
  identificar(fotoBase64: string, opcoes: OpcoesProvedor): Promise<unknown>
  testarChave(chave: string, sinal?: AbortSignal): Promise<void>
}

let provedor: ProvedorVisao = provedorGemini

export function definirProvedorVisao(p: ProvedorVisao) {
  provedor = p
}

// Confere o formato que o schema pede e descarta o que não serve. Ids fora do catálogo viram null.
export function validarResposta(bruto: unknown, idsValidos: Set<number>): ItemIdentificado[] {
  if (!bruto || typeof bruto !== 'object' || !Array.isArray((bruto as any).itens)) {
    throw new ErroVisao('json_invalido')
  }
  const itens: ItemIdentificado[] = []
  for (const i of (bruto as any).itens) {
    if (!i || typeof i !== 'object') continue
    const nome = typeof i.nome === 'string' ? i.nome.trim() : ''
    if (!nome) continue
    const peso = typeof i.peso_g === 'number' && Number.isFinite(i.peso_g) && i.peso_g > 0 && i.peso_g <= 5000
      ? Math.round(i.peso_g)
      : null
    const id = Number.isInteger(i.alimento_id) && idsValidos.has(i.alimento_id) ? i.alimento_id : null
    const confianca = typeof i.confianca === 'number' && Number.isFinite(i.confianca)
      ? Math.min(1, Math.max(0, i.confianca))
      : null
    itens.push({ nome: nome.slice(0, 80), peso_g: peso, alimento_id: id, confianca })
  }
  if ((bruto as any).itens.length > 0 && itens.length === 0) throw new ErroVisao('json_invalido')
  if (itens.length === 0) throw new ErroVisao('lista_vazia')
  return itens
}

export type OpcoesIdentificar = {
  catalogo?: ItemCatalogo[] // padrão: a tabela TACO inteira do banco
  sinal?: AbortSignal
}

export async function identificarAlimentos(fotoBase64: string, opcoes: OpcoesIdentificar = {}): Promise<ItemIdentificado[]> {
  const chave = await obterChaveGemini()
  if (!chave) throw new ErroVisao('sem_chave')
  const catalogo = opcoes.catalogo ?? (await listarAlimentos()).map(a => ({ id: a.id, nome: a.nome }))
  const bruto = await provedor.identificar(fotoBase64, { chave, catalogo, sinal: opcoes.sinal })
  return validarResposta(bruto, new Set(catalogo.map(a => a.id)))
}

export async function testarChave(chave: string, sinal?: AbortSignal) {
  if (!chave.trim()) throw new ErroVisao('sem_chave')
  await provedor.testarChave(chave.trim(), sinal)
}
