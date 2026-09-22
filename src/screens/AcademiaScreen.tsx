import { useState, useCallback, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { cores } from '../theme/colors'
import { fontes, tamanhos } from '../theme/fonts'
import { buscarDiasAcademiaRange } from '../db/registros'
import {
  buscarTreinos,
  criarTreino,
  excluirTreino,
  buscarExerciciosDoTreino,
  adicionarExercicio,
  removerExercicio as removerExercicioDb,
  atualizarNotas,
} from '../db/treinos'
import SugestaoExercicioModal from '../components/SugestaoExercicioModal'
import ConfirmModal from '../components/ConfirmModal'
import { formatarISO } from '../utils/data'

const SEMANAS_VISIVEIS = 26
const CELULA = 15
const GAP = 4
const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function gerarSemanas(numSemanas: number) {
  const hoje = new Date()
  const domingoAtual = new Date(hoje)
  domingoAtual.setDate(hoje.getDate() - hoje.getDay())

  const inicio = new Date(domingoAtual)
  inicio.setDate(domingoAtual.getDate() - (numSemanas - 1) * 7)

  const semanas: Date[][] = []
  for (let s = 0; s < numSemanas; s++) {
    const semana: Date[] = []
    for (let d = 0; d < 7; d++) {
      const data = new Date(inicio)
      data.setDate(inicio.getDate() + s * 7 + d)
      semana.push(data)
    }
    semanas.push(semana)
  }
  return { semanas, inicio, hoje }
}

function paraISO(data: Date) {
  return formatarISO(data)
}

export default function AcademiaScreen() {
  const [diasMarcados, setDiasMarcados] = useState<string[]>([])
  const scrollRef = useRef<ScrollView>(null)

  const [treinos, setTreinos] = useState<any[]>([])
  const [exerciciosPorTreino, setExerciciosPorTreino] = useState<Record<number, any[]>>({})
  const [treinoAberto, setTreinoAberto] = useState<number | null>(null)
  const [criandoTreino, setCriandoTreino] = useState(false)
  const [novoTreinoNome, setNovoTreinoNome] = useState('')
  const [modalExercicioTreinoId, setModalExercicioTreinoId] = useState<number | null>(null)
  const [notasEditando, setNotasEditando] = useState<{ id: number; valor: string } | null>(null)
  const [treinoParaExcluir, setTreinoParaExcluir] = useState<{ id: number; nome: string } | null>(null)

  const { semanas, inicio, hoje } = gerarSemanas(SEMANAS_VISIVEIS)

  async function carregarHeatmap() {
    const dados = await buscarDiasAcademiaRange(paraISO(inicio), paraISO(hoje))
    setDiasMarcados(dados.map(d => d.data))
  }

  async function carregarTreinos() {
    const lista = await buscarTreinos()
    setTreinos(lista)
    const mapa: Record<number, any[]> = {}
    await Promise.all(
      lista.map(async (t) => {
        mapa[t.id] = await buscarExerciciosDoTreino(t.id)
      })
    )
    setExerciciosPorTreino(mapa)
  }

  useFocusEffect(
    useCallback(() => {
      carregarHeatmap()
      carregarTreinos()
    }, [])
  )

  function mesLabelDaColuna(semana: Date[]) {
    const diaUm = semana.find(d => d.getDate() === 1)
    return diaUm ? MESES[diaUm.getMonth()] : null
  }

  async function criarNovoTreino() {
    const nome = novoTreinoNome.trim()
    if (!nome) return
    await criarTreino(nome)
    setNovoTreinoNome('')
    setCriandoTreino(false)
    await carregarTreinos()
  }

  async function escolherExercicio(nome: string, grupo: string) {
    if (modalExercicioTreinoId === null) return
    await adicionarExercicio(modalExercicioTreinoId, nome, grupo)
    setModalExercicioTreinoId(null)
    await carregarTreinos()
  }

  async function handleRemoverExercicio(id: number) {
    await removerExercicioDb(id)
    await carregarTreinos()
  }

  async function salvarNotas() {
    if (!notasEditando) return
    await atualizarNotas(notasEditando.id, notasEditando.valor.trim())
    setNotasEditando(null)
    await carregarTreinos()
  }

  async function confirmarExclusaoTreino() {
    if (!treinoParaExcluir) return
    await excluirTreino(treinoParaExcluir.id)
    setTreinoParaExcluir(null)
    await carregarTreinos()
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.titulo}>academia</Text>

        <View style={styles.gridRow}>
          <View style={styles.diasSemana}>
            <Text style={styles.mesLabel}> </Text>
            {['D','S','T','Q','Q','S','S'].map((letra, i) => (
              <Text key={i} style={styles.diaLabel}>{letra}</Text>
            ))}
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            <View>
              <View style={styles.mesesRow}>
                {semanas.map((semana, i) => (
                  <View key={i} style={{ width: CELULA + GAP }}>
                    <Text style={styles.mesLabel}>{mesLabelDaColuna(semana) ?? ''}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.semanasRow}>
                {semanas.map((semana, i) => (
                  <View key={i} style={{ marginRight: GAP }}>
                    {semana.map((data, j) => {
                      const futura = data > hoje
                      const iso = paraISO(data)
                      const marcado = diasMarcados.includes(iso)
                      return (
                        <View
                          key={j}
                          style={[styles.celula, marcado && styles.celulaAcesa, futura && styles.celulaFutura]}
                        />
                      )
                    })}
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>

        <View style={styles.resumo}>
          <Text style={styles.resumoNumero}>{diasMarcados.length}</Text>
          <Text style={styles.resumoLabel}>dias nas últimas {SEMANAS_VISIVEIS} semanas</Text>
        </View>

        <View style={styles.treinosSecao}>
          <View style={styles.secaoHeader}>
            <Text style={styles.secaoTitulo}>meus treinos</Text>
            <TouchableOpacity onPress={() => setCriandoTreino(!criandoTreino)}>
              <Text style={styles.addBtn}>{criandoTreino ? '×' : '+'}</Text>
            </TouchableOpacity>
          </View>

          {criandoTreino && (
            <View style={styles.formTreino}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="nome do treino (ex: Superiores)"
                placeholderTextColor={cores.textoSuave}
                value={novoTreinoNome}
                onChangeText={setNovoTreinoNome}
                onSubmitEditing={criarNovoTreino}
              />
              <TouchableOpacity style={styles.salvarBtn} onPress={criarNovoTreino}>
                <Text style={styles.salvarTxt}>criar</Text>
              </TouchableOpacity>
            </View>
          )}

          {treinos.length === 0 ? (
            <Text style={styles.vazio}>nenhum treino cadastrado ainda</Text>
          ) : (
            treinos.map((treino) => {
              const exercicios = exerciciosPorTreino[treino.id] ?? []
              const aberto = treinoAberto === treino.id
              return (
                <View key={treino.id} style={styles.treinoCard}>
                  <TouchableOpacity
                    style={styles.treinoHeader}
                    onPress={() => setTreinoAberto(aberto ? null : treino.id)}
                    onLongPress={() => setTreinoParaExcluir({ id: treino.id, nome: treino.nome })}
                  >
                    <Text style={styles.treinoNome}>{treino.nome}</Text>
                    <Text style={styles.treinoContagem}>
                      {exercicios.length} exercício{exercicios.length !== 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>

                  {aberto && (
                    <View style={styles.exerciciosLista}>
                      {exercicios.map((ex) => (
                        <TouchableOpacity
                          key={ex.id}
                          style={styles.exercicioLinha}
                          onPress={() => setNotasEditando({ id: ex.id, valor: ex.notas ?? '' })}
                          onLongPress={() => handleRemoverExercicio(ex.id)}
                        >
                          <Text style={styles.exercicioNome}>{ex.nome}</Text>
                          {ex.notas ? <Text style={styles.exercicioNotas}>{ex.notas}</Text> : null}
                        </TouchableOpacity>
                      ))}

                      {notasEditando && exercicios.some((e) => e.id === notasEditando.id) && (
                        <View style={styles.notasRow}>
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="ex: 3x12, 20kg"
                            placeholderTextColor={cores.textoSuave}
                            value={notasEditando.valor}
                            onChangeText={(v) => setNotasEditando({ ...notasEditando, valor: v })}
                            onSubmitEditing={salvarNotas}
                          />
                          <TouchableOpacity style={styles.salvarBtn} onPress={salvarNotas}>
                            <Text style={styles.salvarTxt}>ok</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.addExercicioBtn}
                        onPress={() => setModalExercicioTreinoId(treino.id)}
                      >
                        <Text style={styles.addExercicioTxt}>+ adicionar exercício</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )
            })
          )}
        </View>
      </ScrollView>

      <SugestaoExercicioModal
        visivel={modalExercicioTreinoId !== null}
        jaAdicionados={
          modalExercicioTreinoId ? (exerciciosPorTreino[modalExercicioTreinoId] ?? []).map((e) => e.nome) : []
        }
        onFechar={() => setModalExercicioTreinoId(null)}
        onEscolher={escolherExercicio}
      />

      <ConfirmModal
        visivel={treinoParaExcluir !== null}
        titulo="excluir treino?"
        mensagem={`"${treinoParaExcluir?.nome}" e todos os seus exercícios serão apagados.`}
        onCancelar={() => setTreinoParaExcluir(null)}
        onConfirmar={confirmarExclusaoTreino}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  scrollContent: { paddingTop: 8, paddingHorizontal: 24, paddingBottom: 60 },
  titulo: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.titulo, marginBottom: 24 },
  gridRow: { flexDirection: 'row' },
  mesesRow: { flexDirection: 'row' },
  mesLabel: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: 10, height: 16 },
  semanasRow: { flexDirection: 'row' },
  celula: { width: CELULA, height: CELULA, marginBottom: GAP, borderRadius: 3, backgroundColor: cores.apagado },
  celulaAcesa: { backgroundColor: cores.acento },
  celulaFutura: { opacity: 0 },
  diasSemana: { marginRight: 8, justifyContent: 'flex-start' },
  diaLabel: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: 10, height: CELULA + GAP, textAlignVertical: 'center' },
  resumo: { alignItems: 'center', marginTop: 32, marginBottom: 40 },
  resumoNumero: { color: cores.acento, fontFamily: fontes.numero, fontSize: 36 },
  resumoLabel: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub, marginTop: 4 },
  treinosSecao: {},
  secaoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  secaoTitulo: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.corpo },
  addBtn: { color: cores.acento, fontSize: 28, lineHeight: 28 },
  formTreino: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  input: {
    backgroundColor: cores.fundoInput, color: cores.texto, fontFamily: fontes.corpo,
    fontSize: tamanhos.corpo, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
  },
  salvarBtn: { backgroundColor: cores.acento, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8 },
  salvarTxt: { color: cores.fundo, fontFamily: fontes.corpo, fontSize: tamanhos.sub, fontWeight: '600' },
  vazio: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub, textAlign: 'center', marginTop: 20 },
  treinoCard: { backgroundColor: cores.fundoCartao, borderRadius: 10, marginBottom: 12, overflow: 'hidden' },
  treinoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  treinoNome: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.corpo, fontWeight: '600' },
  treinoContagem: { color: cores.textoSuave, fontFamily: fontes.numero, fontSize: tamanhos.sub },
  exerciciosLista: { paddingHorizontal: 16, paddingBottom: 16 },
  exercicioLinha: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: cores.fundoInput },
  exercicioNome: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.sub },
  exercicioNotas: { color: cores.acento, fontFamily: fontes.numero, fontSize: 11, marginTop: 2 },
  notasRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  addExercicioBtn: { borderWidth: 1, borderColor: cores.acento, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 12 },
  addExercicioTxt: { color: cores.acento, fontFamily: fontes.corpo, fontSize: tamanhos.sub, fontWeight: '600' },
})