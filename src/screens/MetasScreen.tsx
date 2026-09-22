import { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { cores } from '../theme/colors'
import { fontes, tamanhos } from '../theme/fonts'
import { buscarMetas, criarMeta, buscarUltimoProgresso, registrarProgresso, excluirMeta } from '../db/metas'
import { MetaSugerida } from '../data/metasSugeridas'
import SugestaoMetaModal from '../components/SugestaoMetaModal'
import ConfirmModal from '../components/ConfirmModal'
import PeriodoSelector from '../components/PeriodoSelector'
import { Periodo, calcularDataFim } from '../utils/periodos'
import { hojeISO } from '../utils/data'

function diasRestantes(dataFim: string) {
  const hoje = new Date()
  const fim = new Date(dataFim + 'T00:00:00')
  const diff = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

export default function MetasScreen() {
  const [metas, setMetas] = useState<any[]>([])
  const [metaAberta, setMetaAberta] = useState<number | null>(null)
  const [novoValor, setNovoValor] = useState('')

  const [sugestaoVisivel, setSugestaoVisivel] = useState(false)
  const [criando, setCriando] = useState(false)
  const [formNome, setFormNome] = useState('')
  const [formTipo, setFormTipo] = useState('geral')
  const [formEmoji, setFormEmoji] = useState('')
  const [formAlvo, setFormAlvo] = useState('')
  const [formUnidade, setFormUnidade] = useState('')
  const [formPeriodo, setFormPeriodo] = useState<Periodo>('semestral')

  const [metaParaExcluir, setMetaParaExcluir] = useState<{ id: number; nome: string } | null>(null)

  async function carregarDados() {
    const lista = await buscarMetas()
    const comProgresso = await Promise.all(
      lista.map(async (m) => {
        const ultimo = await buscarUltimoProgresso(m.id)
        return {
          ...m,
          valorAtual: ultimo ? ultimo.valor : 0,
          dias: diasRestantes(m.data_fim),
        }
      })
    )
    setMetas(comProgresso)
  }

  useFocusEffect(
    useCallback(() => {
      carregarDados()
    }, [])
  )

  async function salvarProgresso(metaId: number) {
    const valor = parseFloat(novoValor)
    if (isNaN(valor)) return
    await registrarProgresso(metaId, hojeISO(), valor)
    setNovoValor('')
    setMetaAberta(null)
    await carregarDados()
  }

  function escolherSugestao(sugestao: MetaSugerida | null) {
    if (sugestao) {
      setFormNome(sugestao.nome)
      setFormTipo(sugestao.tipo)
      setFormEmoji(sugestao.emoji)
    } else {
      setFormNome('')
      setFormTipo('geral')
      setFormEmoji('')
    }
    setSugestaoVisivel(false)
    setCriando(true)
  }

  async function adicionarMeta() {
    const alvo = parseFloat(formAlvo)
    if (!formNome.trim() || isNaN(alvo)) return
    const hoje = hojeISO()
    await criarMeta(
      formNome.trim(),
      formTipo.trim() || 'geral',
      formEmoji.trim() || null,
      alvo,
      formUnidade.trim() || null,
      hoje,
      calcularDataFim(formPeriodo, hoje)
    )
    cancelarCriacao()
    await carregarDados()
  }

  function cancelarCriacao() {
    setCriando(false)
    setFormNome('')
    setFormTipo('geral')
    setFormEmoji('')
    setFormAlvo('')
    setFormUnidade('')
    setFormPeriodo('semestral')
  }

  async function confirmarExclusaoMeta() {
    if (!metaParaExcluir) return
    await excluirMeta(metaParaExcluir.id)
    setMetaParaExcluir(null)
    await carregarDados()
  }

  function progresso(atual: number, alvo: number) {
    if (alvo === 0) return 0
    return Math.min((atual / alvo) * 100, 100)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titulo}>metas</Text>
        <TouchableOpacity onPress={() => setSugestaoVisivel(true)}>
          <Text style={styles.addBtn}>+</Text>
        </TouchableOpacity>
      </View>

      {criando && (
        <View style={styles.form}>
          <View style={styles.formRow}>
            <TextInput
              style={styles.emojiInput}
              placeholder="🎯"
              placeholderTextColor={cores.textoSuave}
              value={formEmoji}
              onChangeText={setFormEmoji}
              maxLength={4}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="nome da meta"
              placeholderTextColor={cores.textoSuave}
              value={formNome}
              onChangeText={setFormNome}
            />
          </View>
          <View style={styles.formRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="valor alvo"
              placeholderTextColor={cores.textoSuave}
              value={formAlvo}
              onChangeText={setFormAlvo}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="unidade (kg, R$...)"
              placeholderTextColor={cores.textoSuave}
              value={formUnidade}
              onChangeText={setFormUnidade}
            />
          </View>
          <PeriodoSelector
            valor={formPeriodo}
            dataFim={calcularDataFim(formPeriodo, hojeISO())}
            onChange={setFormPeriodo}
          />
          <View style={styles.formBotoes}>
            <TouchableOpacity style={styles.cancelarBtn} onPress={cancelarCriacao}>
              <Text style={styles.cancelarTxt}>cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.salvarBtn} onPress={adicionarMeta}>
              <Text style={styles.salvarTxt}>criar meta</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {metas.length === 0 ? (
        <Text style={styles.vazio}>nenhuma meta cadastrada ainda</Text>
      ) : (
        <FlatList
          data={metas}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setMetaAberta(metaAberta === item.id ? null : item.id)}
              onLongPress={() => setMetaParaExcluir({ id: item.id, nome: item.nome })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardNome}>{item.emoji ? `${item.emoji}  ` : ''}{item.nome}</Text>
                <Text style={[styles.cardDias, item.dias < 0 && { color: cores.erro }]}>
                  {item.dias >= 0 ? `faltam ${item.dias} dias` : 'encerrada'}
                </Text>
              </View>

              <View style={styles.barraFundo}>
                <View style={[styles.barraProgresso, { width: `${progresso(item.valorAtual, item.valor_alvo)}%` }]} />
              </View>

              <Text style={styles.cardValor}>
                {item.valorAtual} / {item.valor_alvo} {item.unidade || ''}
              </Text>

              {metaAberta === item.id && (
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="valor atual"
                    placeholderTextColor={cores.textoSuave}
                    value={novoValor}
                    onChangeText={setNovoValor}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity style={styles.salvarBtn} onPress={() => salvarProgresso(item.id)}>
                    <Text style={styles.salvarTxt}>salvar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <SugestaoMetaModal
        visivel={sugestaoVisivel}
        onFechar={() => setSugestaoVisivel(false)}
        onEscolher={escolherSugestao}
      />

      <ConfirmModal
        visivel={metaParaExcluir !== null}
        titulo="excluir meta?"
        mensagem={`"${metaParaExcluir?.nome}" e todo o histórico de progresso serão apagados. Essa ação não pode ser desfeita.`}
        onCancelar={() => setMetaParaExcluir(null)}
        onConfirmar={confirmarExclusaoMeta}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo, paddingTop: 8, paddingHorizontal: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  titulo: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.titulo },
  addBtn: { color: cores.acento, fontSize: 28, lineHeight: 28 },
  form: { gap: 10, marginBottom: 24 },
  formRow: { flexDirection: 'row', gap: 10 },
  emojiInput: {
    backgroundColor: cores.fundoInput, color: cores.texto, fontSize: 20,
    width: 52, textAlign: 'center', borderRadius: 8,
  },
  input: {
    backgroundColor: cores.fundoInput, color: cores.texto, fontFamily: fontes.corpo,
    fontSize: tamanhos.corpo, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
  },
  formBotoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 4 },
  cancelarBtn: { paddingVertical: 12, paddingHorizontal: 4 },
  cancelarTxt: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub },
  salvarBtn: { backgroundColor: cores.acento, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  salvarTxt: { color: cores.fundo, fontFamily: fontes.corpo, fontSize: tamanhos.sub, fontWeight: '600' },
  vazio: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: cores.fundoCartao, borderRadius: 10, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardNome: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.corpo },
  cardDias: { color: cores.textoSuave, fontFamily: fontes.numero, fontSize: tamanhos.sub },
  barraFundo: { height: 6, backgroundColor: cores.apagado, borderRadius: 3, marginBottom: 8 },
  barraProgresso: { height: 6, backgroundColor: cores.acento, borderRadius: 3 },
  cardValor: { color: cores.textoSuave, fontFamily: fontes.numero, fontSize: tamanhos.sub },
  inputRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
})