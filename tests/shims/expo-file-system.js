// mock de expo-file-system (API nova: File, Directory, Paths) sobre o disco real, numa pasta temporária
const fs = require('fs')
const path = require('path')
const { fileURLToPath, pathToFileURL } = require('url')

const estado = { documentos: null, apagados: [] }

function paraCaminho(uri) {
  return uri.startsWith('file:') ? fileURLToPath(uri) : uri
}

function juntar(partes) {
  const strs = partes.map(p => (typeof p === 'string' ? p : p.uri))
  const base = paraCaminho(strs[0])
  return path.join(base, ...strs.slice(1))
}

class File {
  constructor(...partes) {
    this.caminho = juntar(partes)
    this.uri = pathToFileURL(this.caminho).href
  }
  get exists() { return fs.existsSync(this.caminho) }
  get name() { return path.basename(this.caminho) }
  delete() {
    if (!fs.existsSync(this.caminho)) throw new Error('arquivo não existe')
    fs.unlinkSync(this.caminho)
    estado.apagados.push(this.uri)
  }
  async base64() { return fs.readFileSync(this.caminho).toString('base64') }
  async copy(destino) { fs.copyFileSync(this.caminho, destino.caminho) }
  async move(destino) {
    fs.renameSync(this.caminho, destino.caminho)
    this.caminho = destino.caminho
    this.uri = destino.uri
  }
  write(conteudo) { fs.writeFileSync(this.caminho, conteudo) }
}

class Directory {
  constructor(...partes) {
    this.caminho = juntar(partes)
    this.uri = pathToFileURL(this.caminho).href + '/'
  }
  get exists() { return fs.existsSync(this.caminho) }
  create(opcoes = {}) { fs.mkdirSync(this.caminho, { recursive: !!opcoes.intermediates || !!opcoes.idempotent }) }
}

class Paths {
  static get document() { return new Directory(estado.documentos) }
}

module.exports = { File, Directory, Paths, __mock: estado }
