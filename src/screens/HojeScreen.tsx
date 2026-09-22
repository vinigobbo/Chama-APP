import { useState, useCallback } from 'react'
import { View, Text, SectionList, TouchableOpacity, TextInput, StyleSheet } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { cores } from '../theme/colors'
import { fontes, tamanhos } from '../theme/fonts'
import { buscarHabitosAtivos, criarHabito, desativarHabito } from '../db/habitos'
import { buscarRegistrosDeHoje, marcarHabito, desmarcarHabito, calcularStreak } from '../db/registros'
import ConfirmModal from '../components/ConfirmModal'
import SugestaoHabitoModal from '../components/SugestaoHabitoModal'
import FrequenciaSelector, { FrequenciaValor } from '../components/FrequenciaSelector'
import CategoriaSelector from '../components/CategoriaSelector'
import { HabitoSugerido } from '../data/habitosSugeridos'
import { ORDEM_CATEGORIAS, nomeCategoria } from '../data/categorias'
import { dataReferenciaInicial } from '../utils/frequencia'
import { hojeISO } from '../utils/data'

function construirSecoes(habitos: any[]) {
  const grupos: Record<string, any[]> = {}
  habitos.forEach(h => {
    const tipo = ORDEM_CATEGORIAS.includes(h.tipo) ? h.tipo : 'geral'
    if (!grupos[tipo]) grupos[tipo] = []
    grupos[tipo].push(h)
  })
  return ORDEM_CATEGORIAS
    .filter(tipo => grupos[tipo]?.length)
    .map(tipo => ({ title: nomeCategoria(tipo), data: grupos[tipo] }))
}

export default function HojeScreen() {
  const [habitos, setHabitos] = useState<any[]>([])
  const [streak, setStreak] = useState(0)

  const [sugestaoVisivel, setSugestaoVisivel] = useState(false)
  const [criando, setCriando] = useState(false)
  const [formNome, setFormNome] = useState('')
  const [formEmoji, setFormEmoji] = useState('')
  const [formTipo, setFormTipo] = useState('geral')
  const [formPersonalizado, setFormPersonalizado] = useState(false)
  const [formFrequencia, setFormFrequencia] = useState<FrequenciaValor>({ tipo: 'diario', dias: [] })

  const [habitoParaExcluir, setHabitoParaExcluir] = useState<{ id: number; nome: string } | null>(null)

  async function carregarDados() {
    const lista = await buscarRegistrosDeHoje(hojeISO())
    setHabitos(lista)
    setStreak(await calcularStreak())
  }

  useFocusEffect(
    useCallback(() => {
      carregarDados()
    }, [])
  )

  async function toggleHabito(id: number, feitoAtual: number) {
    const hoje = hojeISO()
    if (feitoAtual) {
      await desmarcarHabito(id, hoje)
    } else {
      await marcarHabito(id, hoje)
    }
    await carregarDados()
  }

  function escolherSugestao(sugestao: HabitoSugerido | null) {
    if (sugestao) {
      setFormNome(sugestao.nome)
      setFormEmoji(sugestao.emoji)
      setFormTipo(sugestao.tipo)
      setFormPersonalizado(false)
    } else {
      setFormNome('')
      setFormEmoji('')
      setFormTipo('geral')
      setFormPersonalizado(true)
    }
    setFormFrequencia({ tipo: 'diario', dias: [] })
    setSugestaoVisivel(false)
    setCriando(true)
  }

  async function adicionarHabito() {
    const nome = formNome.trim()
    if (!nome) return
    if (formFrequencia.tipo === 'semana' && formFrequencia.dias.length === 0) return

    await criarHabito(
      nome,
      formEmoji.trim() || null,
      formTipo,
      formFrequencia.tipo,
      formFrequencia.tipo === 'semana' ? formFrequencia.dias : null,
      dataReferenciaInicial(formFrequencia.tipo, hojeISO())
    )

    cancelarCriacao()
    await carregarDados()
  }

  function cancelarCriacao() {
    setCriando(false)
    setFormNome('')
    setFormEmoji('')
    setFormTipo('geral')
    setFormPersonalizado(false)
    setFormFrequencia({ tipo: 'diario', dias: [] })
  }

  function pedirExclusao(id: number, nome: string) {
    setHabitoParaExcluir({ id, nome })
  }

  async function confirmarExclusao() {
    if (!habitoParaExcluir) return
    await desativarHabito(habitoParaExcluir.id)
    setHabitoParaExcluir(null)
    await carregarDados()
  }

  return (
    <View style={styles.container}>
      <Text style={styles.saudacao}>Olá, Vinicius</Text>

      <View style={styles.streakBox}>
        <Text style={styles.streakNumero}>{streak}</Text>
        <Text style={styles.streakLabel}>dias seguidos</Text>
      </View>

      <View style={styles.secao}>
        <View style={styles.secaoHeader}>
          <Text style={styles.secaoTitulo}>hábitos de hoje</Text>
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
                placeholder="nome do hábito"
                placeholderTextColor={cores.textoSuave}
                value={formNome}
                onChangeText={setFormNome}
              />
            </View>

            {formPersonalizado && <CategoriaSelector valor={formTipo} onChange={setFormTipo} />}

            <FrequenciaSelector valor={formFrequencia} onChange={setFormFrequencia} />

            <View style={styles.formBotoes}>
              <TouchableOpacity style={styles.cancelarBtn} onPress={cancelarCriacao}>
                <Text style={styles.cancelarTxt}>cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.salvarBtn} onPress={adicionarHabito}>
                <Text style={styles.salvarTxt}>salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {habitos.length === 0 ? (
          <Text style={styles.vazio}>nenhum hábito pra hoje</Text>
        ) : (
          <SectionList
            sections={construirSecoes(habitos)}
            keyExtractor={item => String(item.id)}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <Text style={styles.categoriaTitulo}>{section.title}</Text>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.habitoRow}
                onPress={() => toggleHabito(item.id, item.feito)}
                onLongPress={() => pedirExclusao(item.id, item.nome)}
              >
                <View style={[styles.marcador, item.feito === 1 && styles.marcadorAceso]} />
                <Text style={[styles.habitoNome, item.feito === 1 && styles.habitoFeito]}>
                  {item.emoji ? `${item.emoji}  ` : ''}{item.nome}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <SugestaoHabitoModal
        visivel={sugestaoVisivel}
        onFechar={() => setSugestaoVisivel(false)}
        onEscolher={escolherSugestao}
      />

      <ConfirmModal
        visivel={habitoParaExcluir !== null}
        titulo="excluir hábito?"
        mensagem={`"${habitoParaExcluir?.nome}" será removido da lista. O histórico de dias já marcados fica preservado.`}
        onCancelar={() => setHabitoParaExcluir(null)}
        onConfirmar={confirmarExclusao}
      />
    </View>
  )
}

