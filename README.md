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

### 🔔 Lembrete
Notificação diária num horário fixo, avisando quais hábitos ainda faltam no dia.

## Tecnologia

- **React Native** + **Expo** + **TypeScript**
- **SQLite local** (`expo-sqlite`) — todo o banco de dados vive no próprio aparelho
- **expo-notifications** para o lembrete diário
- Build de produção via **EAS Build**

## Design

Tema escuro minimalista, com um único acento âmbar usado de forma consistente em toda a interface — do streak ao grid de treinos — em vez de cores diferentes por seção.
