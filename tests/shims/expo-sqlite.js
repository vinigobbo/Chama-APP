// shim de expo-sqlite sobre node:sqlite (só o que o app usa)
const { DatabaseSync } = require('node:sqlite')
const path = require('path')

const estado = { dir: null, abertos: [] }

function params(args) {
  if (args.length === 1 && Array.isArray(args[0])) return args[0]
  return args
}

function checar(ps) {
  ps.forEach((p, i) => {
    if (p === undefined) throw new Error(`parâmetro ${i} é undefined`)
  })
  return ps
}

class ShimDatabase {
  constructor(arquivo) {
    this.db = new DatabaseSync(arquivo)
    this.arquivo = arquivo
    this.emTransacao = false
  }
  async execAsync(sql) { this.db.exec(sql) }
  async runAsync(sql, ...args) {
    const r = this.db.prepare(sql).run(...checar(params(args)))
    return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) }
  }
  async getFirstAsync(sql, ...args) {
    const r = this.db.prepare(sql).get(...checar(params(args)))
    return r === undefined ? null : { ...r }
  }
  async getAllAsync(sql, ...args) {
    return this.db.prepare(sql).all(...checar(params(args))).map(r => ({ ...r }))
  }
  async withTransactionAsync(fn) {
    if (this.emTransacao) throw new Error('transação aninhada')
    this.emTransacao = true
    this.db.exec('BEGIN')
    try {
      await fn()
      this.db.exec('COMMIT')
    } catch (e) {
      this.db.exec('ROLLBACK')
      throw e
    } finally {
      this.emTransacao = false
    }
  }
  async closeAsync() { this.db.close() }
}

async function openDatabaseAsync(nome) {
  if (!estado.dir) throw new Error('shim: defina __shim.dir antes de abrir')
  const db = new ShimDatabase(path.join(estado.dir, nome))
  estado.abertos.push(db)
  return db
}

module.exports = { openDatabaseAsync, __shim: estado }
