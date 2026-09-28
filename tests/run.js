// Testes em Node (npm test): compila os .ts do app com tsc pra CommonJS numa pasta temporária
// e roda tests/casos/*.test.js trocando os módulos nativos do Expo pelos mocks de tests/shims.
// expo-sqlite roda sobre node:sqlite, então precisa de Node 22.13+.
// Uso: npm test            (todos)
//      npm test -- busca   (só os testes cujo nome contém "busca")
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const Module = require('module')

const [maior, menor] = process.versions.node.split('.').map(Number)
if (maior < 22 || (maior === 22 && menor < 13)) {
  console.error(`os testes usam node:sqlite e precisam de Node 22.13+ (atual: ${process.version})`)
  process.exit(1)
}

const PROJETO = path.resolve(__dirname, '..')
const TESTES = __dirname
const TEMPORARIOS = []

function novaPasta(prefixo) {
  const p = fs.mkdtempSync(path.join(os.tmpdir(), prefixo))
  TEMPORARIOS.push(p)
  return p
}

function limpar() {
  for (const p of TEMPORARIOS) {
    try { fs.rmSync(p, { recursive: true, force: true }) } catch (e) { /* arquivo preso no Windows, o SO limpa depois */ }
  }
}

const BUILD = novaPasta('chama-tests-build-')

const ENTRADAS = [
  'src/db/database.ts',
  'src/db/alimentos.ts',
  'src/db/refeicoes.ts',
  'src/db/habitos.ts',
  'src/db/registros.ts',
  'src/db/metas.ts',
  'src/db/treinos.ts',
  'src/db/config.ts',
  'src/utils/nutricao.ts',
  'src/utils/buscaAlimentos.ts',
  'src/utils/rascunhoRefeicao.ts',
  'src/utils/frequencia.ts',
  'src/utils/periodos.ts',
  'src/utils/foto.ts',
  'src/notifications/scheduler.ts',
  'src/ai/visao.ts',
  'src/ai/chave.ts',
  'src/ai/fluxoFoto.ts',
]

try {
  execFileSync(process.execPath, [
    require.resolve('typescript/bin/tsc', { paths: [PROJETO] }),
    '--ignoreConfig', '--outDir', BUILD, '--rootDir', PROJETO,
    '--module', 'commonjs', '--moduleResolution', 'node10', '--ignoreDeprecations', '6.0',
    '--target', 'es2022', '--lib', 'es2022,dom',
    '--esModuleInterop', '--resolveJsonModule', '--skipLibCheck', '--strict',
    ...ENTRADAS.map(e => path.join(PROJETO, e)),
  ], { stdio: 'inherit' })
} catch (e) {
  console.error('\nfalha ao compilar o app pros testes')
  limpar()
  process.exit(1)
}

// módulos nativos -> mocks
const SHIMS = {}
for (const arq of fs.readdirSync(path.join(TESTES, 'shims'))) {
  SHIMS[path.basename(arq, '.js')] = path.join(TESTES, 'shims', arq)
}
const resolverOriginal = Module._resolveFilename
Module._resolveFilename = function (pedido, ...resto) {
  if (SHIMS[pedido]) return SHIMS[pedido]
  return resolverOriginal.call(this, pedido, ...resto)
}

// fotos e documentos do mock de expo-file-system também vão pra pastas temporárias
require(SHIMS['expo-file-system']).__mock.documentos = novaPasta('chama-tests-docs-')
require(SHIMS['expo-image-manipulator']).__mock.cache = novaPasta('chama-tests-cache-')

// recarrega os módulos do app (zera o `db` e os caches de módulo)
function recarregarApp() {
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(BUILD)) delete require.cache[k]
  }
}
function app(rel) {
  return require(path.join(BUILD, rel))
}
async function bancoNovo() {
  const sqlite = require(SHIMS['expo-sqlite'])
  sqlite.__shim.dir = novaPasta('chama-tests-db-')
  recarregarApp()
  await app('src/db/database.js').abrirBanco()
  return sqlite.__shim.dir
}
async function reabrirBanco(dir) {
  const sqlite = require(SHIMS['expo-sqlite'])
  sqlite.__shim.dir = dir
  recarregarApp()
  await app('src/db/database.js').abrirBanco()
}

const testes = []
function teste(nome, fn) { testes.push({ nome, fn }) }

global.ctx = {
  teste, app, bancoNovo, reabrirBanco, novaPasta, recarregarApp, SHIMS, PROJETO,
  FIXTURES: path.join(TESTES, 'fixtures'),
  assert: require('assert/strict'),
}

const filtro = process.argv[2]
for (const arq of fs.readdirSync(path.join(TESTES, 'casos')).sort()) {
  if (arq.endsWith('.test.js')) require(path.join(TESTES, 'casos', arq))
}

;(async () => {
  let ok = 0, falhas = 0
  for (const t of testes) {
    if (filtro && !t.nome.includes(filtro)) continue
    try {
      await t.fn()
      ok++
      console.log(`  ok    ${t.nome}`)
    } catch (e) {
      falhas++
      console.log(`  FALHA ${t.nome}\n        ${String((e && e.stack) || e).split('\n').slice(0, 6).join('\n        ')}`)
    }
  }
  // fecha os bancos antes de apagar as pastas (no Windows o arquivo aberto fica preso)
  for (const db of require(SHIMS['expo-sqlite']).__shim.abertos) {
    try { db.db.close() } catch (e) { /* já fechado */ }
  }
  limpar()
  console.log(`\n${ok} ok, ${falhas} falha(s)`)
  process.exit(falhas ? 1 : 0)
})()
