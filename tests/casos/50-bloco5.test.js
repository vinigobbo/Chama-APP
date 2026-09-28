const { teste, app, bancoNovo, assert, SHIMS, novaPasta } = global.ctx
const fs = require('fs')
const path = require('path')
const { pathToFileURL, fileURLToPath } = require('url')

const picker = () => require(SHIMS['expo-image-picker']).__mock
const manip = () => require(SHIMS['expo-image-manipulator']).__mock
const fsMock = () => require(SHIMS['expo-file-system']).__mock

function fotoTemporaria(conteudo = 'jpeg-original') {
  const p = path.join(novaPasta('chama-picker-'), 'foto.jpg')
  fs.writeFileSync(p, conteudo)
  return pathToFileURL(p).href
}

async function preparar() {
  await bancoNovo()
  fsMock().documentos = novaPasta('chama-docs-')
  picker().chamadas.length = 0
  manip().operacoes.length = 0
}

// ---------- foto ----------
teste('foto: só reduz quando o lado maior passa de 1024', () => {
  const { tamanhoReduzido, LADO_MAIOR, QUALIDADE_JPEG } = app('src/utils/foto.js')
  assert.equal(LADO_MAIOR, 1024)
  assert.equal(QUALIDADE_JPEG, 0.7)
  assert.deepEqual(tamanhoReduzido(4032, 3024), { width: 1024 })
  assert.deepEqual(tamanhoReduzido(3024, 4032), { height: 1024 })
  assert.deepEqual(tamanhoReduzido(2000, 2000), { width: 1024 })
  assert.equal(tamanhoReduzido(1024, 768), null)
  assert.equal(tamanhoReduzido(640, 480), null)
})

teste('foto: câmera pede permissão só na hora; negada não abre a câmera', async () => {
  await preparar()
  const { escolherFoto } = app('src/utils/foto.js')
  picker().permissao = { granted: false, canAskAgain: false, status: 'denied' }
  assert.deepEqual(await escolherFoto('camera'), { tipo: 'sem_permissao', podePedirDeNovo: false })
  assert.deepEqual(picker().chamadas.map(c => c[0]), ['permissaoCamera'])

  picker().chamadas.length = 0
  picker().permissao = { granted: true, canAskAgain: true, status: 'granted' }
  picker().resultado = { canceled: false, assets: [{ uri: 'file:///tmp/x.jpg', width: 4000, height: 3000 }] }
  assert.deepEqual(await escolherFoto('camera'), { tipo: 'foto', foto: { uri: 'file:///tmp/x.jpg', width: 4000, height: 3000 } })
  assert.deepEqual(picker().chamadas.map(c => c[0]), ['permissaoCamera', 'camera'])
  assert.deepEqual(picker().chamadas[1][1].mediaTypes, ['images'])

  picker().resultado = { canceled: true, assets: null }
  assert.deepEqual(await escolherFoto('camera'), { tipo: 'cancelado' })
})

teste('foto: galeria usa o seletor do sistema, sem pedir permissão', async () => {
  await preparar()
  const { escolherFoto } = app('src/utils/foto.js')
  picker().permissao = { granted: false, canAskAgain: true, status: 'denied' }
  picker().resultado = { canceled: false, assets: [{ uri: 'file:///tmp/g.jpg', width: 800, height: 600 }] }
  assert.equal((await escolherFoto('galeria')).tipo, 'foto')
  assert.deepEqual(picker().chamadas.map(c => c[0]), ['galeria'])
})

teste('foto: prepara (reduz, JPEG 0,7), grava em documentos/refeicoes e apaga o temporário', async () => {
  await preparar()
  const { prepararFoto } = app('src/utils/foto.js')
  const original = fotoTemporaria()
  const r = await prepararFoto({ uri: original, width: 4032, height: 3024 })
  const op = manip().operacoes[0]
  assert.deepEqual(op.resize, { width: 1024 })
  assert.deepEqual(op.save, { compress: 0.7, format: 'jpeg', base64: true })
  const destino = fileURLToPath(r.fotoUri)
  assert.equal(path.dirname(destino), path.join(fsMock().documentos, 'refeicoes'))
  assert.match(path.basename(destino), /^refeicao-\d+\.jpg$/)
  assert.equal(fs.readFileSync(destino, 'utf8'), 'REDUZIDA:jpeg-original')
  assert.equal(Buffer.from(r.base64, 'base64').toString(), 'REDUZIDA:jpeg-original')
  assert.equal(fs.existsSync(fileURLToPath(original)), false)

  // foto pequena não é redimensionada
  await prepararFoto({ uri: fotoTemporaria(), width: 800, height: 600 })
  assert.equal(manip().operacoes[1].resize, null)
})

