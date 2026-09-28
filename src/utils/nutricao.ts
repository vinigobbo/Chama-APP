export type ValoresPor100g = {
  kcal: number | null
  proteina: number | null
  carboidrato: number | null
  gordura: number | null
}

export type MacrosItem = {
  calorias: number | null
  proteina: number
  carboidrato: number
  gordura: number
  // algum de proteína/carboidrato/gordura veio null da tabela e contou como 0
  macrosIncompletos: boolean
}

// aceita "12,5" ou "12.5"; vazio ou inválido vira null
export function lerNumero(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.')
  if (!limpo || !/^\d*\.?\d+$|^\d+\.$/.test(limpo)) return null
  return Number(limpo)
}

// número com vírgula decimal, sem ",0" sobrando ("12,5", "190")
export function formatarDecimal(valor: number, casas = 1) {
  const fixo = valor.toFixed(casas)
  return (casas > 0 ? fixo.replace(/\.?0+$/, '') : fixo).replace('.', ',')
}

export function arredondar1(valor: number) {
  // o epsilon evita 0,15 virar 0,1 por erro de ponto flutuante
  return Math.round(valor * 10 + 1e-9) / 10
}

// valor por 100 g × peso / 100, com 1 casa decimal
export function calcularMacro(valorPor100g: number, pesoG: number) {
  return arredondar1((valorPor100g * pesoG) / 100)
}

// kcal null na tabela -> calorias null (o item precisa de macros manuais);
// proteína/carboidrato/gordura null contam como 0 e marcam o item como incompleto
export function calcularItem(alimento: ValoresPor100g, pesoG: number): MacrosItem {
  const macro = (v: number | null) => (v === null ? 0 : calcularMacro(v, pesoG))
  return {
    calorias: alimento.kcal === null ? null : calcularMacro(alimento.kcal, pesoG),
    proteina: macro(alimento.proteina),
    carboidrato: macro(alimento.carboidrato),
    gordura: macro(alimento.gordura),
    macrosIncompletos: alimento.proteina === null || alimento.carboidrato === null || alimento.gordura === null,
  }
}

export type Totais = { calorias: number; proteina: number; carboidrato: number; gordura: number }

export function somarItens(itens: Array<{ calorias: number | null; proteina: number | null; carboidrato: number | null; gordura: number | null }>): Totais {
  const soma = (campo: keyof Totais) => arredondar1(itens.reduce((acc, i) => acc + (i[campo] ?? 0), 0))
  return {
    calorias: soma('calorias'),
    proteina: soma('proteina'),
    carboidrato: soma('carboidrato'),
    gordura: soma('gordura'),
  }
}
