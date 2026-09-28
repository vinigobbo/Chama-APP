const { teste, app, bancoNovo, assert, SHIMS } = global.ctx

// Nenhum teste chega na rede: global.fetch é sempre substituído por um mock.
const CHAVE = 'AIzaTESTE-chave-falsa-1234'
const FOTO = Buffer.from('jpeg-falso-da-refeicao').toString('base64')

function secure() { return require(SHIMS['expo-secure-store']).__mock }

function json(status, corpo) {
  return new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}

function respostaIA(conteudo, extra = {}) {
  const texto = typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo)
  return json(200, { candidates: [{ content: { role: 'model', parts: [{ text: texto }] }, finishReason: 'STOP', ...extra }] })
}

// fetch mock: cada chamada consome a próxima resposta da fila (função, Response ou Error)
function mockFetch(fila) {
  const chamadas = []
  global.fetch = async (url, init = {}) => {
    chamadas.push({ url: String(url), init })
    const proxima = fila.length > 1 ? fila.shift() : fila[0]
    if (typeof proxima === 'function') return proxima(url, init)
    if (proxima instanceof Error) throw proxima
    return proxima.clone()
  }
  return chamadas
}

const redeCaiu = () => new TypeError('Network request failed')
const nuncaResponde = (url, init) => new Promise((_, rej) => {
  init.signal.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')))
})

async function preparar({ comChave = true } = {}) {
  await bancoNovo()
  secure().itens.clear()
  const gemini = app('src/ai/gemini.js')
  gemini.LIMITES.timeoutMs = 60
  gemini.LIMITES.esperaRetryMs = 5
  if (comChave) await app('src/ai/chave.js').salvarChaveGemini(CHAVE)
  return app('src/ai/visao.js')
}

async function erroDe(promessa) {
  try {
    await promessa
  } catch (e) {
    assert.equal(e.name, 'ErroVisao', `erro inesperado: ${e && e.stack}`)
    return e
  }
  assert.fail('deveria ter lançado ErroVisao')
}

const OK = { itens: [{ nome: 'arroz branco cozido', peso_g: 150, alimento_id: 3, confianca: 0.9 }] }

// ---------- chave ----------
teste('chave: salva aparada no secure store (só neste aparelho), lê, remove e mascara', async () => {
  await preparar({ comChave: false })
  const c = app('src/ai/chave.js')
  assert.equal(await c.obterChaveGemini(), null)
  await c.salvarChaveGemini(`  ${CHAVE}\n`)
  assert.equal(await c.obterChaveGemini(), CHAVE)
  const [, nome, opcoes] = secure().chamadas.at(-1)
  assert.equal(nome, 'gemini_api_key')
  assert.equal(opcoes.keychainAccessible, 5)
  assert.equal(c.mascararChave(CHAVE), '••••1234')
  await c.removerChaveGemini()
  assert.equal(await c.obterChaveGemini(), null)
  // a chave nunca vai pro SQLite
  const db = app('src/db/database.js').getBanco()
  const dump = JSON.stringify(await db.getAllAsync('SELECT * FROM config'))
  assert.ok(!dump.includes(CHAVE))
})

// ---------- sucesso e formato do pedido ----------
teste('gemini: pedido certo (modelo, header, imagem, schema, lista TACO) e resposta validada', async () => {
  const v = await preparar()
  const { MODELO_VISAO } = app('src/ai/gemini.js')
  const chamadas = mockFetch([respostaIA({
    itens: [
      { nome: 'arroz branco cozido', peso_g: 150.4, alimento_id: 3, confianca: 0.9, calorias: 999 },
      { nome: 'feijão carioca cozido', peso_g: 90, alimento_id: 99999, confianca: 1.7 },
      { nome: 'bife', peso_g: -3, alimento_id: '410', confianca: 'alta' },
      { nome: '   ', peso_g: 10, alimento_id: 1, confianca: 0.5 },
    ],
  })])
  const itens = await v.identificarAlimentos(FOTO)
  assert.deepEqual(itens, [
    { nome: 'arroz branco cozido', peso_g: 150, alimento_id: 3, confianca: 0.9 },
    { nome: 'feijão carioca cozido', peso_g: 90, alimento_id: null, confianca: 1 },
    { nome: 'bife', peso_g: null, alimento_id: null, confianca: null },
  ])
  assert.ok(!('calorias' in itens[0]))

  assert.equal(chamadas.length, 1)
  const { url, init } = chamadas[0]
  assert.equal(MODELO_VISAO, 'gemini-3.5-flash-lite')
  assert.equal(url, `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_VISAO}:generateContent`)
  assert.ok(!url.includes(CHAVE), 'chave não pode ir na URL')
  assert.equal(init.method, 'POST')
  assert.equal(init.headers['x-goog-api-key'], CHAVE)
  const corpo = JSON.parse(init.body)
  assert.deepEqual(corpo.contents[0].parts[0], { inlineData: { mimeType: 'image/jpeg', data: FOTO } })
  assert.equal(corpo.generationConfig.responseFormat.text.mimeType, 'APPLICATION_JSON')
  assert.deepEqual(corpo.generationConfig.responseFormat.text.schema.required, ['itens'])
  assert.deepEqual(corpo.generationConfig.responseFormat.text.schema.properties.itens.items.required,
    ['nome', 'peso_g', 'alimento_id', 'confianca'])
  const instrucoes = corpo.systemInstruction.parts[0].text
  const linhasLista = instrucoes.split('\n').filter(l => /^\d+\|/.test(l))
  assert.equal(linhasLista.length, 597)
  assert.ok(linhasLista.includes('3|Arroz, tipo 1, cozido'))
  assert.ok(linhasLista.includes('410|Frango, peito, sem pele, grelhado'))
  assert.match(instrucoes, /Não informe calorias/)
  assert.match(instrucoes, /porção realmente visível/)
  assert.match(instrucoes, /Ignore pratos, talheres/)
  assert.match(instrucoes, /"itens" vazio/)
})

