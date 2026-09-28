import type { SQLiteDatabase } from 'expo-sqlite'
import taco from '../../assets/taco.json'

// gerado por scripts/converter-taco.js; se o JSON mudar, sobe a versão pra reimportar
export const VERSAO_TACO = '1'
const CHAVE_CONFIG = 'taco_versao'
const LOTE = 100

export type AlimentoTacoJson = {
  id: number
  nome: string
  nome_normalizado: string
  kcal: number | null
  proteina: number | null
  carboidrato: number | null
  gordura: number | null
  fibra: number | null
}

// roda na abertura do banco; só importa quando a versão gravada em config é diferente
export async function importarTacoSeNecessario(banco: SQLiteDatabase, alimentos: AlimentoTacoJson[] = taco) {
  const atual = await banco.getFirstAsync<{ valor: string }>('SELECT valor FROM config WHERE chave = ?', [CHAVE_CONFIG])
  if (atual?.valor === VERSAO_TACO) return false

  await banco.withTransactionAsync(async () => {
    await banco.runAsync('DELETE FROM alimentos_taco')
    for (let i = 0; i < alimentos.length; i += LOTE) {
      const lote = alimentos.slice(i, i + LOTE)
      const placeholders = lote.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
      const params = lote.flatMap(a => [
        a.id, a.nome, a.nome_normalizado, a.kcal, a.proteina, a.carboidrato, a.gordura, a.fibra,
      ])
      await banco.runAsync(
        `INSERT INTO alimentos_taco (id, nome, nome_normalizado, kcal, proteina, carboidrato, gordura, fibra) VALUES ${placeholders}`,
        params
      )
    }
    await banco.runAsync('INSERT OR REPLACE INTO config (chave, valor) VALUES (?, ?)', [CHAVE_CONFIG, VERSAO_TACO])
  })
  return true
}
