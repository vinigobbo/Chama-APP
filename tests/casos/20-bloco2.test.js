const { teste, app, bancoNovo, reabrirBanco, assert, PROJETO } = global.ctx
const fs = require('fs')
const path = require('path')

// ---------- nutricao.ts ----------
teste('nutricao: valor por 100 g × peso / 100 com 1 casa', () => {
  const { calcularMacro } = app('src/utils/nutricao.js')
  assert.equal(calcularMacro(128, 150), 192)
  assert.equal(calcularMacro(2.5, 150), 3.8) // 3,75 arredonda pra cima
  assert.equal(calcularMacro(0.2, 37), 0.1) // 0,074
  assert.equal(calcularMacro(1.5, 10), 0.2) // 0,15 não pode virar 0,1 por ponto flutuante
  assert.equal(calcularMacro(240, 0), 0)
  assert.equal(calcularMacro(98, 86), 84.3)
})

teste('nutricao: kcal null exige manual; macro null conta 0 e marca incompleto', () => {
  const { calcularItem } = app('src/utils/nutricao.js')
  assert.deepEqual(calcularItem({ kcal: 159, proteina: 32, carboidrato: 0, gordura: 2.5 }, 120),
    { calorias: 190.8, proteina: 38.4, carboidrato: 0, gordura: 3, macrosIncompletos: false })
  assert.deepEqual(calcularItem({ kcal: 216, proteina: null, carboidrato: null, gordura: null }, 50),
    { calorias: 108, proteina: 0, carboidrato: 0, gordura: 0, macrosIncompletos: true })
  assert.equal(calcularItem({ kcal: null, proteina: null, carboidrato: null, gordura: null }, 200).calorias, null)
})

teste('nutricao: soma ignora null e arredonda', () => {
  const { somarItens } = app('src/utils/nutricao.js')
  assert.deepEqual(somarItens([
    { calorias: 0.1, proteina: 0.2, carboidrato: null, gordura: 1 },
    { calorias: 0.2, proteina: 0.1, carboidrato: 3, gordura: null },
    { calorias: null, proteina: null, carboidrato: null, gordura: null },
  ]), { calorias: 0.3, proteina: 0.3, carboidrato: 3, gordura: 1 })
  assert.deepEqual(somarItens([]), { calorias: 0, proteina: 0, carboidrato: 0, gordura: 0 })
})

teste('texto: normalizar() do app bate com nome_normalizado do JSON (597 itens)', () => {
  const { normalizar } = app('src/utils/texto.js')
  const taco = JSON.parse(fs.readFileSync(path.join(PROJETO, 'assets/taco.json'), 'utf8'))
  assert.equal(taco.length, 597)
  for (const a of taco) assert.equal(normalizar(a.nome), a.nome_normalizado, a.nome)
})

