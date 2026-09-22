export const CRIAR_TABELAS = [
  `CREATE TABLE IF NOT EXISTS habitos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    icone TEXT,
    emoji TEXT,
    frequencia_tipo TEXT NOT NULL DEFAULT 'diario',
    frequencia_dias TEXT,
    data_referencia TEXT,
    tipo TEXT NOT NULL DEFAULT 'geral',
    ativo INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE TABLE IF NOT EXISTS registros_diarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habito_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    feito INTEGER NOT NULL DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS metas_semestrais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    emoji TEXT,
    valor_alvo REAL NOT NULL,
    unidade TEXT,
    data_inicio TEXT NOT NULL,
    data_fim TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS registros_progresso (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meta_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    valor REAL NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS config (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS treinos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS treino_exercicios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    treino_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    grupo TEXT NOT NULL,
    notas TEXT,
    ordem INTEGER NOT NULL DEFAULT 0
  )`,
]