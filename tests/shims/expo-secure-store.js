// mock de expo-secure-store em memória
const itens = new Map()
const estado = { itens, chamadas: [], falhar: false }

module.exports = {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 5,
  async setItemAsync(k, v, opcoes) {
    if (estado.falhar) throw new Error('keystore indisponível')
    estado.chamadas.push(['set', k, opcoes])
    itens.set(k, v)
  },
  async getItemAsync(k) { return itens.has(k) ? itens.get(k) : null },
  async deleteItemAsync(k) { itens.delete(k) },
  __mock: estado,
}
