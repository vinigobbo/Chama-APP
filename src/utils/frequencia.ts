export function somarDias(dataISO: string, n: number) {
  const d = new Date(dataISO + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// data_referencia de um hábito novo: "dia sim, dia não" começa a valer só amanhã
export function dataReferenciaInicial(frequenciaTipo: string, hojeISO: string) {
  return frequenciaTipo === 'intervalo' ? somarDias(hojeISO, 1) : hojeISO
}

export function habitoAplicavelNaData(habito: any, dataISO: string) {
  // antes da data_referencia o hábito ainda não existia (hábitos antigos sem referência valem sempre)
  if (habito.data_referencia && dataISO < habito.data_referencia) return false

  if (habito.frequencia_tipo === 'semana') {
    const dias: number[] = habito.frequencia_dias ? JSON.parse(habito.frequencia_dias) : []
    const data = new Date(dataISO + 'T00:00:00')
    return dias.includes(data.getDay())
  }

  if (habito.frequencia_tipo === 'intervalo') {
    const referencia = new Date((habito.data_referencia ?? dataISO) + 'T00:00:00')
    const data = new Date(dataISO + 'T00:00:00')
    const diffDias = Math.round((data.getTime() - referencia.getTime()) / (1000 * 60 * 60 * 24))
    return diffDias % 2 === 0
  }

  return true 
}