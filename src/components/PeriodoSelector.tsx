import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { cores } from '../theme/colors'
import { fontes, tamanhos } from '../theme/fonts'
import { Periodo } from '../utils/periodos'

type Props = {
  valor: Periodo
  dataFim: string
  onChange: (novo: Periodo) => void
}

const OPCOES: Array<{ tipo: Periodo; label: string }> = [
  { tipo: 'mensal', label: 'mensal' },
  { tipo: 'trimestral', label: 'trimestral' },
  { tipo: 'semestral', label: 'semestral' },
  { tipo: 'anual', label: 'anual' },
]

function formatarData(dataISO: string) {
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function PeriodoSelector({ valor, dataFim, onChange }: Props) {
  return (
    <View>
      <Text style={styles.label}>período</Text>

      <View style={styles.opcoes}>
        {OPCOES.map(op => (
          <TouchableOpacity
            key={op.tipo}
            style={[styles.pill, valor === op.tipo && styles.pillAtiva]}
            onPress={() => onChange(op.tipo)}
          >
            <Text style={[styles.pillTexto, valor === op.tipo && styles.pillTextoAtivo]}>
              {op.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.aviso}>termina em {formatarData(dataFim)}</Text>
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
  aviso: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: 11, marginTop: 10, lineHeight: 16 },
})
