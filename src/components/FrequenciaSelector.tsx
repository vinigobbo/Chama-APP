import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { cores } from '../theme/colors'
import { fontes, tamanhos } from '../theme/fonts'

export type FrequenciaValor = {
  tipo: 'diario' | 'semana' | 'intervalo'
  dias: number[]
}

type Props = {
  valor: FrequenciaValor
  onChange: (novo: FrequenciaValor) => void
}

const OPCOES = [
  { tipo: 'diario' as const, label: 'todo dia' },
  { tipo: 'semana' as const, label: 'dias da semana' },
  { tipo: 'intervalo' as const, label: 'dia sim, dia não' },
]

const LETRAS_DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export default function FrequenciaSelector({ valor, onChange }: Props) {
  function toggleDia(dia: number) {
    const jaTem = valor.dias.includes(dia)
    const novosDias = jaTem
      ? valor.dias.filter(d => d !== dia)
      : [...valor.dias, dia].sort()
    onChange({ ...valor, dias: novosDias })
  }

  return (
    <View>
      <Text style={styles.label}>frequência</Text>

      <View style={styles.opcoes}>
        {OPCOES.map(op => (
          <TouchableOpacity
            key={op.tipo}
            style={[styles.pill, valor.tipo === op.tipo && styles.pillAtiva]}
            onPress={() => onChange({ tipo: op.tipo, dias: valor.dias })}
          >
            <Text style={[styles.pillTexto, valor.tipo === op.tipo && styles.pillTextoAtivo]}>
              {op.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {valor.tipo === 'semana' && (
        <View style={styles.diasRow}>
          {LETRAS_DIAS.map((letra, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.diaBtn, valor.dias.includes(i) && styles.diaBtnAtivo]}
              onPress={() => toggleDia(i)}
            >
              <Text style={[styles.diaTexto, valor.dias.includes(i) && styles.diaTextoAtivo]}>
                {letra}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {valor.tipo === 'intervalo' && (
        <Text style={styles.aviso}>
          começa amanhã e alterna a cada dia: hoje não conta, amanhã conta, depois folga, e assim por diante
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  label: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub, marginBottom: 8 },
  opcoes: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    borderWidth: 1, borderColor: cores.fundoInput, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  pillAtiva: { backgroundColor: cores.acento, borderColor: cores.acento },
  pillTexto: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: 12 },
  pillTextoAtivo: { color: cores.fundo, fontWeight: '600' },
  diasRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  diaBtn: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: cores.fundoInput,
    justifyContent: 'center', alignItems: 'center',
  },
  diaBtnAtivo: { backgroundColor: cores.acento, borderColor: cores.acento },
  diaTexto: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: 12 },
  diaTextoAtivo: { color: cores.fundo, fontWeight: '600' },
  aviso: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: 11, marginTop: 10, lineHeight: 16 },
})