teste('gemini: aceita JSON em cerca markdown e ignora partes de raciocínio', async () => {
  const v = await preparar()
  mockFetch([json(200, {
    candidates: [{ finishReason: 'STOP', content: { parts: [
      { text: 'pensando...', thought: true },
      { text: '```json\n' + JSON.stringify(OK) + '\n```' },
    ] } }],
  })])
  assert.equal((await v.identificarAlimentos(FOTO))[0].alimento_id, 3)
})

// ---------- erros ----------
teste('erro: sem chave não chama a rede', async () => {
  const v = await preparar({ comChave: false })
  const chamadas = mockFetch([respostaIA(OK)])
  const e = await erroDe(v.identificarAlimentos(FOTO))
  assert.equal(e.tipo, 'sem_chave')
  assert.match(e.message, /configurações/)
  assert.equal(chamadas.length, 0)
})

teste('erro: chave inválida (400 API_KEY_INVALID, 401, 403) sem retry', async () => {
  const v = await preparar()
  const casos = [
    json(400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }),
    json(401, { error: { code: 'authentication', message: 'The API key is missing, invalid, or expired.' } }),
    json(403, { error: { code: 403, message: 'Your API key was reported as leaked.', status: 'PERMISSION_DENIED' } }),
  ]
  for (const resp of casos) {
    const chamadas = mockFetch([resp])
    const e = await erroDe(v.identificarAlimentos(FOTO))
    assert.equal(e.tipo, 'chave_invalida', String(resp.status))
    assert.equal(chamadas.length, 1)
  }
  // 400 que não é de chave é erro de requisição
  mockFetch([json(400, { error: { code: 400, message: 'Invalid JSON payload', status: 'INVALID_ARGUMENT' } })])
  assert.equal((await erroDe(v.identificarAlimentos(FOTO))).tipo, 'requisicao')
})

teste('erro: sem internet tenta 2 vezes; se a segunda der certo, segue', async () => {
  const v = await preparar()
  let chamadas = mockFetch([redeCaiu(), redeCaiu()])
  const e = await erroDe(v.identificarAlimentos(FOTO))
  assert.equal(e.tipo, 'sem_internet')
  assert.equal(chamadas.length, 2)
  chamadas = mockFetch([redeCaiu(), respostaIA(OK)])
  assert.equal((await v.identificarAlimentos(FOTO)).length, 1)
  assert.equal(chamadas.length, 2)
})

teste('erro: cota (429 e 402) não repete', async () => {
  const v = await preparar()
  for (const status of [429, 402]) {
    const chamadas = mockFetch([json(status, { error: { code: status, message: 'quota', status: 'RESOURCE_EXHAUSTED' } })])
    const e = await erroDe(v.identificarAlimentos(FOTO))
    assert.equal(e.tipo, 'cota')
    assert.equal(chamadas.length, 1)
  }
})

teste('erro: timeout (sem retry)', async () => {
  const v = await preparar()
  const chamadas = mockFetch([nuncaResponde])
  const inicio = Date.now()
  const e = await erroDe(v.identificarAlimentos(FOTO))
  assert.equal(e.tipo, 'timeout')
  assert.equal(chamadas.length, 1)
  assert.ok(Date.now() - inicio < 1000)
  assert.equal(app('src/ai/gemini.js').LIMITES.timeoutMs, 60) // produção: 30_000
})

teste('erro: 5xx repete uma vez', async () => {
  const v = await preparar()
  let chamadas = mockFetch([json(503, { error: { code: 503 } }), respostaIA(OK)])
  assert.equal((await v.identificarAlimentos(FOTO)).length, 1)
  assert.equal(chamadas.length, 2)
  chamadas = mockFetch([json(500, {}), json(500, {}), respostaIA(OK)])
  assert.equal((await erroDe(v.identificarAlimentos(FOTO))).tipo, 'servidor')
  assert.equal(chamadas.length, 2)
})