// ---------- casamento e fluxo ----------
const ITENS_IA = [
  { nome: 'arroz branco cozido', peso_g: 150, alimento_id: 3, confianca: 0.9 },       // id da IA, confere
  { nome: 'feijão carioca cozido', peso_g: 86, alimento_id: null, confianca: 0.8 },   // sem id: busca
  { nome: 'frango grelhado', peso_g: 120, alimento_id: 409, confianca: 0.7 },         // IA deu o CRU: rejeita e busca
  { nome: 'macarrão cozido', peso_g: 100, alimento_id: null, confianca: 0.6 },        // TACO não tem: manual
  { nome: 'leite integral', peso_g: 200, alimento_id: 458, confianca: 0.9 },          // tabela sem kcal: manual
  { nome: 'salada verde', peso_g: null, alimento_id: 77777, confianca: 0.3 },         // id inexistente e sem peso
]

teste('fluxo: casa pelo id da IA, cai na busca, respeita cru/cozido e marca os sem casamento', async () => {
  await preparar()
  const { casarComTabela } = app('src/ai/fluxoFoto.js')
  const { listarAlimentos } = app('src/db/alimentos.js')
  const porId = new Map((await listarAlimentos()).map(a => [a.id, a]))
  const r = []
  for (const i of ITENS_IA) {
    const c = await casarComTabela(i, porId)
    r.push([i.nome, c.alimento?.id ?? null, c.origem])
  }
  assert.deepEqual(r, [
    ['arroz branco cozido', 3, 'ia'],
    ['feijão carioca cozido', 561, 'busca'],
    ['frango grelhado', 410, 'busca'],
    ['macarrão cozido', null, 'nenhum'],
    ['leite integral', 458, 'ia'],
    ['salada verde', null, 'nenhum'],
  ])
})

teste('fluxo: foto -> IA -> refeição pendente com itens calculados pela tabela', async () => {
  await preparar()
  const { registrarRefeicaoPorFoto } = app('src/ai/fluxoFoto.js')
  const ref = app('src/db/refeicoes.js')
  const foto = fotoTemporaria()
  let recebido = null
  const identificar = async (b64, o) => { recebido = { b64, n: o.catalogo.length, sinal: o.sinal }; return ITENS_IA }
  const controle = new AbortController()
  const r = await registrarRefeicaoPorFoto(foto, 'BASE64', controle.signal, identificar)
  assert.equal(r.erro, null)
  assert.equal(r.avisoFalha, null)
  assert.deepEqual([recebido.b64, recebido.n, recebido.sinal], ['BASE64', 597, controle.signal])

  const salva = await ref.buscarRefeicao(r.refeicaoId)
  assert.equal(salva.status, 'pendente')
  assert.equal(salva.foto_uri, foto)
  assert.deepEqual(salva.itens.map(i => [i.nome, i.peso_g, i.alimento_taco_id, i.calorias, i.editado_manual, i.taco_nome]), [
    ['arroz branco cozido', 150, 3, 192, 0, 'Arroz, tipo 1, cozido'],
    ['feijão carioca cozido', 86, 561, 65.4, 0, 'Feijão, carioca, cozido'],
    ['frango grelhado', 120, 410, 190.8, 0, 'Frango, peito, sem pele, grelhado'],
    ['macarrão cozido', 100, null, null, 1, null],
    ['leite integral', 200, 458, null, 1, 'Leite, de vaca, integral'],
    ['salada verde', 0, null, null, 1, null],
  ])
  // pendente não entra no total do dia
  assert.equal((await ref.totaisDoDia()).calorias, 0)
})

