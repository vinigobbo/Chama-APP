import { getBanco } from './database'

export async function buscarMetas() {
  const db = getBanco()
  const rows = await db.getAllAsync(
    'SELECT * FROM metas_semestrais ORDER BY data_fim ASC'
  ) as Array<{
    id: number
    nome: string
    tipo: string
    emoji: string | null
    valor_alvo: number
    unidade: string | null
    data_inicio: string
    data_fim: string
  }>
  return rows
}

export async function criarMeta(
  nome: string,
  tipo: string,
  emoji: string | null,
  valorAlvo: number,
  unidade: string | null,
  dataInicio: string,
  dataFim: string
) {
  const db = getBanco()
  await db.runAsync(
    'INSERT INTO metas_semestrais (nome, tipo, emoji, valor_alvo, unidade, data_inicio, data_fim) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [nome, tipo, emoji, valorAlvo, unidade, dataInicio, dataFim]
  )
}

export async function excluirMeta(id: number) {
  const db = getBanco()
  await db.runAsync('DELETE FROM registros_progresso WHERE meta_id = ?', [id])
  await db.runAsync('DELETE FROM metas_semestrais WHERE id = ?', [id])
}

export async function buscarUltimoProgresso(metaId: number) {
  const db = getBanco()
  return await db.getFirstAsync(
    'SELECT valor, data FROM registros_progresso WHERE meta_id = ? ORDER BY data DESC, id DESC LIMIT 1',
    [metaId]
  ) as { valor: number; data: string } | null
}

export async function contarMetasConcluidas() {
  const db = getBanco()
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) AS total FROM metas_semestrais m WHERE (' +
    'SELECT p.valor FROM registros_progresso p WHERE p.meta_id = m.id ORDER BY p.data DESC, p.id DESC LIMIT 1' +
    ') >= m.valor_alvo'
  ) as { total: number }
  return row.total
}

export async function registrarProgresso(metaId: number, data: string, valor: number) {
  const db = getBanco()
  await db.runAsync(
    'INSERT INTO registros_progresso (meta_id, data, valor) VALUES (?, ?, ?)',
    [metaId, data, valor]
  )
}