teste('erro: JSON inválido em todas as formas', async () => {
  const v = await preparar()
  const casos = [
    respostaIA('isto não é json'),
    respostaIA({ outra_coisa: 1 }),
    respostaIA({ itens: 'arroz' }),
    respostaIA({ itens: [{ peso_g: 100 }, { nome: '' }] }),
    json(200, 'html de erro <b>'),
    json(200, { candidates: [] }),
    json(200, { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"itens": [{"nome": "arr' }] } }] }),
  ]
  for (const resp of casos) {
    mockFetch([resp])
    assert.equal((await erroDe(v.identificarAlimentos(FOTO))).tipo, 'json_invalido')
  }
})

teste('erro: lista vazia', async () => {
  const v = await preparar()
  mockFetch([respostaIA({ itens: [] })])
  const e = await erroDe(v.identificarAlimentos(FOTO))
  assert.equal(e.tipo, 'lista_vazia')
  assert.match(e.message, /não encontrou comida/)
})

teste('erro: conteúdo bloqueado pelo Google', async () => {
  const v = await preparar()
  mockFetch([json(200, { promptFeedback: { blockReason: 'SAFETY' } })])
  assert.equal((await erroDe(v.identificarAlimentos(FOTO))).tipo, 'bloqueado')
  mockFetch([json(200, { candidates: [{ finishReason: 'PROHIBITED_CONTENT' }] })])
  assert.equal((await erroDe(v.identificarAlimentos(FOTO))).tipo, 'bloqueado')
})

teste('cancelar: durante a requisição e durante a espera do retry', async () => {
  const v = await preparar()
  mockFetch([nuncaResponde])
  let controle = new AbortController()
  setTimeout(() => controle.abort(), 10)
  assert.equal((await erroDe(v.identificarAlimentos(FOTO, { sinal: controle.signal }))).tipo, 'cancelado')

  app('src/ai/gemini.js').LIMITES.esperaRetryMs = 200
  const chamadas = mockFetch([redeCaiu(), respostaIA(OK)])
  controle = new AbortController()
  setTimeout(() => controle.abort(), 20)
  assert.equal((await erroDe(v.identificarAlimentos(FOTO, { sinal: controle.signal }))).tipo, 'cancelado')
  assert.equal(chamadas.length, 1)

  controle = new AbortController()
  controle.abort()
  assert.equal((await erroDe(v.identificarAlimentos(FOTO, { sinal: controle.signal }))).tipo, 'cancelado')
})

teste('testar chave: GET no modelo, sem gastar tokens', async () => {
  const v = await preparar()
  const { MODELO_VISAO } = app('src/ai/gemini.js')
  let chamadas = mockFetch([json(200, { name: `models/${MODELO_VISAO}` })])
  await v.testarChave(CHAVE)
  assert.equal(chamadas[0].url, `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_VISAO}`)
  assert.equal(chamadas[0].init.method, 'GET')
  assert.equal(chamadas[0].init.headers['x-goog-api-key'], CHAVE)
  mockFetch([json(400, { error: { code: 400, status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } })])
  assert.equal((await erroDe(v.testarChave('errada'))).tipo, 'chave_invalida')
  mockFetch([redeCaiu()])
  assert.equal((await erroDe(v.testarChave(CHAVE))).tipo, 'sem_internet')
  assert.equal((await erroDe(v.testarChave('   '))).tipo, 'sem_chave')
})

teste('provedor trocável: outra implementação da interface é usada', async () => {
  const v = await preparar()
  const chamadas = mockFetch([respostaIA(OK)])
  const falso = { nome: 'falso', identificar: async (foto, o) => ({ itens: [{ nome: 'ovo frito', peso_g: 50, alimento_id: 490, confianca: 1 }] }), testarChave: async () => {} }
  v.definirProvedorVisao(falso)
  try {
    assert.equal((await v.identificarAlimentos(FOTO))[0].alimento_id, 490)
    assert.equal(chamadas.length, 0)
  } finally {
    v.definirProvedorVisao(app('src/ai/gemini.js').provedorGemini)
  }
})

teste('logs: nada de chave nem base64 no console em nenhum caso', async () => {
  const v = await preparar()
  const logs = []
  const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug }
  for (const k of Object.keys(orig)) console[k] = (...a) => logs.push(a.map(String).join(' '))
  try {
    for (const resp of [respostaIA(OK), json(400, { error: { details: [{ reason: 'API_KEY_INVALID' }] } }), json(503, {}), redeCaiu(), respostaIA('lixo')]) {
      mockFetch([resp])
      await v.identificarAlimentos(FOTO).catch(() => {})
    }
  } finally {
    Object.assign(console, orig)
  }
  assert.ok(!logs.some(l => l.includes(CHAVE) || l.includes(FOTO)), logs.join('\n'))
})
