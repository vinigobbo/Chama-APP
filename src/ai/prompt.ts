// Prompt e formato de resposta, independentes do provedor. A lista de alimentos é gerada a partir
// da tabela importada do assets/taco.json, nunca escrita à mão.

export type ItemCatalogo = { id: number; nome: string }

// uma linha por alimento: "3|Arroz, tipo 1, cozido"
export function formatarCatalogo(alimentos: ItemCatalogo[]) {
  return alimentos.map(a => `${a.id}|${a.nome}`).join('\n')
}

export function montarInstrucoes(alimentos: ItemCatalogo[]) {
  return `Você identifica alimentos em fotos de refeições para um diário alimentar brasileiro.

Regras:
- Identifique separadamente cada alimento visível na foto (arroz, feijão e carne no mesmo prato são 3 itens).
- "nome": nome genérico em português do Brasil, sempre com o estado de preparo quando fizer sentido: "arroz branco cozido", "feijão carioca cozido", "frango grelhado", "ovo frito", "banana prata crua". Sem marcas.
- "peso_g": estime o peso em gramas da porção realmente visível nesta foto, não de uma porção padrão. Use o tamanho do prato, dos talheres e da embalagem como referência de escala.
- "alimento_id": o id do alimento mais parecido na LISTA abaixo, respeitando o estado de preparo (não use um item "cru" para algo cozido, nem o contrário). Se nenhum item da lista servir, use null. Nunca invente um id.
- "confianca": de 0 a 1, o quanto você tem certeza da identificação.
- Não informe calorias, macronutrientes nem qualquer valor nutricional.
- Ignore pratos, talheres, copos vazios, guardanapos, embalagens e a mesa.
- Se não houver comida na foto, devolva "itens" vazio.

LISTA (id|nome), da Tabela Brasileira de Composição de Alimentos (TACO):
${formatarCatalogo(alimentos)}`
}

export const PEDIDO_USUARIO = 'Identifique os alimentos desta foto.'

// JSON Schema da resposta
export const SCHEMA_RESPOSTA = {
  type: 'object',
  properties: {
    itens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'nome genérico em português do Brasil, com o estado de preparo' },
          peso_g: { type: 'number', minimum: 1, maximum: 3000, description: 'peso estimado em gramas da porção visível' },
          alimento_id: { type: ['integer', 'null'], description: 'id da LISTA ou null' },
          confianca: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['nome', 'peso_g', 'alimento_id', 'confianca'],
      },
    },
  },
  required: ['itens'],
}
