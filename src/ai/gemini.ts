import { ErroVisao, TipoErroVisao } from './erros'
import { montarInstrucoes, PEDIDO_USUARIO, SCHEMA_RESPOSTA } from './prompt'
import type { OpcoesProvedor, ProvedorVisao } from './visao'

// Modelo usado pra identificar os alimentos. Único lugar com o ID.
// Gemini 3.5 Flash-Lite: estável, aceita imagem, structured output e thinking (docs de set/2026).
export const MODELO_VISAO = 'gemini-3.5-flash-lite'

const BASE = 'https://generativelanguage.googleapis.com/v1beta'
// timeout de cada tentativa e espera antes do retry (os testes reduzem)
export const LIMITES = { timeoutMs: 30_000, esperaRetryMs: 800 }

// finishReason / blockReason que significam "o Google não quis responder"
const MOTIVOS_BLOQUEIO = new Set([
  'SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY', 'OTHER', 'LANGUAGE',
])

class ErroRede extends Error {}

class ErroHttp extends Error {
  status: number
  corpo: string
  constructor(status: number, corpo: string) {
    super(`HTTP ${status}`)
    this.status = status
    this.corpo = corpo
  }
}

// fetch com timeout e cancelamento pelo usuário
async function requisitar(url: string, init: RequestInit, sinalExterno?: AbortSignal): Promise<Response> {
  if (sinalExterno?.aborted) throw new ErroVisao('cancelado')
  const controle = new AbortController()
  let estourou = false
  const timer = setTimeout(() => { estourou = true; controle.abort() }, LIMITES.timeoutMs)
  const cancelar = () => controle.abort()
  sinalExterno?.addEventListener('abort', cancelar)
  try {
    return await fetch(url, { ...init, signal: controle.signal })
  } catch (e) {
    if (sinalExterno?.aborted) throw new ErroVisao('cancelado')
    if (estourou) throw new ErroVisao('timeout')
    throw new ErroRede()
  } finally {
    clearTimeout(timer)
    sinalExterno?.removeEventListener('abort', cancelar)
  }
}

function esperar(ms: number, sinal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => { sinal?.removeEventListener('abort', aoCancelar); resolve() }, ms)
    const aoCancelar = () => { clearTimeout(t); reject(new ErroVisao('cancelado')) }
    sinal?.addEventListener('abort', aoCancelar)
  })
}

export function tipoPorStatus(status: number, corpo: string): TipoErroVisao {
  if (status === 401 || status === 403) return 'chave_invalida'
  if (status === 400 && /API_KEY_INVALID|api key|api_key/i.test(corpo)) return 'chave_invalida'
  if (status === 402 || status === 429) return 'cota'
  if (status >= 500) return 'servidor'
  return 'requisicao'
}

// uma tentativa extra só pra erro de rede ou 5xx; o resto falha direto
async function comRetry(tentativa: () => Promise<Response>, sinal?: AbortSignal): Promise<Response> {
  for (let i = 0; ; i++) {
    try {
      const resp = await tentativa()
      if (resp.ok) return resp
      const corpo = await resp.text().catch(() => '')
      throw new ErroHttp(resp.status, corpo)
    } catch (e) {
      const repetivel = e instanceof ErroRede || (e instanceof ErroHttp && e.status >= 500)
      if (repetivel && i === 0) {
        await esperar(LIMITES.esperaRetryMs, sinal)
        continue
      }
      if (e instanceof ErroRede) throw new ErroVisao('sem_internet')
      if (e instanceof ErroHttp) throw new ErroVisao(tipoPorStatus(e.status, e.corpo))
      throw e
    }
  }
}

// tira cercas de markdown se o modelo mandar ```json ... ```
function lerJson(texto: string): unknown {
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(limpo)
  } catch (e) {
    throw new ErroVisao('json_invalido')
  }
}

export function montarCorpo(fotoBase64: string, catalogo: OpcoesProvedor['catalogo']) {
  return {
    systemInstruction: { parts: [{ text: montarInstrucoes(catalogo) }] },
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: fotoBase64 } },
          { text: PEDIDO_USUARIO },
        ],
      },
    ],
    generationConfig: {
      responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: SCHEMA_RESPOSTA } },
      thinkingConfig: { thinkingLevel: 'LOW' },
    },
  }
}

export function extrairResposta(json: any): unknown {
  if (json?.promptFeedback?.blockReason) throw new ErroVisao('bloqueado')
  const candidato = json?.candidates?.[0]
  if (!candidato) throw new ErroVisao('json_invalido')
  if (MOTIVOS_BLOQUEIO.has(candidato.finishReason)) throw new ErroVisao('bloqueado')
  const texto = (candidato.content?.parts ?? [])
    .filter((p: any) => !p?.thought && typeof p?.text === 'string')
    .map((p: any) => p.text)
    .join('')
  if (!texto.trim()) throw new ErroVisao('json_invalido')
  return lerJson(texto)
}

export const provedorGemini: ProvedorVisao = {
  nome: 'Google Gemini',

  async identificar(fotoBase64, { chave, catalogo, sinal }) {
    const corpo = JSON.stringify(montarCorpo(fotoBase64, catalogo))
    const resp = await comRetry(
      () => requisitar(`${BASE}/models/${MODELO_VISAO}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
        body: corpo,
      }, sinal),
      sinal
    )
    let json: unknown
    try {
      json = await resp.json()
    } catch (e) {
      throw new ErroVisao('json_invalido')
    }
    return extrairResposta(json)
  },

  // consulta os dados do modelo: valida a chave sem gastar tokens
  async testarChave(chave, sinal) {
    await comRetry(
      () => requisitar(`${BASE}/models/${MODELO_VISAO}`, { method: 'GET', headers: { 'x-goog-api-key': chave } }, sinal),
      sinal
    )
  },
}
