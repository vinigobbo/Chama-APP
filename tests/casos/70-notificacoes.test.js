const { teste, app, recarregarApp, assert, SHIMS } = global.ctx

// Recarrega o scheduler do zero no ambiente pedido. Com lancarNoRequire, qualquer
// require('expo-notifications') lança erro (como no Expo Go).
function carregarScheduler({ ambiente, lancarNoRequire }) {
  require(SHIMS['expo-constants']).__mock.ambiente = ambiente
  delete require.cache[SHIMS['expo-notifications']]
  globalThis.__notif = { lancarNoRequire, cargas: 0, tentativas: 0 }
  recarregarApp()
  return app('src/notifications/scheduler.js')
}

teste('notificações (Expo Go): importar e usar o scheduler não lança e nem tenta carregar o módulo', async () => {
  // o require do módulo dentro do teste confirma que o mock realmente lança
  globalThis.__notif = { lancarNoRequire: true }
  delete require.cache[SHIMS['expo-notifications']]
  assert.throws(() => require(SHIMS['expo-notifications']), /Expo Go/)

  let s
  assert.doesNotThrow(() => { s = carregarScheduler({ ambiente: 'storeClient', lancarNoRequire: true }) })
  assert.equal(s.notificacoesDisponiveis(), false)
  assert.equal(s.inicializarNotificacoes(), null)
  assert.equal(await s.pedirPermissao(), false)
  await s.agendarLembrete('21:30')
  await s.cancelarLembrete()
  assert.equal(globalThis.__notif.cargas, 0)
  // o módulo não entrou no cache: ninguém chegou a carregá-lo
  assert.equal(require.cache[SHIMS['expo-notifications']], undefined)
})

teste('notificações: se o módulo falhar ao carregar fora do Expo Go, fica indisponível sem quebrar', async () => {
  const s = carregarScheduler({ ambiente: 'bare', lancarNoRequire: true })
  assert.equal(s.notificacoesDisponiveis(), false)
  assert.equal(await s.pedirPermissao(), false)
  await s.agendarLembrete('08:00')
})

teste('notificações (build instalado): carrega uma vez, configura o handler e agenda', async () => {
  const s = carregarScheduler({ ambiente: 'standalone', lancarNoRequire: false })
  const n = () => globalThis.__notif
  assert.equal(n().cargas, 0) // importar o scheduler não carrega nada

  assert.equal(s.notificacoesDisponiveis(), true)
  assert.equal(n().cargas, 1)
  assert.ok(n().handler, 'handler não configurado')
  assert.deepEqual(await n().handler.handleNotification({}), {
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
  })

  // permissão já concedida: não pede de novo
  assert.equal(await s.pedirPermissao(), true)
  assert.equal(n().pedidos, 0)

  await s.agendarLembrete('21:30')
  assert.equal(n().cancelamentos, 1) // cancela o anterior antes de agendar
  assert.equal(n().agendados.length, 1)
  assert.deepEqual(n().agendados[0].trigger, { type: 'daily', hour: 21, minute: 30 })
  assert.equal(n().agendados[0].content.body, 'você ainda tem hábitos pendentes hoje')

  await s.cancelarLembrete()
  assert.equal(n().agendados.length, 0)
  s.inicializarNotificacoes()
  assert.equal(n().cargas, 1) // não recarrega nem reconfigura
})

teste('notificações (build instalado): pede permissão quando ainda não tem', async () => {
  const s = carregarScheduler({ ambiente: 'bare', lancarNoRequire: false })
  s.inicializarNotificacoes()
  globalThis.__notif.status = 'undetermined'
  globalThis.__notif.statusDepoisDePedir = 'denied'
  assert.equal(await s.pedirPermissao(), false)
  assert.equal(globalThis.__notif.pedidos, 1)
  globalThis.__notif.statusDepoisDePedir = 'granted'
  assert.equal(await s.pedirPermissao(), true)
})
