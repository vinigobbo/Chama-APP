import { getBanco } from './database'
import { habitoAplicavelNaData, somarDias } from '../utils/frequencia'
import { hojeISO } from '../utils/data'

export async function buscarRegistrosDeHoje(data: string) {
  const db = getBanco()
  const habitos = await db.getAllAsync(
    'SELECT * FROM habitos WHERE ativo = 1'
  ) as any[]

  const habitosDeHoje = habitos.filter(h => habitoAplicavelNaData(h, data))

  const registros = await db.getAllAsync(
    'SELECT * FROM registros_diarios WHERE data = ?',
    [data]
  ) as Array<{ id: number; habito_id: number; data: string; feito: number }>

  return habitosDeHoje.map(h => ({
    ...h,
    feito: registros.some(r => r.habito_id === h.id && r.feito === 1) ? 1 : 0,
  }))
}

export async function marcarHabito(habitoId: number, data: string) {
  const db = getBanco()
  const existe = await db.getFirstAsync(
    'SELECT id FROM registros_diarios WHERE habito_id = ? AND data = ?',
    [habitoId, data]
  ) as { id: number } | null
  if (existe) {
    await db.runAsync('UPDATE registros_diarios SET feito = 1 WHERE id = ?', [existe.id])
  } else {
    await db.runAsync(
      'INSERT INTO registros_diarios (habito_id, data, feito) VALUES (?, ?, 1)',
      [habitoId, data]
    )
  }
}

export async function desmarcarHabito(habitoId: number, data: string) {
  const db = getBanco()
  await db.runAsync(
    'UPDATE registros_diarios SET feito = 0 WHERE habito_id = ? AND data = ?',
    [habitoId, data]
  )
}

async function carregarHistorico() {
  const db = getBanco()
  const habitos = await db.getAllAsync('SELECT * FROM habitos WHERE ativo = 1') as any[]
  const registros = await db.getAllAsync(
    'SELECT habito_id, data FROM registros_diarios WHERE feito = 1'
  ) as Array<{ habito_id: number; data: string }>

  const feitos = new Set(registros.map(r => `${r.habito_id}|${r.data}`))
  let primeiroDia: string | null = null
  for (const r of registros) {
    if (!primeiroDia || r.data < primeiroDia) primeiroDia = r.data
  }
  return { habitos, feitos, primeiroDia }
}

// null = nenhum hábito valia nesse dia (não conta nem quebra o streak)
function diaCompleto(habitos: any[], feitos: Set<string>, data: string) {
  const habitosDoDia = habitos.filter(h => habitoAplicavelNaData(h, data))
  if (habitosDoDia.length === 0) return null
  return habitosDoDia.every(h => feitos.has(`${h.id}|${data}`))
}

export async function calcularStreak() {
  const { habitos, feitos, primeiroDia } = await carregarHistorico()
  if (habitos.length === 0 || !primeiroDia) return 0

  // de hoje pra trás; antes do primeiro registro nenhum dia pode estar completo
  let streak = 0
  for (let dia = hojeISO(); dia >= primeiroDia; dia = somarDias(dia, -1)) {
    const completo = diaCompleto(habitos, feitos, dia)
    if (completo === null) continue
    if (!completo) break
    streak++
  }
  return streak
}

export async function calcularMaiorStreak() {
  const { habitos, feitos, primeiroDia } = await carregarHistorico()
  if (habitos.length === 0 || !primeiroDia) return 0

  // do primeiro registro até hoje, guardando a maior sequência de dias completos
  let maior = 0
  let atual = 0
  const hoje = hojeISO()
  for (let dia = primeiroDia; dia <= hoje; dia = somarDias(dia, 1)) {
    const completo = diaCompleto(habitos, feitos, dia)
    if (completo === null) continue
    atual = completo ? atual + 1 : 0
    if (atual > maior) maior = atual
  }
  return maior
}

export async function contarHabitosConcluidos() {
  const db = getBanco()
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) AS total FROM registros_diarios WHERE feito = 1'
  ) as { total: number }
  return row.total
}

export async function buscarDiasAcademiaRange(dataInicio: string, dataFim: string) {
  const db = getBanco()
  return await db.getAllAsync(
    'SELECT r.data FROM registros_diarios r ' +
    'JOIN habitos h ON h.id = r.habito_id ' +
    "WHERE LOWER(TRIM(h.nome)) = 'academia' AND r.feito = 1 " +
    'AND r.data BETWEEN ? AND ?',
    [dataInicio, dataFim]
  ) as Array<{ data: string }>
}