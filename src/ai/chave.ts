import * as SecureStore from 'expo-secure-store'

// A chave do Gemini é do próprio usuário e fica só no armazenamento seguro do aparelho
// (Keystore no Android, Keychain no iOS). Nunca vai pro SQLite, arquivo ou log.
const CHAVE_STORE = 'gemini_api_key'
const OPCOES: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export async function salvarChaveGemini(chave: string) {
  await SecureStore.setItemAsync(CHAVE_STORE, chave.trim(), OPCOES)
}

export async function obterChaveGemini() {
  const chave = await SecureStore.getItemAsync(CHAVE_STORE, OPCOES)
  return chave && chave.trim() ? chave.trim() : null
}

export async function removerChaveGemini() {
  await SecureStore.deleteItemAsync(CHAVE_STORE, OPCOES)
}

// pra mostrar na tela sem revelar a chave: "…a1b2"
export function mascararChave(chave: string) {
  return chave.length <= 4 ? '••••' : `••••${chave.slice(-4)}`
}
