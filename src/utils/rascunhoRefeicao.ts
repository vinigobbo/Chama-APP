import { calcularItem, lerNumero, somarItens, Totais } from './nutricao'
import type { AlimentoTaco } from '../db/alimentos'
import type { DadosItem, ItemComTaco } from '../db/refeicoes'

// Estado de um item na tela de revisão, antes de gravar. Os números ficam como texto enquanto
// o usuário digita; o cálculo sai daqui pra tela e pro banco usarem a mesma regra.

export type MacrosManuais = { calorias: string; proteina: string; carboidrato: string; gordura: string }

export type ItemRascunho = {
  chave: string
  id: number | null // null = ainda não gravado
  nome: string // o que a IA disse ou o que o usuário escolheu/digitou
  pesoTexto: string
  alimento: AlimentoTaco | null
  manual: MacrosManuais
}

export type ItemCalculado = {
  calorias: number | null
  proteina: number
  carboidrato: number
  gordura: number
  pesoG: number | null
  // sem alimento da tabela, ou a tabela não tem kcal: os valores vêm dos campos manuais
  exigeManual: boolean
  // a tabela não tem proteína/carboidrato/gordura pra esse alimento (contam 0)
  macrosIncompletos: boolean
  pronto: boolean // dá pra confirmar
}

let contador = 0
export function novaChave() {
  contador += 1
  return `item-${Date.now()}-${contador}`
}

export const MANUAL_VAZIO: MacrosManuais = { calorias: '', proteina: '', carboidrato: '', gordura: '' }

export function exigeManual(alimento: AlimentoTaco | null) {
  return alimento === null || alimento.kcal === null
}

export function calcularRascunho(item: ItemRascunho): ItemCalculado {
  const peso = lerNumero(item.pesoTexto)
  const pesoValido = peso !== null && peso > 0
  if (!exigeManual(item.alimento)) {
    const m = calcularItem(item.alimento!, pesoValido ? peso! : 0)
    return {
      calorias: pesoValido ? m.calorias : null,
      proteina: m.proteina,
      carboidrato: m.carboidrato,
      gordura: m.gordura,
      pesoG: pesoValido ? peso : null,
      exigeManual: false,
      macrosIncompletos: m.macrosIncompletos,
      pronto: pesoValido,
    }
  }
  const calorias = lerNumero(item.manual.calorias)
  return {
    calorias,
    proteina: lerNumero(item.manual.proteina) ?? 0,
    carboidrato: lerNumero(item.manual.carboidrato) ?? 0,
    gordura: lerNumero(item.manual.gordura) ?? 0,
    pesoG: pesoValido ? peso : null,
    exigeManual: true,
    macrosIncompletos: false,
    pronto: pesoValido && calorias !== null,
  }
}

export function totalDoRascunho(itens: ItemRascunho[]): Totais {
  return somarItens(itens.map(calcularRascunho))
}

export function podeConfirmar(itens: ItemRascunho[]) {
  return itens.length > 0 && itens.every(i => calcularRascunho(i).pronto)
}

// pra gravar; peso inválido vira 0 (só acontece em "salvar como pendente")
export function rascunhoParaDados(item: ItemRascunho): DadosItem & { id: number | null } {
  const c = calcularRascunho(item)
  if (!c.exigeManual) {
    return {
      id: item.id,
      nome: item.nome.trim() || item.alimento!.nome,
      peso_g: c.pesoG ?? 0,
      alimento_taco_id: item.alimento!.id,
      calorias: c.calorias,
      proteina: c.proteina,
      carboidrato: c.carboidrato,
      gordura: c.gordura,
      editado_manual: 0,
    }
  }
  return {
    id: item.id,
    nome: item.nome.trim() || item.alimento?.nome || 'item',
    peso_g: c.pesoG ?? 0,
    alimento_taco_id: item.alimento?.id ?? null,
    calorias: c.calorias,
    proteina: lerNumero(item.manual.proteina),
    carboidrato: lerNumero(item.manual.carboidrato),
    gordura: lerNumero(item.manual.gordura),
    editado_manual: 1,
  }
}

const paraTexto = (v: number | null) => (v === null ? '' : String(v).replace('.', ','))

export function itemParaRascunho(item: ItemComTaco, alimento: AlimentoTaco | null): ItemRascunho {
  return {
    chave: novaChave(),
    id: item.id,
    nome: item.nome,
    pesoTexto: item.peso_g > 0 ? paraTexto(item.peso_g) : '',
    alimento,
    manual: item.editado_manual
      ? {
          calorias: paraTexto(item.calorias),
          proteina: paraTexto(item.proteina),
          carboidrato: paraTexto(item.carboidrato),
          gordura: paraTexto(item.gordura),
        }
      : MANUAL_VAZIO,
  }
}

export function novoRascunho(alimento: AlimentoTaco | null, nome: string, pesoG: number | null = 100): ItemRascunho {
  return {
    chave: novaChave(),
    id: null,
    nome,
    pesoTexto: pesoG === null ? '' : paraTexto(pesoG),
    alimento,
    manual: MANUAL_VAZIO,
  }
}
