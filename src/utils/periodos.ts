export type Periodo = 'mensal' | 'trimestral' | 'semestral' | 'anual'

const MESES_POR_PERIODO: Record<Periodo, number> = {
  mensal: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// último dia do período de calendário (mês, trimestre, semestre ou ano) que contém dataISO
export function calcularDataFim(periodo: Periodo, dataISO: string) {
  const [ano, mes] = dataISO.split('-').map(Number)
  const meses = MESES_POR_PERIODO[periodo]
  const mesFim = Math.ceil(mes / meses) * meses
  // dia 0 do mês seguinte = último dia de mesFim
  const ultimoDia = new Date(Date.UTC(ano, mesFim, 0)).getUTCDate()
  return `${ano}-${pad(mesFim)}-${pad(ultimoDia)}`
}