//poggers

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo, paddingTop: 8, paddingHorizontal: 24 },
  saudacao: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.corpo, marginBottom: 20 },
  streakBox: { alignItems: 'center', marginBottom: 32 },
  streakNumero: { color: cores.acento, fontFamily: fontes.numero, fontSize: tamanhos.streak },
  streakLabel: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub, marginTop: 4 },
  secao: { flex: 1 },
  secaoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  secaoTitulo: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.corpo },
  addBtn: { color: cores.acento, fontSize: 28, lineHeight: 28 },
  form: { gap: 12, marginBottom: 20, backgroundColor: cores.fundoCartao, borderRadius: 12, padding: 16 },
  formRow: { flexDirection: 'row', gap: 10 },
  emojiInput: {
    backgroundColor: cores.fundoInput, color: cores.texto, fontSize: 20,
    width: 52, textAlign: 'center', borderRadius: 8,
  },
  input: {
    backgroundColor: cores.fundoInput, color: cores.texto, fontFamily: fontes.corpo,
    fontSize: tamanhos.corpo, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
  },
  formBotoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  cancelarBtn: { paddingVertical: 12, paddingHorizontal: 4 },
  cancelarTxt: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub },
  salvarBtn: { backgroundColor: cores.acento, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  salvarTxt: { color: cores.fundo, fontFamily: fontes.corpo, fontSize: tamanhos.sub, fontWeight: '600' },
  vazio: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub, textAlign: 'center', marginTop: 40 },
  categoriaTitulo: {
    color: cores.acento, fontFamily: fontes.corpo, fontSize: 11,
    fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase',
    marginTop: 14, marginBottom: 6,
  },
  habitoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: cores.fundoInput,
  },
  marcador: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: cores.textoSuave },
  marcadorAceso: { backgroundColor: cores.acento, borderColor: cores.acento },
  habitoNome: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.corpo },
  habitoFeito: { color: cores.textoSuave },
})
