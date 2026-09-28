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

  // TACO 4ª ed. (NEPA/UNICAMP), valores por 100 g; null = não disponível na tabela
  `CREATE TABLE IF NOT EXISTS alimentos_taco (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    nome_normalizado TEXT NOT NULL,
    kcal REAL,
    proteina REAL,
    carboidrato REAL,
    gordura REAL,
    fibra REAL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_alimentos_taco_nome ON alimentos_taco(nome_normalizado)`,

  `CREATE TABLE IF NOT EXISTS refeicoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    horario TEXT NOT NULL,
    foto_uri TEXT,
    status TEXT NOT NULL DEFAULT 'pendente'
  )`,

  `CREATE INDEX IF NOT EXISTS idx_refeicoes_data ON refeicoes(data)`,

  // calorias/macros são o total do item (já multiplicados pelo peso)
  `CREATE TABLE IF NOT EXISTS itens_refeicao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    refeicao_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    peso_g REAL NOT NULL,
    alimento_taco_id INTEGER,
    calorias REAL,
    proteina REAL,
    carboidrato REAL,
    gordura REAL,
    editado_manual INTEGER NOT NULL DEFAULT 0
  )`,

  `CREATE INDEX IF NOT EXISTS idx_itens_refeicao_refeicao ON itens_refeicao(refeicao_id)`,
]