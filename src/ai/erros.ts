// erros da camada de visão, com a mensagem pt-BR que a tela mostra
export type TipoErroVisao =
  | 'sem_chave'
  | 'chave_invalida'
  | 'sem_internet'
  | 'cota'
  | 'timeout'
  | 'json_invalido'
  | 'lista_vazia'
  | 'bloqueado'
  | 'servidor'
  | 'requisicao'
  | 'cancelado'

export const MENSAGENS_ERRO: Record<TipoErroVisao, string> = {
  sem_chave: 'nenhuma chave do Gemini configurada. adicione a sua em configurações > alimentação (IA).',
  chave_invalida: 'o Google recusou a chave do Gemini. confira ou troque a chave em configurações.',
  sem_internet: 'sem conexão com a internet.',
  cota: 'limite de uso do Gemini atingido. tente de novo mais tarde.',
  timeout: 'o Gemini demorou demais pra responder.',
  json_invalido: 'a resposta da IA veio num formato inesperado.',
  lista_vazia: 'a IA não encontrou comida nesta foto.',
  bloqueado: 'o Google não aceitou analisar esta foto.',
  servidor: 'o serviço do Gemini está instável agora.',
  requisicao: 'o Gemini recusou o pedido.',
  cancelado: 'identificação cancelada.',
}

export class ErroVisao extends Error {
  tipo: TipoErroVisao
  constructor(tipo: TipoErroVisao) {
    super(MENSAGENS_ERRO[tipo])
    this.name = 'ErroVisao'
    this.tipo = tipo
  }
}
