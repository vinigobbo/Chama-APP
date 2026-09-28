import { File } from 'expo-file-system'
import { getBanco } from './database'
import { hojeISO, horarioAgora } from '../utils/data'
import { somarItens } from '../utils/nutricao'

export type StatusRefeicao = 'pendente' | 'confirmada'

export type Refeicao = {
  id: number
  data: string
  horario: string
  foto_uri: string | null
  status: StatusRefeicao
}

export type ItemRefeicao = {
  id: number
  refeicao_id: number
  nome: string
  peso_g: number
  alimento_taco_id: number | null
  calorias: number | null
  proteina: number | null
  carboidrato: number | null
  gordura: number | null
  editado_manual: number
}

// item com o nome do alimento casado na TACO e se a tabela não tinha algum macro
export type ItemComTaco = ItemRefeicao & {
  taco_nome: string | null
  taco_macros_incompletos: number
}

export type RefeicaoComItens = Refeicao & { itens: ItemComTaco[] }

export type DadosItem = Omit<ItemRefeicao, 'id' | 'refeicao_id'>

const SELECT_ITENS = `
  SELECT i.*, t.nome AS taco_nome,
    CASE WHEN t.id IS NOT NULL AND (t.proteina IS NULL OR t.carboidrato IS NULL OR t.gordura IS NULL)
      THEN 1 ELSE 0 END AS taco_macros_incompletos
  FROM itens_refeicao i
  LEFT JOIN alimentos_taco t ON t.id = i.alimento_taco_id`

export async function criarRefeicao(opcoes: { fotoUri?: string | null; status?: StatusRefeicao; data?: string; horario?: string } = {}) {
  const db = getBanco()
  const resultado = await db.runAsync(
    'INSERT INTO refeicoes (data, horario, foto_uri, status) VALUES (?, ?, ?, ?)',
    [opcoes.data ?? hojeISO(), opcoes.horario ?? horarioAgora(), opcoes.fotoUri ?? null, opcoes.status ?? 'pendente']
  )
  return resultado.lastInsertRowId
}

export async function adicionarItem(refeicaoId: number, item: DadosItem) {
  const db = getBanco()
  const resultado = await db.runAsync(
    `INSERT INTO itens_refeicao
      (refeicao_id, nome, peso_g, alimento_taco_id, calorias, proteina, carboidrato, gordura, editado_manual)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [refeicaoId, item.nome, item.peso_g, item.alimento_taco_id, item.calorias, item.proteina,
      item.carboidrato, item.gordura, item.editado_manual]
  )
  return resultado.lastInsertRowId
}

export async function editarItem(id: number, item: DadosItem) {
  const db = getBanco()
  await db.runAsync(
    `UPDATE itens_refeicao SET nome = ?, peso_g = ?, alimento_taco_id = ?, calorias = ?, proteina = ?,
      carboidrato = ?, gordura = ?, editado_manual = ? WHERE id = ?`,
    [item.nome, item.peso_g, item.alimento_taco_id, item.calorias, item.proteina, item.carboidrato,
      item.gordura, item.editado_manual, id]
  )
}

export async function removerItem(id: number) {
  const db = getBanco()
  await db.runAsync('DELETE FROM itens_refeicao WHERE id = ?', [id])
}

export async function confirmarRefeicao(id: number) {
  const db = getBanco()
  await db.runAsync("UPDATE refeicoes SET status = 'confirmada' WHERE id = ?", [id])
}

// grava a lista da tela de revisão de uma vez: remove os que saíram, edita os que têm id,
// adiciona os novos (id null) e define o status
export async function salvarRefeicao(
  refeicaoId: number,
  itens: Array<DadosItem & { id: number | null }>,
  status: StatusRefeicao
) {
  const db = getBanco()
  await db.withTransactionAsync(async () => {
    const existentes = await db.getAllAsync<{ id: number }>('SELECT id FROM itens_refeicao WHERE refeicao_id = ?', [refeicaoId])
    const mantidos = new Set(itens.filter(i => i.id !== null).map(i => i.id))
    for (const e of existentes) {
      if (!mantidos.has(e.id)) await removerItem(e.id)
    }
    for (const { id, ...dados } of itens) {
      if (id === null) await adicionarItem(refeicaoId, dados)
      else await editarItem(id, dados)
    }
    await db.runAsync('UPDATE refeicoes SET status = ? WHERE id = ?', [status, refeicaoId])
  })
}

export async function excluirRefeicao(id: number) {
  const db = getBanco()
  const refeicao = await db.getFirstAsync<{ foto_uri: string | null }>('SELECT foto_uri FROM refeicoes WHERE id = ?', [id])
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM itens_refeicao WHERE refeicao_id = ?', [id])
    await db.runAsync('DELETE FROM refeicoes WHERE id = ?', [id])
  })
  if (refeicao?.foto_uri) apagarFoto(refeicao.foto_uri)
}

export function apagarFoto(uri: string) {
  try {
    const arquivo = new File(uri)
    if (arquivo.exists) arquivo.delete()
  } catch (e) {
    // arquivo já não existe ou caminho inválido; o registro já foi apagado, segue
  }
}

async function anexarItens(refeicoes: Refeicao[]): Promise<RefeicaoComItens[]> {
  if (!refeicoes.length) return []
  const db = getBanco()
  const ids = refeicoes.map(r => r.id)
  const itens = await db.getAllAsync<ItemComTaco>(
    `${SELECT_ITENS} WHERE i.refeicao_id IN (${ids.map(() => '?').join(', ')}) ORDER BY i.id ASC`,
    ids
  )
  return refeicoes.map(r => ({ ...r, itens: itens.filter(i => i.refeicao_id === r.id) }))
}

export async function buscarRefeicao(id: number) {
  const db = getBanco()
  const refeicao = await db.getFirstAsync<Refeicao>('SELECT * FROM refeicoes WHERE id = ?', [id])
  if (!refeicao) return null
  const [comItens] = await anexarItens([refeicao])
  return comItens
}

export async function listarRefeicoesDoDia(data: string = hojeISO()) {
  const db = getBanco()
  const refeicoes = await db.getAllAsync<Refeicao>(
    'SELECT * FROM refeicoes WHERE data = ? ORDER BY horario ASC, id ASC',
    [data]
  )
  return anexarItens(refeicoes)
}

// só refeições confirmadas entram no total do dia
export async function totaisDoDia(data: string = hojeISO()) {
  const db = getBanco()
  const itens = await db.getAllAsync<Pick<ItemRefeicao, 'calorias' | 'proteina' | 'carboidrato' | 'gordura'>>(
    `SELECT i.calorias, i.proteina, i.carboidrato, i.gordura
     FROM itens_refeicao i JOIN refeicoes r ON r.id = i.refeicao_id
     WHERE r.data = ? AND r.status = 'confirmada'`,
    [data]
  )
  return somarItens(itens)
}
