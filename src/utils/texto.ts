// minúsculo, sem acento, pontuação vira espaço ("Pão, trigo, francês" -> "pao trigo frances").
// scripts/converter-taco.js usa a mesma regra pra gerar nome_normalizado.
export function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
