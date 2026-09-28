const { teste, app, bancoNovo, assert } = global.ctx

teste('nutricao: lerNumero e formatarDecimal', () => {
  const { lerNumero, formatarDecimal } = app('src/utils/nutricao.js')
  assert.equal(lerNumero('150'), 150)
  assert.equal(lerNumero('12,5'), 12.5)
  assert.equal(lerNumero(' 12.5 '), 12.5)
  assert.equal(lerNumero(',5'), 0.5)
  assert.equal(lerNumero('12,'), 12)
  for (const ruim of ['', '  ', 'abc', '1,2,3', '-5', '1e3', '12 g']) assert.equal(lerNumero(ruim), null, ruim)
  assert.equal(formatarDecimal(190.8, 0), '191')
  assert.equal(formatarDecimal(3.75), '3,8')
  assert.equal(formatarDecimal(3), '3')
  assert.equal(formatarDecimal(100), '100')
  assert.equal(formatarDecimal(0), '0')
  assert.equal(formatarDecimal(12.5), '12,5')
})

async function alimento(id) {
  return await app('src/db/alimentos.js').buscarAlimentoPorId(id)
}

teste('rascunho: item da tabela recalcula ao vivo pelo peso', async () => {
  await bancoNovo()
  const R = app('src/utils/rascunhoRefeicao.js')
  const frango = await alimento(410)
  const item = R.novoRascunho(frango, frango.nome)
  assert.equal(item.pesoTexto, '100')
  assert.deepEqual(R.calcularRascunho(item), {
    calorias: 159, proteina: 32, carboidrato: 0, gordura: 2.5, pesoG: 100,
    exigeManual: false, macrosIncompletos: false, pronto: true,
  })
  const c = R.calcularRascunho({ ...item, pesoTexto: '120,5' })
  assert.equal(c.calorias, 191.6)
  assert.equal(c.proteina, 38.6)
  // peso vazio/zero/inválido: não está pronto, kcal fica null
  for (const p of ['', '0', 'abc']) {
    const x = R.calcularRascunho({ ...item, pesoTexto: p })
    assert.equal(x.pronto, false, p)
    assert.equal(x.calorias, null, p)
  }
})

teste('rascunho: kcal null na tabela exige manual; macro null marca incompleto', async () => {
  await bancoNovo()
  const R = app('src/utils/rascunhoRefeicao.js')
  const leite = await alimento(458) // kcal "*" na TACO
  const item = R.novoRascunho(leite, leite.nome, 200)
  let c = R.calcularRascunho(item)
  assert.equal(c.exigeManual, true)
  assert.equal(c.pronto, false)
  c = R.calcularRascunho({ ...item, manual: { calorias: '122', proteina: '6,4', carboidrato: '', gordura: '6' } })
  assert.deepEqual([c.calorias, c.proteina, c.carboidrato, c.gordura, c.pronto], [122, 6.4, 0, 6, true])

  const pinga = await alimento(472) // kcal 216, sem macros
  const p = R.calcularRascunho(R.novoRascunho(pinga, pinga.nome, 50))
  assert.deepEqual([p.calorias, p.proteina, p.exigeManual, p.macrosIncompletos, p.pronto], [108, 0, false, true, true])
})

teste('rascunho: sem alimento da tabela exige macros manuais', () => {
  const R = app('src/utils/rascunhoRefeicao.js')
  const item = R.novoRascunho(null, 'bolo da vó', 80)
  assert.equal(R.calcularRascunho(item).pronto, false)
  const pronto = { ...item, manual: { calorias: '300', proteina: '', carboidrato: '', gordura: '' } }
  assert.equal(R.calcularRascunho(pronto).pronto, true)
  assert.equal(R.podeConfirmar([pronto]), true)
  assert.equal(R.podeConfirmar([pronto, item]), false)
  assert.equal(R.podeConfirmar([]), false)
  assert.deepEqual(R.rascunhoParaDados(pronto), {
    id: null, nome: 'bolo da vó', peso_g: 80, alimento_taco_id: null,
    calorias: 300, proteina: null, carboidrato: null, gordura: null, editado_manual: 1,
  })
})

teste('rascunho: total ao vivo soma só o que tem valor', async () => {
  await bancoNovo()
  const R = app('src/utils/rascunhoRefeicao.js')
  const arroz = await alimento(3)
  const feijao = await alimento(561)
  const itens = [
    R.novoRascunho(arroz, 'arroz branco cozido', 150),
    R.novoRascunho(feijao, 'feijão', 86),
    R.novoRascunho(null, 'molho', 30), // sem valores ainda
  ]
  assert.deepEqual(R.totalDoRascunho(itens), { calorias: 257.4, proteina: 7.9, carboidrato: 53.9, gordura: 0.7 })
})

teste('fluxo manual: criar como a tela faz, reabrir, editar, confirmar', async () => {
  await bancoNovo()
  const R = app('src/utils/rascunhoRefeicao.js')
  const ref = app('src/db/refeicoes.js')
  const { listarAlimentos } = app('src/db/alimentos.js')
  const arroz = await alimento(3)
  const leite = await alimento(458)

  // tela nova: nada no banco até salvar
  const rascunhos = [
    R.novoRascunho(arroz, arroz.nome, 150),
    { ...R.novoRascunho(leite, leite.nome, 200), manual: { calorias: '122', proteina: '6', carboidrato: '9', gordura: '6' } },
    { ...R.novoRascunho(null, 'bolo', 80), manual: { calorias: '300', proteina: '', carboidrato: '40', gordura: '' } },
  ]
  const id = await ref.criarRefeicao({ status: 'pendente' })
  await ref.salvarRefeicao(id, rascunhos.map(R.rascunhoParaDados), 'pendente')
  assert.equal((await ref.totaisDoDia()).calorias, 0)

  // reabre (como o useEffect da tela) e confere que volta igual
  const salva = await ref.buscarRefeicao(id)
  const porId = new Map((await listarAlimentos()).map(a => [a.id, a]))
  const reabertos = salva.itens.map(i => R.itemParaRascunho(i, i.alimento_taco_id === null ? null : porId.get(i.alimento_taco_id)))
  assert.deepEqual(reabertos.map(R.calcularRascunho), rascunhos.map(R.calcularRascunho))
  assert.deepEqual(salva.itens.map(i => [i.alimento_taco_id, i.editado_manual, i.taco_nome]), [
    [3, 0, 'Arroz, tipo 1, cozido'], [458, 1, 'Leite, de vaca, integral'], [null, 1, null],
  ])

  // troca o peso do arroz, remove o bolo, confirma
  reabertos[0] = { ...reabertos[0], pesoTexto: '100' }
  await ref.salvarRefeicao(id, [reabertos[0], reabertos[1]].map(R.rascunhoParaDados), 'confirmada')
  const final = await ref.buscarRefeicao(id)
  assert.equal(final.status, 'confirmada')
  assert.deepEqual(final.itens.map(i => [i.peso_g, i.calorias]), [[100, 128], [200, 122]])
  assert.deepEqual(await ref.totaisDoDia(), { calorias: 250, proteina: 8.5, carboidrato: 37.1, gordura: 6.2 })
})
