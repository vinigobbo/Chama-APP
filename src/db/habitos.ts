import { getBanco } from './database'

export async function buscarHabitosAtivos() {
  const db = getBanco()
  return await db.getAllAsync(
    'SELECT * FROM habitos WHERE ativo = 1'
  ) as Array<{
    id: number
    nome: string
    icone: string | null
    emoji: string | null
    frequencia_tipo: string
    frequencia_dias: string | null
    data_referencia: string | null
    tipo: string
    ativo: number
  }>
}

export async function criarHabito(
  nome: string,
  emoji: string | null,
  tipo: string,
  frequenciaTipo: 'diario' | 'semana' | 'intervalo',
  frequenciaDias: number[] | null,
  dataReferencia: string
) {
  const db = getBanco()
  await db.runAsync(
    'INSERT INTO habitos (nome, emoji, tipo, frequencia_tipo, frequencia_dias, data_referencia) VALUES (?, ?, ?, ?, ?, ?)',
    [
      nome,
      emoji,
      tipo,
      frequenciaTipo,
      frequenciaDias ? JSON.stringify(frequenciaDias) : null,
      dataReferencia,
    ]
  )
}

export async function desativarHabito(id: number) {
  const db = getBanco()
  await db.runAsync(
    'UPDATE habitos SET ativo = 0 WHERE id = ?',
    [id]
  )
}