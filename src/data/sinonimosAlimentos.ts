// Trocas aplicadas na consulta (já normalizada) antes da busca, pra aproximar o jeito comum de falar
// do vocabulário da TACO. Chave e valor sem acento e minúsculos; a chave casa por palavra inteira.
export const SINONIMOS: Array<[string, string]> = [
  ['arroz branco', 'arroz tipo 1'],
  ['file de frango', 'frango peito sem pele'],
  ['carne moida', 'carne bovina acem moido'],
  ['bife', 'carne bovina contra file'],
  ['aipim', 'mandioca'],
  ['macaxeira', 'mandioca'],
  ['mussarela', 'mozarela'],
  ['muzarela', 'mozarela'],
  ['cafe preto', 'cafe infusao'],
  ['cafezinho', 'cafe infusao'],
]

// Em empate, ficam na frente: é o corte/variedade que alguém quer dizer quando fala genérico
// ("frango grelhado" -> peito, não coração; "feijão cozido" -> carioca).
export const IDS_PREFERIDOS = new Set([
  3,   // Arroz, tipo 1, cozido
  4,   // Arroz, tipo 1, cru
  561, // Feijão, carioca, cozido
  562, // Feijão, carioca, cru
  408, // Frango, peito, sem pele, cozido
  410, // Frango, peito, sem pele, grelhado
  91,  // Batata, inglesa, cozida
  93,  // Batata, inglesa, frita
  488, // Ovo, de galinha, inteiro, cozido/10minutos
  490, // Ovo, de galinha, inteiro, frito
  53,  // Pão, trigo, francês
])