teste('fluxo: qualquer erro da IA vira refeição pendente só com a foto (sem perder a foto)', async () => {
  await preparar()
  const { registrarRefeicaoPorFoto } = app('src/ai/fluxoFoto.js')
  const { ErroVisao } = app('src/ai/visao.js')
  const ref = app('src/db/refeicoes.js')
  const tipos = ['sem_chave', 'chave_invalida', 'sem_internet', 'cota', 'timeout', 'json_invalido', 'lista_vazia', 'bloqueado', 'servidor', 'cancelado']
  for (const tipo of tipos) {
    const foto = fotoTemporaria()
    const r = await registrarRefeicaoPorFoto(foto, 'B64', undefined, async () => { throw new ErroVisao(tipo) })
    assert.equal(r.erro.tipo, tipo)
    assert.match(r.avisoFalha, /a foto ficou salva: registre os itens à mão\.$/)
    assert.ok(r.avisoFalha.startsWith(new ErroVisao(tipo).message))
    const salva = await ref.buscarRefeicao(r.refeicaoId)
    assert.deepEqual([salva.status, salva.foto_uri, salva.itens.length], ['pendente', foto, 0])
    assert.ok(fs.existsSync(fileURLToPath(foto)), tipo)
  }
  // erro inesperado (não é ErroVisao) também cai no manual
  const r = await registrarRefeicaoPorFoto(fotoTemporaria(), 'B64', undefined, async () => { throw new Error('boom') })
  assert.equal(r.erro.tipo, 'requisicao')
})

teste('ponta a ponta: foto -> prepararFoto -> Gemini (fetch mock) -> revisão -> confirmar -> excluir', async () => {
  await preparar()
  const secure = require(SHIMS['expo-secure-store']).__mock
  secure.itens.clear()
  await app('src/ai/chave.js').salvarChaveGemini('AIza-e2e')
  const { prepararFoto } = app('src/utils/foto.js')
  const { registrarRefeicaoPorFoto } = app('src/ai/fluxoFoto.js')
  const R = app('src/utils/rascunhoRefeicao.js')
  const ref = app('src/db/refeicoes.js')
  const { listarAlimentos } = app('src/db/alimentos.js')

  let corpoEnviado = null
  global.fetch = async (url, init) => {
    corpoEnviado = JSON.parse(init.body)
    const texto = JSON.stringify({ itens: [
      { nome: 'ovo frito', peso_g: 50, alimento_id: 490, confianca: 0.95 },
      { nome: 'pão francês', peso_g: 50, alimento_id: null, confianca: 0.9 },
    ] })
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: texto }] } }] }), { status: 200 })
  }

  const foto = await prepararFoto({ uri: fotoTemporaria('foto-do-cafe'), width: 3000, height: 4000 })
  const r = await registrarRefeicaoPorFoto(foto.fotoUri, foto.base64)
  assert.equal(corpoEnviado.contents[0].parts[0].inlineData.data, foto.base64)
  assert.equal(r.erro, null)

  // revisão: carrega como a tela, usuário corrige o peso do pão e confirma
  const salva = await ref.buscarRefeicao(r.refeicaoId)
  const porId = new Map((await listarAlimentos()).map(a => [a.id, a]))
  const itens = salva.itens.map(i => R.itemParaRascunho(i, porId.get(i.alimento_taco_id) ?? null))
  assert.deepEqual(itens.map(i => [i.nome, i.alimento?.nome, i.pesoTexto]), [
    ['ovo frito', 'Ovo, de galinha, inteiro, frito', '50'],
    ['pão francês', 'Pão, trigo, francês', '50'],
  ])
  itens[1] = { ...itens[1], pesoTexto: '70' }
  assert.equal(R.podeConfirmar(itens), true)
  await ref.salvarRefeicao(r.refeicaoId, itens.map(R.rascunhoParaDados), 'confirmada')
  assert.deepEqual(await ref.totaisDoDia(), { calorias: 330, proteina: 13.4, carboidrato: 41.6, gordura: 11.5 })

  // excluir apaga a foto do diretório de documentos
  await ref.excluirRefeicao(r.refeicaoId)
  assert.equal(fs.existsSync(fileURLToPath(foto.fotoUri)), false)
  assert.equal((await ref.totaisDoDia()).calorias, 0)
})
