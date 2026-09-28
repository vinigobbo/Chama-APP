import Constants, { ExecutionEnvironment } from 'expo-constants'

// expo-notifications não roda no Expo Go (desde o SDK 53 lança erro já no import).
// Por isso o módulo só é carregado aqui dentro, sob demanda, e nunca no Expo Go:
// lá as notificações ficam desativadas e o resto do app funciona.
type ModuloNotificacoes = typeof import('expo-notifications')

// undefined = ainda não tentou carregar; null = indisponível
let modulo: ModuloNotificacoes | null | undefined

export function inicializarNotificacoes(): ModuloNotificacoes | null {
  if (modulo !== undefined) return modulo
  modulo = null
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return modulo
  try {
    const Notifications: ModuloNotificacoes = require('expo-notifications')
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    })
    modulo = Notifications
  } catch (e) {
    modulo = null
  }
  return modulo
}

export function notificacoesDisponiveis() {
  return inicializarNotificacoes() !== null
}

export async function pedirPermissao() {
  const Notifications = inicializarNotificacoes()
  if (!Notifications) return false
  const { status } = await Notifications.getPermissionsAsync()
  if (status === 'granted') return true
  const { status: novoStatus } = await Notifications.requestPermissionsAsync()
  return novoStatus === 'granted'
}

export async function agendarLembrete(horario: string) {
  const Notifications = inicializarNotificacoes()
  if (!Notifications) return
  await cancelarLembrete()
  const [horas, minutos] = horario.split(':').map(Number)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'chama',
      body: 'você ainda tem hábitos pendentes hoje',
    },
    trigger: {
      type: 'daily' as any,
      hour: horas,
      minute: minutos,
    },
  })
}

export async function cancelarLembrete() {
  const Notifications = inicializarNotificacoes()
  if (!Notifications) return
  await Notifications.cancelAllScheduledNotificationsAsync()
}
