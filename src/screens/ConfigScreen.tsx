import { useState, useCallback } from 'react'
import { View, Text, Switch, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { cores } from '../theme/colors'
import { fontes, tamanhos } from '../theme/fonts'
import { buscarConfig, salvarConfig } from '../db/config'
import { pedirPermissao, agendarLembrete, cancelarLembrete } from '../notifications/scheduler'
import { calcularStreak, calcularMaiorStreak, contarHabitosConcluidos } from '../db/registros'
import { contarMetasConcluidas } from '../db/metas'

export default function ConfigScreen() {
  const [lembreteAtivo, setLembreteAtivo] = useState(false)
  const [horario, setHorario] = useState('13:00')
  const [editando, setEditando] = useState(false)
  const [estatisticas, setEstatisticas] = useState({
    habitosConcluidos: 0,
    metasConcluidas: 0,
    streakAtual: 0,
    maiorStreak: 0,
  })

  async function carregarDados() {
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
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.linha}>
          <Text style={styles.label}>lembrete diário</Text>
          <Switch
            value={lembreteAtivo}
            onValueChange={toggleLembrete}
            trackColor={{ false: cores.apagado, true: cores.acentoSuave }}
            thumbColor={lembreteAtivo ? cores.acento : cores.textoSuave}
          />
        </View>

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

      <View style={styles.sobre}>
        <Text style={styles.sobreTexto}>chama v1.0</Text>
        <Text style={styles.sobreTexto}>dados salvos apenas no seu celular</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo, paddingTop: 16, paddingHorizontal: 24 },
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
})
