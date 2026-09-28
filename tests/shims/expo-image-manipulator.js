// mock de expo-image-manipulator (API contextual): registra as operações e grava um arquivo
// "processado" no cache temporário, como o nativo faz
const fs = require('fs')
const os = require('os')
const path = require('path')
const { fileURLToPath, pathToFileURL } = require('url')

// cache: o runner aponta pra uma pasta temporária que ele apaga no fim
const estado = { operacoes: [], cache: os.tmpdir() }

const SaveFormat = { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' }

const ImageManipulator = {
  manipulate(uri) {
    const ops = { origem: uri, resize: null, save: null }
    estado.operacoes.push(ops)
    const ctx = {
      resize(tamanho) { ops.resize = tamanho; return ctx },
      async renderAsync() {
        const original = fs.readFileSync(fileURLToPath(uri))
        return {
          async saveAsync(opcoes) {
            ops.save = opcoes
            const conteudo = Buffer.concat([Buffer.from('REDUZIDA:'), original])
            const destino = path.join(estado.cache, `manip-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`)
            fs.writeFileSync(destino, conteudo)
            return {
              uri: pathToFileURL(destino).href,
              width: 1024,
              height: 768,
              base64: opcoes.base64 ? conteudo.toString('base64') : undefined,
            }
          },
        }
      },
    }
    return ctx
  },
}

module.exports = { ImageManipulator, SaveFormat, __mock: estado }
