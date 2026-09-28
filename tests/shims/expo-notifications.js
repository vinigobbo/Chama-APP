// mock de expo-notifications. Com globalThis.__notif.lancarNoRequire, carregar o módulo lança erro,
// como o Expo Go faz desde o SDK 53. Cada carga real incrementa __notif.cargas.
const n = globalThis.__notif || (globalThis.__notif = { lancarNoRequire: false, cargas: 0 })
if (n.lancarNoRequire) throw new Error('expo-notifications: não suportado no Expo Go')
n.cargas++
n.handler = null
n.agendados = []
n.cancelamentos = 0
n.status = n.status || 'granted'
n.statusDepoisDePedir = n.statusDepoisDePedir || 'granted'
n.pedidos = 0
module.exports = {
  setNotificationHandler(h) { n.handler = h },
  async getPermissionsAsync() { return { status: n.status } },
  async requestPermissionsAsync() { n.pedidos++; return { status: n.statusDepoisDePedir } },
  async scheduleNotificationAsync(p) { n.agendados.push(p); return 'id-' + n.agendados.length },
  async cancelAllScheduledNotificationsAsync() { n.cancelamentos++; n.agendados = [] },
}
