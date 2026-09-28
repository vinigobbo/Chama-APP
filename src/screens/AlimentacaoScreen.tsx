import { useState, useCallback, useRef } from 'react'
import { View, Text, SectionList, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Modal, Alert } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { cores } from '../theme/colors'
import { fontes, tamanhos } from '../theme/fonts'
import ConfirmModal from '../components/ConfirmModal'
import { excluirRefeicao, listarRefeicoesDoDia, totaisDoDia, RefeicaoComItens } from '../db/refeicoes'
import { formatarDecimal, somarItens, Totais } from '../utils/nutricao'
import { escolherFoto, prepararFoto } from '../utils/foto'
import { registrarRefeicaoPorFoto } from '../ai/fluxoFoto'

const TOTAIS_ZERO: Totais = { calorias: 0, proteina: 0, carboidrato: 0, gordura: 0 }

type Processando = 'preparando' | 'identificando' | null

// dá tempo do modal de opções fechar antes de abrir câmera/galeria (no iOS, abrir por cima falha)
const esperarModalFechar = () => new Promise(resolve => setTimeout(resolve, 350))

export default function AlimentacaoScreen() {
  const navigation = useNavigation<any>()
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [refeicoes, setRefeicoes] = useState<RefeicaoComItens[]>([])
  const [totais, setTotais] = useState<Totais>(TOTAIS_ZERO)
  const [opcoesVisiveis, setOpcoesVisiveis] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<RefeicaoComItens | null>(null)

  async function carregar() {
    try {
      const [lista, t] = await Promise.all([listarRefeicoesDoDia(), totaisDoDia()])
      setRefeicoes(lista)
      setTotais(t)
      setErro(false)
    } catch (e) {
      setErro(true)
    } finally {
      setCarregando(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      carregar()
    }, [])
  )

  const [processando, setProcessando] = useState<Processando>(null)
  const controleRef = useRef<AbortController | null>(null)

  function registrarManual() {
    setOpcoesVisiveis(false)
    navigation.navigate('RevisaoRefeicao', {})
  }

  async function registrarPorFoto(origem: 'camera' | 'galeria') {
    setOpcoesVisiveis(false)
    await esperarModalFechar()

    let escolha
    try {
      escolha = await escolherFoto(origem)
    } catch (e) {
      Alert.alert(origem === 'camera' ? 'não deu pra abrir a câmera' : 'não deu pra abrir a galeria', 'tente de novo')
      return
    }
    if (escolha.tipo === 'cancelado') return
    if (escolha.tipo === 'sem_permissao') {
      Alert.alert(
        'sem acesso à câmera',
        escolha.podePedirDeNovo
          ? 'permita o acesso à câmera pra fotografar a refeição'
          : 'libere a câmera pro chama nas configurações do celular'
      )
      return
    }

    setProcessando('preparando')
    let foto
    try {
      foto = await prepararFoto(escolha.foto)
    } catch (e) {
      setProcessando(null)
      Alert.alert('não deu pra usar essa foto', 'tente outra foto ou registre manualmente')
      return
    }

    const controle = new AbortController()
    controleRef.current = controle
    setProcessando('identificando')
    try {
      const r = await registrarRefeicaoPorFoto(foto.fotoUri, foto.base64, controle.signal)
      navigation.navigate('RevisaoRefeicao', {
        refeicaoId: r.refeicaoId,
        nova: true,
        origemIA: r.erro === null,
        avisoFalha: r.avisoFalha ?? undefined,
      })
    } catch (e) {
      Alert.alert('não deu pra salvar a refeição', 'tente de novo em instantes')
    } finally {
      controleRef.current = null
      setProcessando(null)
    }
  }

  function cancelarIdentificacao() {
    controleRef.current?.abort()
  }

  async function confirmarExclusao() {
    if (!paraExcluir) return
    const id = paraExcluir.id
    setParaExcluir(null)
    try {
      await excluirRefeicao(id)
    } finally {
      await carregar()
    }
  }

  const pendentes = refeicoes.filter(r => r.status === 'pendente').length

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>alimentação</Text>

      <View style={styles.resumo}>
        <View>
          <Text style={styles.resumoKcal}>{formatarDecimal(totais.calorias, 0)}</Text>
          <Text style={styles.resumoLabel}>kcal hoje</Text>
        </View>
        <View style={styles.resumoMacros}>
          <Text style={styles.resumoMacro}>
            <Text style={styles.resumoMacroValor}>{formatarDecimal(totais.proteina)}</Text> g proteína
          </Text>
          <Text style={styles.resumoMacro}>
            <Text style={styles.resumoMacroValor}>{formatarDecimal(totais.carboidrato)}</Text> g carboidrato
          </Text>
          <Text style={styles.resumoMacro}>
            <Text style={styles.resumoMacroValor}>{formatarDecimal(totais.gordura)}</Text> g gordura
          </Text>
        </View>
      </View>
      {pendentes > 0 && (
        <Text style={styles.notaPendentes}>
          {pendentes === 1 ? '1 refeição pra revisar não entra' : `${pendentes} refeições pra revisar não entram`} no total
        </Text>
      )}

      <View style={styles.secaoHeader}>
        <Text style={styles.secaoTitulo}>refeições de hoje</Text>
        <TouchableOpacity onPress={() => setOpcoesVisiveis(true)} accessibilityLabel="adicionar refeição">
          <Text style={styles.addBtn}>+</Text>
        </TouchableOpacity>
      </View>

      {carregando ? (
        <ActivityIndicator color={cores.acento} style={styles.carregando} />
      ) : erro ? (
        <View style={styles.erroBox}>
          <Text style={styles.vazio}>não deu pra carregar as refeições</Text>
          <TouchableOpacity onPress={carregar} style={styles.tentarBtn}>
            <Text style={styles.tentarTxt}>tentar de novo</Text>
          </TouchableOpacity>
        </View>
      ) : refeicoes.length === 0 ? (
        <Text style={styles.vazio}>nenhuma refeição registrada hoje</Text>
      ) : (
        <SectionList
          sections={[{ title: 'hoje', data: refeicoes }]}
          keyExtractor={item => String(item.id)}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.lista}
          renderItem={({ item }) => {
            const kcal = somarItens(item.itens).calorias
            const pendente = item.status === 'pendente'
            return (
              <TouchableOpacity
                style={styles.refeicaoRow}
                onPress={() => navigation.navigate('RevisaoRefeicao', { refeicaoId: item.id })}
                onLongPress={() => setParaExcluir(item)}
              >
                {item.foto_uri ? (
                  <Image source={{ uri: item.foto_uri }} style={styles.miniatura} />
                ) : (
                  <View style={[styles.miniatura, styles.miniaturaVazia]}>
                    <Ionicons name="restaurant-outline" size={20} color={cores.textoSuave} />
                  </View>
                )}
                <View style={styles.refeicaoInfo}>
                  <View style={styles.refeicaoLinha}>
                    <Text style={styles.horario}>{item.horario}</Text>
                    {pendente && (
                      <View style={styles.selo}>
                        <Text style={styles.seloTxt}>revisar</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.qtdItens}>
                    {item.itens.length === 0 ? 'sem itens' : `${item.itens.length} ${item.itens.length === 1 ? 'item' : 'itens'}`}
                  </Text>
                </View>
                <Text style={[styles.refeicaoKcal, pendente && styles.refeicaoKcalPendente]}>
                  {formatarDecimal(kcal, 0)} kcal
                </Text>
              </TouchableOpacity>
            )
          }}
        />
      )}

      <Modal visible={opcoesVisiveis} transparent animationType="slide" onRequestClose={() => setOpcoesVisiveis(false)}>
        <View style={styles.modalFundo}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>adicionar refeição</Text>
            <TouchableOpacity style={styles.opcao} onPress={() => registrarPorFoto('camera')}>
              <Ionicons name="camera-outline" size={20} color={cores.acento} />
              <Text style={styles.opcaoTxt}>tirar foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.opcao} onPress={() => registrarPorFoto('galeria')}>
              <Ionicons name="images-outline" size={20} color={cores.acento} />
              <Text style={styles.opcaoTxt}>escolher da galeria</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.opcao} onPress={registrarManual}>
              <Ionicons name="create-outline" size={20} color={cores.acento} />
              <Text style={styles.opcaoTxt}>registrar manualmente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalFechar} onPress={() => setOpcoesVisiveis(false)}>
              <Text style={styles.modalFecharTxt}>fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={processando !== null} transparent animationType="fade" onRequestClose={cancelarIdentificacao}>
        <View style={styles.processandoFundo}>
          <View style={styles.processandoCard}>
            <ActivityIndicator color={cores.acento} size="large" />
            <Text style={styles.processandoTxt}>
              {processando === 'preparando' ? 'preparando a foto…' : 'identificando alimentos…'}
            </Text>
            {processando === 'identificando' && (
              <TouchableOpacity style={styles.processandoCancelar} onPress={cancelarIdentificacao}>
                <Text style={styles.modalFecharTxt}>cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visivel={paraExcluir !== null}
        titulo="excluir refeição?"
        mensagem={`a refeição das ${paraExcluir?.horario ?? ''}${paraExcluir?.foto_uri ? ', a foto' : ''} e todos os itens serão apagados.`}
        onCancelar={() => setParaExcluir(null)}
        onConfirmar={confirmarExclusao}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo, paddingTop: 8, paddingHorizontal: 24 },
  titulo: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.titulo, marginBottom: 24 },
  resumo: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: cores.fundoCartao, borderRadius: 10, padding: 16,
  },
  resumoKcal: { color: cores.acento, fontFamily: fontes.numero, fontSize: 40 },
  resumoLabel: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub, marginTop: 2 },
  resumoMacros: { alignItems: 'flex-end', gap: 4 },
  resumoMacro: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub },
  resumoMacroValor: { color: cores.texto, fontFamily: fontes.numero },
  notaPendentes: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: 11, marginTop: 8 },
  secaoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 8 },
  secaoTitulo: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.corpo },
  addBtn: { color: cores.acento, fontSize: 28, lineHeight: 28 },
  lista: { paddingBottom: 40 },
  carregando: { marginTop: 40 },
  vazio: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub, textAlign: 'center', marginTop: 40 },
  erroBox: { alignItems: 'center' },
  tentarBtn: { marginTop: 12, padding: 8 },
  tentarTxt: { color: cores.acento, fontFamily: fontes.corpo, fontSize: tamanhos.sub, fontWeight: '600' },
  refeicaoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: cores.fundoInput,
  },
  miniatura: { width: 48, height: 48, borderRadius: 8, backgroundColor: cores.fundoCartao },
  miniaturaVazia: { justifyContent: 'center', alignItems: 'center' },
  refeicaoInfo: { flex: 1 },
  refeicaoLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  horario: { color: cores.texto, fontFamily: fontes.numero, fontSize: tamanhos.corpo },
  selo: { backgroundColor: cores.acentoSuave, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  seloTxt: { color: cores.acento, fontFamily: fontes.corpo, fontSize: 10, fontWeight: '600' },
  qtdItens: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub, marginTop: 2 },
  refeicaoKcal: { color: cores.acento, fontFamily: fontes.numero, fontSize: tamanhos.sub },
  refeicaoKcalPendente: { color: cores.textoSuave },
  modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: cores.fundoCartao, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitulo: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.titulo, fontWeight: '600', marginBottom: 12 },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: cores.fundoInput },
  opcaoTxt: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.corpo },
  processandoFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  processandoCard: { backgroundColor: cores.fundoCartao, borderRadius: 16, paddingVertical: 28, paddingHorizontal: 32, alignItems: 'center', minWidth: 240 },
  processandoTxt: { color: cores.texto, fontFamily: fontes.corpo, fontSize: tamanhos.corpo, marginTop: 16 },
  processandoCancelar: { marginTop: 20, paddingVertical: 8, paddingHorizontal: 16 },
  modalFechar: { alignItems: 'center', marginTop: 16 },
  modalFecharTxt: { color: cores.textoSuave, fontFamily: fontes.corpo, fontSize: tamanhos.sub },
})
