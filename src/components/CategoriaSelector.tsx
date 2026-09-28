
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { cores } from '../theme/colors'
import { fontes, tamanhos } from '../theme/fonts'
import { ORDEM_CATEGORIAS, nomeCategoria } from '../data/categorias'


type Props = {
  valor: string
  onChange: (tipo: string) => void
}


export default function CategoriaSelector({ valor, onChange }: Props) {
  return (
    <View>
      <Text style={styles.label}>categoria</Text>

      <View style={styles.opcoes}>
        {ORDEM_CATEGORIAS.map(tipo => (
          <TouchableOpacity
            key={tipo}
            style={[styles.pill, valor === tipo && styles.pillAtiva]}
            onPress={() => onChange(tipo)}
          >
            <Text style={[styles.pillTexto, valor === tipo && styles.pillTextoAtivo]}>
              {nomeCategoria(tipo)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
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
})
