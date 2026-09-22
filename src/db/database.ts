import * as SQLite from 'expo-sqlite'
import { CRIAR_TABELAS } from './schema'
import { HABITOS_SUGERIDOS } from '../data/habitosSugeridos'

let db: SQLite.SQLiteDatabase | null = null

export async function abrirBanco() {
  if (db) return db
  db = await SQLite.openDatabaseAsync('chama.db')
  for (const sql of CRIAR_TABELAS) {
    await db.execAsync(sql)
  }
  await migrar(db)
  return db
}

async function migrar(banco: SQLite.SQLiteDatabase) {
  const colunas = [
    'ALTER TABLE metas_semestrais ADD COLUMN emoji TEXT',
    'ALTER TABLE habitos ADD COLUMN emoji TEXT',
    "ALTER TABLE habitos ADD COLUMN frequencia_tipo TEXT NOT NULL DEFAULT 'diario'",
    'ALTER TABLE habitos ADD COLUMN frequencia_dias TEXT',
    'ALTER TABLE habitos ADD COLUMN data_referencia TEXT',
  ]
  for (const sql of colunas) {
    try {
      await banco.execAsync(sql)
    } catch (e) {
      // coluna já existe, ignora
    }
  }

  // tipo do hábito: na primeira vez que a coluna é criada, preenche os hábitos
  // existentes cujo nome bate com uma sugestão
  try {
    await banco.execAsync("ALTER TABLE habitos ADD COLUMN tipo TEXT NOT NULL DEFAULT 'geral'")
    await preencherTipoHabitosExistentes(banco)
  } catch (e) {
    // coluna já existe, ignora
  }
}

async function preencherTipoHabitosExistentes(banco: SQLite.SQLiteDatabase) {
  const normalizar = (nome: string) => nome.trim().toLowerCase()
  const tipoPorNome = new Map(HABITOS_SUGERIDOS.map(s => [normalizar(s.nome), s.tipo]))
  const habitos = await banco.getAllAsync('SELECT id, nome FROM habitos') as Array<{ id: number; nome: string }>
  for (const h of habitos) {
    const tipo = tipoPorNome.get(normalizar(h.nome))
    if (tipo) {
      await banco.runAsync("UPDATE habitos SET tipo = ? WHERE id = ? AND tipo = 'geral'", [tipo, h.id])
    }
  }
}

export function getBanco() {
  if (!db) throw new Error('Banco não foi aberto ainda')
  return db
}