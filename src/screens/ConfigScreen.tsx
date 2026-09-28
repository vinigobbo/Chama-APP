import { useState, useCallback } from 'react'
import { View, Text, Switch, TouchableOpacity, TextInput, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { cores } from '../theme/colors'
import { fontes, tamanhos } from '../theme/fonts'
import { buscarConfig, salvarConfig } from '../db/config'
import { pedirPermissao, agendarLembrete, cancelarLembrete, notificacoesDisponiveis } from '../notifications/scheduler'
import { calcularStreak, calcularMaiorStreak, contarHabitosConcluidos } from '../db/registros'
import { contarMetasConcluidas } from '../db/metas'
import { mascararChave, obterChaveGemini, removerChaveGemini, salvarChaveGemini } from '../ai/chave'
import { ErroVisao, testarChave } from '../ai/visao'
import ConfirmModal from '../components/ConfirmModal'

type TesteChave = { estado: 'testando' } | { estado: 'ok' } | { estado: 'erro'; mensagem: string } | null

export default function ConfigScreen() {
  const [lembreteAtivo, setLembreteAtivo] = useState(false)
  // false no Expo Go, onde expo-notifications não roda
  const [notificacoes] = useState(notificacoesDisponiveis)
  const [horario, setHorario] = useState('13:00')
  const [editando, setEditando] = useState(false)
  const [estatisticas, setEstatisticas] = useState({
    habitosConcluidos: 0,
    metasConcluidas: 0,
    streakAtual: 0,
    maiorStreak: 0,
  })

  const [chaveSalva, setChaveSalva] = useState<string | null>(null)
  const [novaChave, setNovaChave] = useState('')
  const [testeChave, setTesteChave] = useState<TesteChave>(null)
  const [confirmarRemocao, setConfirmarRemocao] = useState(false)

  async function carregarChave() {
    try {
      const chave = await obterChaveGemini()
      setChaveSalva(chave ? mascararChave(chave) : null)
    } catch (e) {
      setChaveSalva(null)
    }
  }

  async function guardarChave() {
    const chave = novaChave.trim()
    if (!chave) return
    try {
      await salvarChaveGemini(chave)
      setNovaChave('')
      setTesteChave(null)
      await carregarChave()
    } catch (e) {
      Alert.alert('não deu pra salvar a chave', 'o armazenamento seguro do aparelho não respondeu')
    }
  }

  async function verificarChave() {
    setTesteChave({ estado: 'testando' })
    try {
      const chave = await obterChaveGemini()
      await testarChave(chave ?? '')
      setTesteChave({ estado: 'ok' })
    } catch (e) {
      const mensagem = e instanceof ErroVisao ? e.message : 'não deu pra testar a chave agora'
      setTesteChave({ estado: 'erro', mensagem })
    }
  }

  async function apagarChave() {
    setConfirmarRemocao(false)
    try {
      await removerChaveGemini()
    } finally {
      setTesteChave(null)
      await carregarChave()
    }
  }

  async function carregarDados() {
    carregarChave()
    const ativo = await buscarConfig('lembrete_ativo')
    const hora = await buscarConfig('horario_lembrete')
    setLembreteAtivo(ativo === '1')
    if (hora) setHorario(hora)

    setEstatisticas({
      habitosConcluidos: await contarHabitosConcluidos(),
      metasConcluidas: await contarMetasConcluidas(),
      streakAtual: await calcularStreak(),
      maiorStreak: await calcularMaiorStreak(),
    })
  }

  useFocusEffect(
    useCallback(() => {
      carregarDados()
    }, [])
  )

  async function toggleLembrete(valor: boolean) {
    if (valor) {
      const permitido = await pedirPermissao()
      if (!permitido) {
        Alert.alert('permissão negada', 'ative as notificações nas configurações do celular pra usar o lembrete')
        return
      }
      await agendarLembrete(horario)
    } else {
      await cancelarLembrete()
    }
    setLembreteAtivo(valor)
    await salvarConfig('lembrete_ativo', valor ? '1' : '0')
  }

  async function salvarHorario() {
    const regex = /^([01]\d|2[0-3]):([0-5]\d)$/
    if (!regex.test(horario)) {
      Alert.alert('formato inválido', 'use o formato HH:MM (ex: 13:00)')
      return
    }
    await salvarConfig('horario_lembrete', horario)
    if (lembreteAtivo) {
      await agendarLembrete(horario)
    }
    setEditando(false)
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.linha}>
          <Text style={styles.label}>lembrete diário</Text>
          <Switch
            value={lembreteAtivo}
            onValueChange={toggleLembrete}
            disabled={!notificacoes}
            trackColor={{ false: cores.apagado, true: cores.acentoSuave }}
            thumbColor={lembreteAtivo ? cores.acento : cores.textoSuave}
          />
        </View>
        {!notificacoes && (
          <Text style={styles.notificacoesIndisponiveis}>lembretes não funcionam no expo go; use o build instalado</Text>
        )}

        {lembreteAtivo && (
          <View style={styles.linha}>
            <Text style={styles.label}>horário</Text>
            {editando ? (
              <View style={styles.horarioRow}>
                <TextInput
                  style={styles.horarioInput}
                  value={horario}
                  onChangeText={setHorario}
                  placeholder="HH:MM"
                  placeholderTextColor={cores.textoSuave}
                  keyboardType="numeric"
                  maxLength={5}
                />
                <TouchableOpacity onPress={salvarHorario}>
                  <Text style={styles.salvarTxt}>ok</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setEditando(true)}>
                <Text style={styles.horarioValor}>{horario}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <Text style={styles.secaoTitulo}>estatísticas</Text>
      <View style={styles.card}>
        {[
          ['hábitos concluídos', estatisticas.habitosConcluidos],
          ['metas concluídas', estatisticas.metasConcluidas],
          ['streak atual', estatisticas.streakAtual],
          ['maior streak', estatisticas.maiorStreak],
        ].map(([label, valor]) => (
          <View key={label} style={styles.linha}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.estatisticaValor}>{valor}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.secaoTitulo}>alimentação (IA)</Text>
      <View style={styles.card}>
        {chaveSalva ? (
          <>
            <View style={styles.linha}>
              <Text style={styles.label}>chave do Gemini</Text>
              <Text style={styles.chaveMascara}>{chaveSalva}</Text>
            </View>
            <View style={styles.chaveBotoes}>
              <TouchableOpacity
                style={styles.chaveBtn}
                onPress={verificarChave}
                disabled={testeChave?.estado === 'testando'}
              >
                {testeChave?.estado === 'testando'
                  ? <ActivityIndicator color={cores.acento} size="small" />
                  : <Text style={styles.chaveBtnTxt}>testar chave</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.removerBtn} onPress={() => setConfirmarRemocao(true)}>
                <Text style={styles.removerTxt}>remover</Text>
              </TouchableOpacity>
            </View>
            {testeChave?.estado === 'ok' && <Text style={styles.testeOk}>chave funcionando</Text>}
            {testeChave?.estado === 'erro' && <Text style={styles.testeErro}>{testeChave.mensagem}</Text>}
          </>
        ) : (
          <>
            <Text style={styles.chaveDica}>cole a sua chave de API do Gemini (aistudio.google.com)</Text>
            <View style={styles.chaveRow}>
              <TextInput
                style={styles.chaveInput}
                value={novaChave}
                onChangeText={setNovaChave}
                placeholder="chave de API"
                placeholderTextColor={cores.textoSuave}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                importantForAutofill="no"
              />
              <TouchableOpacity
                style={[styles.salvarChaveBtn, !novaChave.trim() && styles.desabilitado]}
                disabled={!novaChave.trim()}
                onPress={guardarChave}
              >
                <Text style={styles.salvarChaveTxt}>salvar</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
      <Text style={styles.avisoIA}>
        a foto é enviada ao Google (Gemini) pra identificar os alimentos. no plano gratuito, o Google pode usar o
        conteúdo pra melhorar os produtos dele e revisores humanos podem lê-lo; no plano pago, não. a chave fica
        guardada só neste aparelho.
      </Text>

      <View style={styles.sobre}>
        <Text style={styles.sobreTexto}>chama v1.0</Text>
        <Text style={styles.sobreTexto}>dados salvos apenas no seu celular</Text>
        <Text style={styles.fonteTaco}>
          valores nutricionais: Tabela Brasileira de Composição de Alimentos – TACO, 4ª ed., NEPA/UNICAMP, 2011
        </Text>
      </View>

      <ConfirmModal
        visivel={confirmarRemocao}
        titulo="remover a chave?"
        mensagem="a identificação por foto para de funcionar até você colar uma chave de novo. o registro manual continua."
        textoConfirmar="remover"
        onCancelar={() => setConfirmarRemocao(false)}
        onConfirmar={apagarChave}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  scrollContent: { paddingTop: 16, paddingHorizontal: 24, paddingBottom: 40 },
  card: { backgroundColor: cores.fundoCartao, borderRadius: 10, padding: 16 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  label: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.corpo },
  horarioRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  horarioInput: {
    backgroundColor: cores.fundoInput, color: cores.texto, fontFamily: fontes.numero,
    fontSize: tamanhos.corpo, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    width: 70, textAlign: 'center',
  },
  horarioValor: { color: cores.acento, fontFamily: fontes.numero, fontSize: tamanhos.corpo },
  salvarTxt: { color: cores.acento, fontFamily: fontes.corpo, fontSize: tamanhos.corpo, fontWeight: '600' },
  secaoTitulo: {
    color: cores.acento, fontFamily: fontes.corpo, fontSize: 11,
    fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase',
    marginTop: 24, marginBottom: 8,
  },
  estatisticaValor: { color: cores.acento, fontFamily: fontes.numero, fontSize: tamanhos.corpo },
  sobre: { marginTop: 40, alignItems: 'center', gap: 4 },
  sobreTexto: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub },
  notificacoesIndisponiveis: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: 11, marginTop: -4, marginBottom: 8 },
  fonteTaco: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 16 },
  chaveMascara: { color: cores.acento, fontFamily: fontes.numero, fontSize: tamanhos.corpo },
  chaveBotoes: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16, paddingTop: 4 },
  chaveBtn: { borderWidth: 1, borderColor: cores.acento, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, minWidth: 110, alignItems: 'center' },
  chaveBtnTxt: { color: cores.acento, fontFamily: fontes.corpo, fontSize: tamanhos.sub, fontWeight: '600' },
  removerBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  removerTxt: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub },
  testeOk: { color: cores.acento, fontFamily: fontes.corpo, fontSize: tamanhos.sub, marginTop: 10 },
  testeErro: { color: cores.erro, fontFamily: fontes.corpo, fontSize: tamanhos.sub, marginTop: 10, lineHeight: 18 },
  chaveDica: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub, marginBottom: 10 },
  chaveRow: { flexDirection: 'row', gap: 10 },
  chaveInput: {
    flex: 1, backgroundColor: cores.fundoInput, color: cores.texto, fontFamily: fontes.numero,
    fontSize: tamanhos.sub, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
  },
  salvarChaveBtn: { backgroundColor: cores.acento, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8 },
  salvarChaveTxt: { color: cores.fundo, fontFamily: fontes.corpo, fontSize: tamanhos.sub, fontWeight: '600' },
  desabilitado: { opacity: 0.4 },
  avisoIA: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: 11, lineHeight: 16, marginTop: 8 },
})
