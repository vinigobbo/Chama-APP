import { useEffect, useLayoutEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { cores } from '../theme/colors'
import { fontes, tamanhos } from '../theme/fonts'
import ConfirmModal from '../components/ConfirmModal'
import AlimentoBuscaModal from '../components/AlimentoBuscaModal'
import ItemRefeicaoCard from '../components/ItemRefeicaoCard'
import { AlimentoTaco, buscarCandidatos, listarAlimentos } from '../db/alimentos'
import { buscarRefeicao, criarRefeicao, excluirRefeicao, salvarRefeicao, Refeicao, StatusRefeicao } from '../db/refeicoes'
import { hojeISO, horarioAgora } from '../utils/data'
import { formatarDecimal } from '../utils/nutricao'
import {
  ItemRascunho, itemParaRascunho, novoRascunho, podeConfirmar, rascunhoParaDados, totalDoRascunho,
} from '../utils/rascunhoRefeicao'

export type ParamsRevisao = {
  refeicaoId?: number
  // refeição acabou de ser criada neste fluxo: "descartar" apaga ela (e a foto)
  nova?: boolean
  // itens vieram da IA: mostra o aviso de estimativa e o nome que a IA deu
  origemIA?: boolean
  // a IA falhou e caiu no manual; mensagem pra mostrar no topo
  avisoFalha?: string
}

type Busca = { chave: string | null; termo: string; sugestoes: AlimentoTaco[] }

export default function RevisaoRefeicaoScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const params: ParamsRevisao = route.params ?? {}

  const [carregando, setCarregando] = useState(!!params.refeicaoId)
  const [erroCarregar, setErroCarregar] = useState(false)
  const [refeicao, setRefeicao] = useState<Refeicao | null>(null)
  const [itens, setItens] = useState<ItemRascunho[]>([])
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState<Busca | null>(null)
  const [confirmarDescarte, setConfirmarDescarte] = useState(false)
  // data e horário de quando a refeição manual começou a ser registrada
  const [inicio] = useState({ data: hojeISO(), horario: horarioAgora() })

  useLayoutEffect(() => {
    navigation.setOptions({ title: params.refeicaoId && !params.nova ? 'refeição' : 'nova refeição' })
  }, [navigation, params.refeicaoId, params.nova])

  useEffect(() => {
    if (!params.refeicaoId) return
    let ativo = true
    ;(async () => {
      try {
        const [r, alimentos] = await Promise.all([buscarRefeicao(params.refeicaoId!), listarAlimentos()])
        if (!ativo) return
        if (!r) {
          setErroCarregar(true)
          return
        }
        const porId = new Map(alimentos.map(a => [a.id, a]))
        setRefeicao(r)
        setItens(r.itens.map(i => itemParaRascunho(i, i.alimento_taco_id === null ? null : porId.get(i.alimento_taco_id) ?? null)))
      } catch (e) {
        if (ativo) setErroCarregar(true)
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => { ativo = false }
  }, [params.refeicaoId])

  const origemIA = params.origemIA || (!!refeicao?.foto_uri && refeicao.status === 'pendente')
  const total = totalDoRascunho(itens)
  const confirmavel = podeConfirmar(itens)

  function atualizar(chave: string, mudanca: Partial<ItemRascunho>) {
    setItens(atual => atual.map(i => (i.chave === chave ? { ...i, ...mudanca } : i)))
  }

  function remover(chave: string) {
    setItens(atual => atual.filter(i => i.chave !== chave))
  }

  async function abrirBusca(item: ItemRascunho | null) {
    if (!item) {
      setBusca({ chave: null, termo: '', sugestoes: [] })
      return
    }
    // item que veio da IA: sugere os candidatos da tabela pro nome que ela deu
    let sugestoes: AlimentoTaco[] = []
    if (origemIA && item.nome) {
      try {
        sugestoes = (await buscarCandidatos(item.nome, 5)).map(c => c.alimento)
      } catch (e) {
        sugestoes = []
      }
    }
    setBusca({ chave: item.chave, termo: item.nome, sugestoes })
  }

  function escolherAlimento(alimento: AlimentoTaco) {
    if (!busca) return
    if (busca.chave === null) {
      setItens(atual => [...atual, novoRascunho(alimento, alimento.nome)])
    } else {
      // mantém o nome original (o que a IA disse); só troca a referência da tabela
      atualizar(busca.chave, { alimento })
    }
    setBusca(null)
  }

  function escolherManual(nome: string) {
    if (!busca) return
    if (busca.chave === null) {
      setItens(atual => [...atual, novoRascunho(null, nome || 'item')])
    } else {
      const item = itens.find(i => i.chave === busca.chave)
      atualizar(busca.chave, { alimento: null, nome: item?.nome || nome || 'item' })
    }
    setBusca(null)
  }

  async function salvar(status: StatusRefeicao) {
    if (salvando) return
    setSalvando(true)
    try {
      const id = params.refeicaoId ?? (await criarRefeicao({ data: inicio.data, horario: inicio.horario, status }))
      await salvarRefeicao(id, itens.map(rascunhoParaDados), status)
      navigation.goBack()
    } catch (e) {
      Alert.alert('não deu pra salvar', 'tente de novo em instantes')
      setSalvando(false)
    }
  }

  async function descartar() {
    setConfirmarDescarte(false)
    try {
      if (params.nova && params.refeicaoId) await excluirRefeicao(params.refeicaoId)
    } catch (e) {
      // não conseguiu apagar: continua pendente e aparece na lista pra revisar
    }
    navigation.goBack()
  }

  if (carregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={cores.acento} size="large" />
      </View>
    )
  }

  if (erroCarregar) {
    return (
      <View style={styles.centro}>
        <Text style={styles.vazio}>não deu pra abrir essa refeição</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.voltarBtn}>
          <Text style={styles.voltarTxt}>voltar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const descartaTudo = !!params.nova || !params.refeicaoId
  // sem item e sem foto não há o que guardar pra depois
  const podeSalvarPendente = itens.length > 0 || !!refeicao?.foto_uri

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {refeicao?.foto_uri ? <Image source={{ uri: refeicao.foto_uri }} style={styles.foto} /> : null}

        {params.avisoFalha ? <Text style={styles.avisoFalha}>{params.avisoFalha}</Text> : null}

        {origemIA && itens.length > 0 && (
          <Text style={styles.avisoIA}>
            estimativa por foto pode errar bastante, principalmente na porção. confira os gramas.
          </Text>
        )}

        <View style={styles.totalCard}>
          <View>
            <Text style={styles.totalKcal}>{formatarDecimal(total.calorias, 0)}</Text>
            <Text style={styles.totalLabel}>kcal nesta refeição</Text>
          </View>
          <View style={styles.totalMacros}>
            <Text style={styles.totalMacro}>P {formatarDecimal(total.proteina)} g</Text>
            <Text style={styles.totalMacro}>C {formatarDecimal(total.carboidrato)} g</Text>
            <Text style={styles.totalMacro}>G {formatarDecimal(total.gordura)} g</Text>
          </View>
        </View>

        <Text style={styles.secaoTitulo}>itens</Text>
        {itens.length === 0 && <Text style={styles.vazio}>nenhum item ainda</Text>}
        {itens.map(item => (
          <ItemRefeicaoCard
            key={item.chave}
            item={item}
            rotuloNome={origemIA ? 'a IA identificou' : undefined}
            onChangePeso={t => atualizar(item.chave, { pesoTexto: t })}
            onChangeManual={manual => atualizar(item.chave, { manual })}
            onTrocar={() => abrirBusca(item)}
            onRemover={() => remover(item.chave)}
          />
        ))}

        <TouchableOpacity style={styles.addItemBtn} onPress={() => abrirBusca(null)}>
          <Text style={styles.addItemTxt}>+ adicionar item</Text>
        </TouchableOpacity>

        <View style={styles.acoes}>
          <TouchableOpacity
            style={[styles.confirmarBtn, (!confirmavel || salvando) && styles.desabilitado]}
            disabled={!confirmavel || salvando}
            onPress={() => salvar('confirmada')}
          >
            {salvando ? <ActivityIndicator color={cores.fundo} /> : <Text style={styles.confirmarTxt}>confirmar</Text>}
          </TouchableOpacity>
          {!confirmavel && itens.length > 0 && (
            <Text style={styles.dica}>preencha o peso e as calorias de todos os itens pra confirmar</Text>
          )}
          <TouchableOpacity
            style={[styles.pendenteBtn, !podeSalvarPendente && styles.desabilitado]}
            disabled={salvando || !podeSalvarPendente}
            onPress={() => salvar('pendente')}
          >
            <Text style={styles.pendenteTxt}>salvar como pendente</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.descartarBtn} disabled={salvando} onPress={() => setConfirmarDescarte(true)}>
            <Text style={styles.descartarTxt}>{descartaTudo ? 'descartar' : 'descartar alterações'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <AlimentoBuscaModal
        visivel={busca !== null}
        titulo={busca?.chave ? 'trocar alimento' : 'adicionar item'}
        termoInicial={busca?.termo ?? ''}
        sugestoes={busca?.sugestoes ?? []}
        onFechar={() => setBusca(null)}
        onEscolher={escolherAlimento}
        onManual={escolherManual}
      />

      <ConfirmModal
        visivel={confirmarDescarte}
        titulo={descartaTudo ? 'descartar refeição?' : 'descartar alterações?'}
        mensagem={
          descartaTudo
            ? refeicao?.foto_uri
              ? 'os itens e a foto desta refeição serão apagados.'
              : 'os itens desta refeição não serão salvos.'
            : 'o que você mudou agora não será salvo. a refeição continua como estava.'
        }
        textoConfirmar="descartar"
        onCancelar={() => setConfirmarDescarte(false)}
        onConfirmar={descartar}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  scrollContent: { paddingTop: 8, paddingHorizontal: 24, paddingBottom: 60 },
  centro: { flex: 1, backgroundColor: cores.fundo, justifyContent: 'center', alignItems: 'center', padding: 24 },
  foto: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: cores.fundoCartao, marginBottom: 16 },
  avisoFalha: {
    color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.sub, lineHeight: 18,
    backgroundColor: cores.fundoCartao, borderLeftWidth: 3, borderLeftColor: cores.erro,
    padding: 12, borderRadius: 8, marginBottom: 12,
  },
  avisoIA: {
    color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub, lineHeight: 18,
    borderLeftWidth: 3, borderLeftColor: cores.acento, paddingLeft: 12, marginBottom: 16,
  },
  totalCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: cores.fundoCartao, borderRadius: 10, padding: 16, marginBottom: 8,
  },
  totalKcal: { color: cores.acento, fontFamily: fontes.numero, fontSize: 32 },
  totalLabel: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub },
  totalMacros: { alignItems: 'flex-end', gap: 2 },
  totalMacro: { color: cores.texto, fontFamily: fontes.numero, fontSize: tamanhos.sub },
  secaoTitulo: {
    color: cores.acento, fontFamily: fontes.corpo, fontSize: 11,
    fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase',
    marginTop: 16, marginBottom: 8,
  },
  vazio: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub, textAlign: 'center', marginVertical: 16 },
  addItemBtn: { borderWidth: 1, borderColor: cores.acento, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  addItemTxt: { color: cores.acento, fontFamily: fontes.corpo, fontSize: tamanhos.sub, fontWeight: '600' },
  acoes: { marginTop: 32, gap: 12 },
  confirmarBtn: { backgroundColor: cores.acento, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  confirmarTxt: { color: cores.fundo, fontFamily: fontes.corpo, fontSize: tamanhos.corpo, fontWeight: '600' },
  desabilitado: { opacity: 0.4 },
  dica: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: 11, textAlign: 'center' },
  pendenteBtn: { borderWidth: 1, borderColor: cores.fundoInput, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  pendenteTxt: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.sub },
  descartarBtn: { paddingVertical: 10, alignItems: 'center' },
  descartarTxt: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub },
  voltarBtn: { marginTop: 16, padding: 8 },
  voltarTxt: { color: cores.acento, fontFamily: fontes.corpo, fontSize: tamanhos.sub, fontWeight: '600' },
})
