import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { Directory, File, Paths } from 'expo-file-system'

export const LADO_MAIOR = 1024
export const QUALIDADE_JPEG = 0.7
const PASTA_FOTOS = 'refeicoes'

export type FotoEscolhida = { uri: string; width: number; height: number }
export type ResultadoEscolha =
  | { tipo: 'foto'; foto: FotoEscolhida }
  | { tipo: 'cancelado' }
  | { tipo: 'sem_permissao'; podePedirDeNovo: boolean }

// A permissão da câmera só é pedida aqui, na hora de tirar a foto.
// A galeria usa o seletor do sistema, que não precisa de permissão.
export async function escolherFoto(origem: 'camera' | 'galeria'): Promise<ResultadoEscolha> {
  if (origem === 'camera') {
    const permissao = await ImagePicker.requestCameraPermissionsAsync()
    if (!permissao.granted) return { tipo: 'sem_permissao', podePedirDeNovo: permissao.canAskAgain }
  }
  const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false }
  const resultado = origem === 'camera'
    ? await ImagePicker.launchCameraAsync(opcoes)
    : await ImagePicker.launchImageLibraryAsync(opcoes)
  if (resultado.canceled || !resultado.assets?.length) return { tipo: 'cancelado' }
  const { uri, width, height } = resultado.assets[0]
  return { tipo: 'foto', foto: { uri, width, height } }
}

// só reduz; foto menor que o limite fica do tamanho que está
export function tamanhoReduzido(width: number, height: number, limite = LADO_MAIOR) {
  if (Math.max(width, height) <= limite) return null
  return width >= height ? { width: limite } : { height: limite }
}

function apagarSemErro(uri: string) {
  try {
    const f = new File(uri)
    if (f.exists) f.delete()
  } catch (e) {
    // arquivo temporário; se não der pra apagar, o sistema limpa o cache depois
  }
}

// Reduz (lado maior ~1024 px, JPEG ~0,7), grava em documentos/refeicoes e devolve o caminho
// definitivo e o base64 pra mandar pra IA. O base64 fica só em memória.
export async function prepararFoto(foto: FotoEscolhida): Promise<{ fotoUri: string; base64: string }> {
  const contexto = ImageManipulator.manipulate(foto.uri)
  const tamanho = tamanhoReduzido(foto.width, foto.height)
  if (tamanho) contexto.resize(tamanho)
  const imagem = await contexto.renderAsync()
  const salvo = await imagem.saveAsync({ compress: QUALIDADE_JPEG, format: SaveFormat.JPEG, base64: true })
  if (!salvo.base64) throw new Error('imagem sem base64')

  const pasta = new Directory(Paths.document, PASTA_FOTOS)
  if (!pasta.exists) pasta.create({ intermediates: true, idempotent: true })
  const destino = new File(pasta, `refeicao-${Date.now()}.jpg`)
  await new File(salvo.uri).move(destino)
  apagarSemErro(foto.uri)
  return { fotoUri: destino.uri, base64: salvo.base64 }
}
