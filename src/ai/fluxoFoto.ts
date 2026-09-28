import { AlimentoTaco, buscarCandidatos, listarAlimentos } from '../db/alimentos'
import { criarRefeicao, salvarRefeicao, DadosItem } from '../db/refeicoes'
import { estadoCompativel } from '../utils/buscaAlimentos'
import { calcularItem } from '../utils/nutricao'
import { ErroVisao, identificarAlimentos, ItemIdentificado } from './visao'

// Foto -> IA -> casamento com a TACO -> refeição pendente pra revisar.
// Qualquer erro da IA vira uma refeição pendente só com a foto, pra registrar à mão.

export type Casamento = { alimento: AlimentoTaco | null; origem: 'ia' | 'busca' | 'nenhum' }

// 1º o id que a IA escolheu na lista, se existir e não trocar cru por cozido;
// senão, a busca por nome (só aceita casamento automático, que já respeita o estado de preparo)
export async function casarComTabela(item: ItemIdentificado, porId: Map<number, AlimentoTaco>): Promise<Casamento> {
  if (item.alimento_id !== null) {
    const alimento = porId.get(item.alimento_id)
    if (alimento && estadoCompativel(item.nome, alimento)) return { alimento, origem: 'ia' }
  }
  const [melhor] = await buscarCandidatos(item.nome, 1)
  if (melhor?.casamentoAutomatico) return { alimento: melhor.alimento, origem: 'busca' }
  return { alimento: null, origem: 'nenhum' }
}

export function itemParaDados(item: ItemIdentificado, alimento: AlimentoTaco | null): DadosItem {
  const peso = item.peso_g ?? 0
  if (alimento && alimento.kcal !== null) {
    const m = calcularItem(alimento, peso)
    return {
      nome: item.nome, peso_g: peso, alimento_taco_id: alimento.id,
      calorias: m.calorias, proteina: m.proteina, carboidrato: m.carboidrato, gordura: m.gordura,
      editado_manual: 0,
    }
  }
  // sem casamento, ou a tabela não tem kcal: entra pra preencher à mão
  return {
    nome: item.nome, peso_g: peso, alimento_taco_id: alimento?.id ?? null,
    calorias: null, proteina: null, carboidrato: null, gordura: null,
    editado_manual: 1,
  }
}

export type ResultadoFluxo = { refeicaoId: number; erro: ErroVisao | null; avisoFalha: string | null }

export async function registrarRefeicaoPorFoto(
  fotoUri: string,
  base64: string,
  sinal?: AbortSignal,
  identificar: typeof identificarAlimentos = identificarAlimentos
): Promise<ResultadoFluxo> {
  const alimentos = await listarAlimentos()
  let itens: ItemIdentificado[] = []
  let erro: ErroVisao | null = null
  try {
    itens = await identificar(base64, { catalogo: alimentos.map(a => ({ id: a.id, nome: a.nome })), sinal })
  } catch (e) {
    erro = e instanceof ErroVisao ? e : new ErroVisao('requisicao')
  }

  const porId = new Map(alimentos.map(a => [a.id, a]))
  const dados: DadosItem[] = []
  for (const item of itens) {
    const { alimento } = await casarComTabela(item, porId)
    dados.push(itemParaDados(item, alimento))
  }

  const refeicaoId = await criarRefeicao({ fotoUri, status: 'pendente' })
  await salvarRefeicao(refeicaoId, dados.map(d => ({ ...d, id: null })), 'pendente')
  const avisoFalha = erro ? `${erro.message} a foto ficou salva: registre os itens à mão.` : null
  return { refeicaoId, erro, avisoFalha }
}
