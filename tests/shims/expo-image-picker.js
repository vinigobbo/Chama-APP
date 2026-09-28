// mock de expo-image-picker: o teste define permissão e resultado
const estado = {
  permissao: { granted: true, canAskAgain: true, status: 'granted' },
  resultado: { canceled: true, assets: null },
  chamadas: [],
}

module.exports = {
  async requestCameraPermissionsAsync() {
    estado.chamadas.push(['permissaoCamera'])
    return estado.permissao
  },
  async requestMediaLibraryPermissionsAsync() {
    estado.chamadas.push(['permissaoGaleria'])
    return estado.permissao
  },
  async launchCameraAsync(opcoes) {
    estado.chamadas.push(['camera', opcoes])
    return estado.resultado
  },
  async launchImageLibraryAsync(opcoes) {
    estado.chamadas.push(['galeria', opcoes])
    return estado.resultado
  },
  __mock: estado,
}
