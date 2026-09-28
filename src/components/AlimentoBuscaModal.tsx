import { useEffect, useState } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, SectionList, StyleSheet, ActivityIndicator } from 'react-native'
import { cores } from '../theme/colors'
import { fontes, tamanhos } from '../theme/fonts'
import { AlimentoTaco, buscarAlimentos } from '../db/alimentos'
import { formatarDecimal } from '../utils/nutricao'

type Props = {
  visivel: boolean
  titulo: string
  termoInicial?: string
  // sugestões da IA pra esse item, mostradas antes dos resultados da busca
  sugestoes?: AlimentoTaco[]
  onFechar: () => void
  onEscolher: (alimento: AlimentoTaco) => void
  onManual: (nome: string) => void
}

export default function AlimentoBuscaModal({
  visivel, titulo, termoInicial = '', sugestoes = [], onFechar, onEscolher, onManual,
}: Props) {
  const [termo, setTermo] = useState(termoInicial)
  const [resultados, setResultados] = useState<AlimentoTaco[]>([])
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    if (visivel) setTermo(termoInicial)
  }, [visivel, termoInicial])

  useEffect(() => {
    if (!visivel) return
    let ativo = true
    setBuscando(true)
    setErro(false)
    buscarAlimentos(termo, 40)
      .then(lista => { if (ativo) setResultados(lista) })
      .catch(() => { if (ativo) setErro(true) })
      .finally(() => { if (ativo) setBuscando(false) })
    return () => { ativo = false }
  }, [termo, visivel])

  const idsSugeridos = new Set(sugestoes.map(s => s.id))
  const secoes = [
    ...(sugestoes.length ? [{ title: 'sugestões', data: sugestoes }] : []),
    ...(termo.trim() ? [{ title: 'tabela TACO', data: resultados.filter(r => !idsSugeridos.has(r.id)) }] : []),
  ].filter(s => s.data.length)

  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={onFechar}>
      <View style={styles.fundo}>
        <View style={styles.card}>
          <Text style={styles.titulo}>{titulo}</Text>
          <TextInput
            style={styles.input}
            placeholder="buscar alimento (ex: arroz cozido)"
            placeholderTextColor={cores.textoSuave}
            value={termo}
            onChangeText={setTermo}
            autoCorrect={false}
          />

          {erro ? (
            <Text style={styles.vazio}>não deu pra buscar na tabela agora</Text>
          ) : secoes.length === 0 ? (
            buscando ? (
              <ActivityIndicator color={cores.acento} style={styles.carregando} />
            ) : (
              <Text style={styles.vazio}>
                {termo.trim() ? 'nada encontrado na tabela' : 'digite o nome do alimento'}
              </Text>
            )
          ) : (
            <SectionList
              sections={secoes}
              keyExtractor={item => String(item.id)}
              keyboardShouldPersistTaps="handled"
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section }) => <Text style={styles.secaoTitulo}>{section.title}</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.linha} onPress={() => onEscolher(item)}>
                  <Text style={styles.linhaNome}>{item.nome}</Text>
                  <Text style={styles.linhaKcal}>
                    {item.kcal === null ? 'sem kcal' : `${formatarDecimal(item.kcal, 0)} kcal/100 g`}
                  </Text>
                </TouchableOpacity>
              )}
              style={styles.lista}
            />
          )}

          <TouchableOpacity style={styles.manualBtn} onPress={() => onManual(termo.trim())}>
            <Text style={styles.manualTxt}>não achei: informar valores à mão</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelar} onPress={onFechar}>
            <Text style={styles.cancelarTexto}>fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  card: { backgroundColor: cores.fundoCartao, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' },
  titulo: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.titulo, fontWeight: '600', marginBottom: 12 },
  input: {
    backgroundColor: cores.fundoInput, color: cores.texto, fontFamily: fontes.corpo,
    fontSize: tamanhos.corpo, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
  },
  lista: { maxHeight: 400, marginTop: 4 },
  carregando: { marginVertical: 24 },
  vazio: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub, textAlign: 'center', marginVertical: 24 },
  secaoTitulo: {
    color: cores.acento, fontFamily: fontes.corpo, fontSize: 11,
    fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase',
    marginTop: 14, marginBottom: 6,
  },
  linha: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: cores.fundoInput },
  linhaNome: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.corpo },
  linhaKcal: { color: cores.textoSuave, fontFamily: fontes.numero, fontSize: 11, marginTop: 2 },
  manualBtn: { borderWidth: 1, borderColor: cores.acento, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 16 },
  manualTxt: { color: cores.acento, fontFamily: fontes.corpo, fontSize: tamanhos.sub, fontWeight: '600' },
  cancelar: { alignItems: 'center', marginTop: 16 },
  cancelarTexto: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub },
})
