# Chama

App pessoal de hábitos e metas, feito sob medida pra substituir anotações soltas no bloco de notas por um sistema de verdade — com histórico, streaks e um jeito visual de acompanhar consistência ao longo do tempo.

Todos os dados ficam **armazenados apenas no celular**, sem nuvem, sem conta, sem sincronização. É uma ferramenta pessoal, não um produto multiusuário.

## O que ele faz

### 📋 Hábitos diários
Lista de hábitos do dia (academia, estudar, arrumar a cama, e o que mais fizer sentido), cada um com:
- Emoji e sugestões organizadas por categoria (saúde, estudo, financeiro, trabalho)
- Frequência configurável — todo dia, dias específicos da semana, ou "dia sim, dia não"
- Streak de dias seguidos, que respeita a frequência de cada hábito (não quebra a sequência em dias de folga programados)

### 🎯 Metas semestrais
Metas de longo prazo com valor atual vs. valor alvo (dinheiro a guardar, peso a atingir, etc.), com:
- Contagem regressiva de dias até o prazo final
- Barra de progresso atualizada manualmente conforme os números mudam
- Mesma lógica de sugestão por categoria e emoji dos hábitos

### 💪 Academia
- Mapa de dias no estilo GitHub (quadradinhos que acendem nos dias que você foi à academia), com rolagem contínua pelas últimas semanas
- Seção de treinos: monte suas rotinas (Superiores, Inferiores, etc.) escolhendo exercícios de uma lista organizada por grupo muscular, com espaço pra anotar séries e carga

### 🍽️ Alimentação
- Tire uma foto da refeição (ou escolha da galeria) e a IA identifica cada alimento e estima o peso da porção visível; dá pra registrar tudo à mão também
- Toda refeição passa por uma revisão: troque o alimento, corrija os gramas, remova ou adicione itens antes de confirmar
- Resumo do dia com calorias, proteína, carboidrato e gordura (só refeições confirmadas contam)

Funciona em duas camadas: a **IA só identifica** o alimento e o peso (e aponta o item mais próximo da tabela); **calorias e macros sempre vêm da TACO**, a Tabela Brasileira de Composição de Alimentos, guardada no SQLite local. A IA nunca fornece valor nutricional.

A identificação por foto usa o **Gemini com a chave de API do próprio usuário**, colada em Configurações e guardada no armazenamento seguro do aparelho. Nenhuma chave vem embutida no app. A foto é enviada ao Google; no plano gratuito do Gemini o conteúdo pode ser usado pra melhorar os produtos dele, no pago não.

### 🔔 Lembrete
Notificação diária num horário fixo, avisando quais hábitos ainda faltam no dia.

## Tecnologia

- **React Native** + **Expo** + **TypeScript**
- **SQLite local** (`expo-sqlite`) — todo o banco de dados vive no próprio aparelho
- **expo-notifications** para o lembrete diário
- **expo-image-picker**, **expo-image-manipulator**, **expo-secure-store** e **expo-file-system** para a foto da refeição e a chave do Gemini
- **Gemini API** (`gemini-3.5-flash-lite`) para identificar os alimentos
- Build de produção via **EAS Build**

## Design

Tema escuro minimalista, com um único acento âmbar usado de forma consistente em toda a interface — do streak ao grid de treinos — em vez de cores diferentes por seção.

## Fonte dos dados nutricionais

Tabela Brasileira de Composição de Alimentos – TACO, 4ª edição revisada e ampliada. NEPA/UNICAMP, Campinas, 2011. A obra permite reprodução total ou parcial desde que citada a fonte. O `assets/taco.json` é gerado por `scripts/converter-taco.js` a partir do CSV da TACO, conferido linha a linha contra o PDF oficial.
