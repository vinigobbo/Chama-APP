import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { cores } from '../theme/colors'
import { fontes, tamanhos } from '../theme/fonts'
import { formatarDecimal } from '../utils/nutricao'
import { ItemRascunho, MacrosManuais, calcularRascunho } from '../utils/rascunhoRefeicao'

type Props = {
  item: ItemRascunho
  rotuloNome?: string // ex: "a IA identificou"
  onChangePeso: (texto: string) => void
  onChangeManual: (manual: MacrosManuais) => void
  onTrocar: () => void
  onRemover: () => void
}

const CAMPOS_MANUAIS: Array<[keyof MacrosManuais, string]> = [
  ['calorias', 'kcal'],
  ['proteina', 'prot. g'],
  ['carboidrato', 'carb. g'],
  ['gordura', 'gord. g'],
]

export default function ItemRefeicaoCard({ item, rotuloNome, onChangePeso, onChangeManual, onTrocar, onRemover }: Props) {
  const c = calcularRascunho(item)
  const semTabela = item.alimento === null
  const destacado = c.exigeManual && !c.pronto
  const mostrarNome = semTabela || item.alimento!.nome !== item.nome

  // macro que a tabela não tem aparece como "–" (e conta 0 no total)
  const macro = (campo: 'proteina' | 'carboidrato' | 'gordura') =>
    !c.exigeManual && item.alimento && item.alimento[campo] === null ? '–' : formatarDecimal(c[campo])

  return (
    <View style={[styles.card, destacado && styles.cardDestacado]}>
      <View style={styles.topo}>
        <View style={{ flex: 1 }}>
          {mostrarNome && (
            <>
              {rotuloNome ? <Text style={styles.rotulo}>{rotuloNome}</Text> : null}
              <Text style={styles.nome}>{item.nome || 'item sem nome'}</Text>
            </>
          )}
          <TouchableOpacity style={styles.tabelaBtn} onPress={onTrocar}>
            <Text style={[styles.tabelaTxt, semTabela && styles.semTabelaTxt]} numberOfLines={2}>
              {semTabela ? 'sem correspondência na tabela · escolher' : item.alimento!.nome}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={semTabela ? cores.acento : cores.textoSuave} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={onRemover} hitSlop={10} accessibilityLabel="remover item">
          <Ionicons name="close" size={20} color={cores.textoSuave} />
        </TouchableOpacity>
      </View>

      <View style={styles.pesoRow}>
        <Text style={styles.pesoLabel}>peso</Text>
        <TextInput
          style={styles.pesoInput}
          value={item.pesoTexto}
          onChangeText={onChangePeso}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={cores.textoSuave}
          maxLength={6}
        />
        <Text style={styles.pesoLabel}>g</Text>
        <View style={{ flex: 1 }} />
        <Text style={[styles.kcal, c.calorias === null && styles.kcalVazio]}>
          {c.calorias === null ? '–' : formatarDecimal(c.calorias, 0)} kcal
        </Text>
      </View>

      {c.exigeManual ? (
        <View style={styles.manual}>
          <Text style={styles.aviso}>
            {semTabela
              ? 'informe os valores deste item (total da porção)'
              : 'a tabela não tem as calorias deste alimento: informe os valores do item (total da porção)'}
          </Text>
          <View style={styles.manualRow}>
            {CAMPOS_MANUAIS.map(([campo, rotulo]) => (
              <View key={campo} style={styles.manualCampo}>
                <TextInput
                  style={styles.manualInput}
                  value={item.manual[campo]}
                  onChangeText={t => onChangeManual({ ...item.manual, [campo]: t })}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={cores.textoSuave}
                  maxLength={7}
                />
                <Text style={styles.manualRotulo}>{rotulo}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.macros}>
            P {macro('proteina')} g · C {macro('carboidrato')} g · G {macro('gordura')} g
          </Text>
          {c.macrosIncompletos && <Text style={styles.indisponivel}>– valor indisponível na tabela (conta 0)</Text>}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: cores.fundoCartao, borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'transparent' },
  cardDestacado: { borderColor: cores.acento },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rotulo: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: 11 },
  nome: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.corpo, fontWeight: '600' },
  tabelaBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingVertical: 2 },
  tabelaTxt: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.sub, flexShrink: 1 },
  semTabelaTxt: { color: cores.acento, fontWeight: '600' },
  pesoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  pesoLabel: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub },
  pesoInput: {
    backgroundColor: cores.fundoInput, color: cores.texto, fontFamily: fontes.numero,
    fontSize: tamanhos.corpo, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    width: 72, textAlign: 'center',
  },
  kcal: { color: cores.acento, fontFamily: fontes.numero, fontSize: tamanhos.corpo },
  kcalVazio: { color: cores.textoSuave },
  macros: { color: cores.textoSuave, fontFamily: fontes.numero, fontSize: 11, marginTop: 10 },
  indisponivel: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: 11, marginTop: 4, opacity: 0.8 },
  manual: { marginTop: 12 },
  aviso: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: 11, lineHeight: 16, marginBottom: 8 },
  manualRow: { flexDirection: 'row', gap: 8 },
  manualCampo: { flex: 1, alignItems: 'center' },
  manualInput: {
    backgroundColor: cores.fundoInput, color: cores.texto, fontFamily: fontes.numero,
    fontSize: tamanhos.sub, paddingVertical: 6, borderRadius: 6, width: '100%', textAlign: 'center',
  },
  manualRotulo: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: 10, marginTop: 4 },
})