// ---------- importação ----------
teste('importação: 597 itens na primeira abertura, valores e config', async () => {
  await bancoNovo()
  const { getBanco } = app('src/db/database.js')
  const db = getBanco()
  assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS n FROM alimentos_taco')).n, 597)
  assert.equal((await db.getFirstAsync("SELECT valor FROM config WHERE chave = 'taco_versao'")).valor, '1')
  const arroz = await db.getFirstAsync('SELECT * FROM alimentos_taco WHERE id = 3')
  assert.deepEqual(arroz, { id: 3, nome: 'Arroz, tipo 1, cozido', nome_normalizado: 'arroz tipo 1 cozido', kcal: 128, proteina: 2.5, carboidrato: 28.1, gordura: 0.2, fibra: 1.6 })
  const leite = await db.getFirstAsync('SELECT kcal, proteina FROM alimentos_taco WHERE id = 458')
  assert.deepEqual(leite, { kcal: null, proteina: null })
  const indices = (await db.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'")).map(r => r.name).sort()
  assert.deepEqual(indices, ['idx_alimentos_taco_nome', 'idx_itens_refeicao_refeicao', 'idx_refeicoes_data'])
})

teste('importação: reabrir o banco não reimporta', async () => {
  const dir = await bancoNovo()
  let db = app('src/db/database.js').getBanco()
  // marca uma linha; se reimportasse, a marca sumiria
  await db.runAsync("UPDATE alimentos_taco SET nome = 'MARCA' WHERE id = 1")
  await reabrirBanco(dir)
  db = app('src/db/database.js').getBanco()
  assert.equal((await db.getFirstAsync('SELECT nome FROM alimentos_taco WHERE id = 1')).nome, 'MARCA')
  assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS n FROM alimentos_taco')).n, 597)
  const r = await app('src/db/importarTaco.js').importarTacoSeNecessario(db)
  assert.equal(r, false)
})

teste('importação: versão diferente reimporta; falha no meio desfaz tudo', async () => {
  const dir = await bancoNovo()
  let db = app('src/db/database.js').getBanco()
  const { importarTacoSeNecessario } = app('src/db/importarTaco.js')
  await db.runAsync("UPDATE config SET valor = '0' WHERE chave = 'taco_versao'")

  // lote com uma linha inválida (nome null) no segundo lote: nada pode mudar
  const lista = JSON.parse(fs.readFileSync(path.join(PROJETO, 'assets/taco.json'), 'utf8')).slice(0, 150)
  lista[120] = { ...lista[120], nome: null }
  await db.runAsync("UPDATE alimentos_taco SET nome = 'MARCA' WHERE id = 1")
  await assert.rejects(importarTacoSeNecessario(db, lista))
  assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS n FROM alimentos_taco')).n, 597)
  assert.equal((await db.getFirstAsync('SELECT nome FROM alimentos_taco WHERE id = 1')).nome, 'MARCA')
  assert.equal((await db.getFirstAsync("SELECT valor FROM config WHERE chave = 'taco_versao'")).valor, '0')

  // reabrindo com a versão velha, reimporta do JSON
  await reabrirBanco(dir)
  db = app('src/db/database.js').getBanco()
  assert.equal((await db.getFirstAsync('SELECT nome FROM alimentos_taco WHERE id = 1')).nome, 'Arroz, integral, cozido')
  assert.equal((await db.getFirstAsync("SELECT valor FROM config WHERE chave = 'taco_versao'")).valor, '1')
})

// ---------- busca ----------
const CASOS = [
  ['arroz branco cozido', 3],
  ['feijão carioca cozido', 561],
  ['frango grelhado', 410],
  ['peito de frango grelhado', 410],
  ['ovo frito', 490],
  ['pão francês', 53],
  ['banana prata', 182],
]

teste('busca: casos pedidos (mostra o top 5 de cada)', async () => {
  await bancoNovo()
  const { buscarAlimentos, buscarCandidatos } = app('src/db/alimentos.js')
  for (const [termo, esperado] of CASOS) {
    const lista = await buscarAlimentos(termo, 5)
    const cands = await buscarCandidatos(termo, 5)
    console.log(`        "${termo}"`)
    lista.forEach((a, i) => console.log(`          ${i + 1}. [${a.id}] ${a.nome}  (${a.kcal} kcal)`))
    console.log(`          candidatos IA: ${cands.map(c => `${c.alimento.id}${c.casamentoAutomatico ? '*' : ''}`).join(', ')}  (* = casamento automático)`)
    assert.equal(lista[0].id, esperado, termo)
    assert.equal(cands[0].alimento.id, esperado, termo)
    assert.equal(cands[0].casamentoAutomatico, true, termo)
  }
})

teste('busca: ordem livre, pontuação e stopwords não importam', async () => {
  await bancoNovo()
  const { buscarAlimentos } = app('src/db/alimentos.js')
  for (const termo of ['grelhado frango peito', 'Frango, peito, sem pele, grelhado', 'peito do frango grelhado', 'PEITO FRANGO GRELHADO!!']) {
    assert.equal((await buscarAlimentos(termo, 1))[0].id, 410, termo)
  }
  // plural e gênero
  assert.equal((await buscarAlimentos('batatas fritas', 1))[0].id, 93)
  assert.equal((await buscarAlimentos('mandioca cozida', 1))[0].id, 129)
  // sinônimos
  assert.equal((await buscarAlimentos('aipim frito', 1))[0].id, 132)
  assert.equal((await buscarAlimentos('carne moída cozida', 1))[0].id, 326)
})

teste('busca: estado de preparo — não casa cozido com cru', async () => {
  await bancoNovo()
  const { buscarAlimentos, buscarCandidatos } = app('src/db/alimentos.js')
  assert.equal((await buscarAlimentos('arroz cru', 1))[0].id, 4)
  assert.equal((await buscarAlimentos('feijão carioca cru', 1))[0].id, 562)
  // TACO não tem macarrão cozido: nenhum candidato cru e nenhum casamento automático
  const mac = await buscarCandidatos('macarrão cozido', 5)
  assert.ok(mac.every(c => !/\bcru\b/.test(c.alimento.nome_normalizado)), JSON.stringify(mac.map(c => c.alimento.nome)))
  assert.ok(mac.every(c => !c.casamentoAutomatico))
  // na busca digitada o cru aparece, mas no fim
  const lista = await buscarAlimentos('macarrão cozido', 10)
  const idxCru = lista.findIndex(a => a.id === 40)
  assert.ok(idxCru === -1 || idxCru === lista.length - 1 || lista.slice(idxCru).every(a => /\bcru\b/.test(a.nome_normalizado)))
  // assado vs grelhado (conflito fraco): não é automático
  const assado = await buscarCandidatos('coração de frango assado', 3)
  assert.equal(assado[0].alimento.id, 395)
  assert.equal(assado[0].casamentoAutomatico, false)
})

teste('busca: palavra incompleta, só estado, vazio e sem resultado', async () => {
  await bancoNovo()
  const { buscarAlimentos, buscarCandidatos } = app('src/db/alimentos.js')
  assert.equal((await buscarAlimentos('fran grelh', 1))[0].id, 410)
  assert.equal((await buscarAlimentos('bana prat', 1))[0].id, 182)
  assert.deepEqual(await buscarAlimentos('   ', 5), [])
  assert.deepEqual(await buscarAlimentos('de com da', 5), [])
  assert.deepEqual(await buscarCandidatos('pizza calabresa', 5), [])
  // "cozido" sozinho lista cozidos, mas "xyz cozido" não casa só pelo estado
  assert.ok((await buscarAlimentos('cozido', 50)).length > 20)
  assert.deepEqual(await buscarCandidatos('xyz cozido', 5), [])
  // palavra incompleta não vale pra IA
  assert.deepEqual(await buscarCandidatos('fran grelh', 5), [])
})

// ---------- refeições ----------
teste('refeições: criar com data/horário locais, itens, editar, remover, confirmar', async () => {
  await bancoNovo()
  const r = app('src/db/refeicoes.js')
  const { hojeISO, horarioAgora } = app('src/utils/data.js')
  const id = await r.criarRefeicao()
  let ref = await r.buscarRefeicao(id)
  assert.equal(ref.data, hojeISO())
  assert.match(ref.horario, /^\d\d:\d\d$/)
  assert.equal(ref.horario.slice(0, 2), horarioAgora().slice(0, 2))
  assert.equal(ref.status, 'pendente')
  assert.equal(ref.foto_uri, null)

  const base = { editado_manual: 0 }
  const i1 = await r.adicionarItem(id, { ...base, nome: 'arroz', peso_g: 150, alimento_taco_id: 3, calorias: 192, proteina: 3.8, carboidrato: 42.2, gordura: 0.3 })
  const i2 = await r.adicionarItem(id, { ...base, nome: 'aguardente', peso_g: 50, alimento_taco_id: 472, calorias: 108, proteina: 0, carboidrato: 0, gordura: 0 })
  const i3 = await r.adicionarItem(id, { nome: 'bolo da vó', peso_g: 80, alimento_taco_id: null, calorias: 300, proteina: 4, carboidrato: 40, gordura: 12, editado_manual: 1 })
  ref = await r.buscarRefeicao(id)
  assert.deepEqual(ref.itens.map(i => [i.id, i.taco_nome, i.taco_macros_incompletos]), [
    [i1, 'Arroz, tipo 1, cozido', 0], [i2, 'Cana, aguardente', 1], [i3, null, 0],
  ])

  await r.editarItem(i1, { ...base, nome: 'arroz', peso_g: 100, alimento_taco_id: 3, calorias: 128, proteina: 2.5, carboidrato: 28.1, gordura: 0.2 })
  await r.removerItem(i2)
  ref = await r.buscarRefeicao(id)
  assert.deepEqual(ref.itens.map(i => [i.id, i.peso_g, i.calorias]), [[i1, 100, 128], [i3, 80, 300]])

  assert.deepEqual(await r.totaisDoDia(), { calorias: 0, proteina: 0, carboidrato: 0, gordura: 0 }) // ainda pendente
  await r.confirmarRefeicao(id)
  assert.equal((await r.buscarRefeicao(id)).status, 'confirmada')
  assert.deepEqual(await r.totaisDoDia(), { calorias: 428, proteina: 6.5, carboidrato: 68.1, gordura: 12.2 })
})

teste('refeições: listar do dia (ordem, itens, outros dias fora) e totais só de confirmadas', async () => {
  await bancoNovo()
  const r = app('src/db/refeicoes.js')
  const { hojeISO } = app('src/utils/data.js')
  const item = (cal) => ({ nome: 'x', peso_g: 100, alimento_taco_id: null, calorias: cal, proteina: 1, carboidrato: 1, gordura: 1, editado_manual: 1 })
  const tarde = await r.criarRefeicao({ horario: '13:10', status: 'confirmada' })
  const manha = await r.criarRefeicao({ horario: '07:30', status: 'confirmada' })
  const pend = await r.criarRefeicao({ horario: '20:00' })
  const ontem = await r.criarRefeicao({ data: '2000-01-01', horario: '12:00', status: 'confirmada' })
  await r.adicionarItem(tarde, item(500))
  await r.adicionarItem(tarde, item(100.25))
  await r.adicionarItem(manha, item(300))
  await r.adicionarItem(pend, item(999))
  await r.adicionarItem(ontem, item(777))
  await r.adicionarItem(manha, { ...item(null), editado_manual: 0 }) // kcal indisponível conta 0

  const lista = await r.listarRefeicoesDoDia()
  assert.deepEqual(lista.map(x => [x.id, x.itens.length]), [[manha, 2], [tarde, 2], [pend, 1]])
  assert.ok(lista.every(x => x.data === hojeISO()))
  assert.deepEqual(await r.totaisDoDia(), { calorias: 900.3, proteina: 4, carboidrato: 4, gordura: 4 })
  assert.equal((await r.totaisDoDia('2000-01-01')).calorias, 777)
  assert.deepEqual(await r.listarRefeicoesDoDia('1999-12-31'), [])
})

teste('refeições: salvarRefeicao aplica remoções, edições, inclusões e status', async () => {
  await bancoNovo()
  const r = app('src/db/refeicoes.js')
  const id = await r.criarRefeicao()
  const d = (nome, cal) => ({ nome, peso_g: 100, alimento_taco_id: null, calorias: cal, proteina: 0, carboidrato: 0, gordura: 0, editado_manual: 1 })
  const a = await r.adicionarItem(id, d('a', 1))
  const b = await r.adicionarItem(id, d('b', 2))
  await r.salvarRefeicao(id, [{ id: a, ...d('a2', 10) }, { id: null, ...d('c', 3) }], 'confirmada')
  const ref = await r.buscarRefeicao(id)
  assert.equal(ref.status, 'confirmada')
  assert.deepEqual(ref.itens.map(i => [i.nome, i.calorias]), [['a2', 10], ['c', 3]])
  assert.ok(!ref.itens.some(i => i.id === b))
})

teste('refeições: excluir apaga itens, registro e o arquivo da foto', async () => {
  await bancoNovo()
  const r = app('src/db/refeicoes.js')
  const fsMock = require(global.ctx.SHIMS['expo-file-system']).__mock
  const pasta = global.ctx.novaPasta('chama-fotos-')
  const foto = path.join(pasta, 'refeicao.jpg')
  fs.writeFileSync(foto, 'jpeg')
  const uri = require('url').pathToFileURL(foto).href
  const id = await r.criarRefeicao({ fotoUri: uri })
  const outra = await r.criarRefeicao()
  await r.adicionarItem(id, { nome: 'x', peso_g: 1, alimento_taco_id: null, calorias: 1, proteina: 0, carboidrato: 0, gordura: 0, editado_manual: 1 })
  await r.adicionarItem(outra, { nome: 'y', peso_g: 1, alimento_taco_id: null, calorias: 1, proteina: 0, carboidrato: 0, gordura: 0, editado_manual: 1 })
  await r.excluirRefeicao(id)
  assert.equal(await r.buscarRefeicao(id), null)
  assert.equal(fs.existsSync(foto), false)
  assert.ok(fsMock.apagados.includes(uri))
  const db = app('src/db/database.js').getBanco()
  assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS n FROM itens_refeicao WHERE refeicao_id = ?', [id])).n, 0)
  assert.equal((await r.buscarRefeicao(outra)).itens.length, 1)
  // foto já apagada / refeição sem foto: não quebra
  const semFoto = await r.criarRefeicao({ fotoUri: uri })
  await r.excluirRefeicao(semFoto)
  await r.excluirRefeicao(outra)
})
