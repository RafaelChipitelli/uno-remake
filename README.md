# UNO Remake (Prototype)

Prototipo de jogo de cartas multiplayer em tempo real inspirado em UNO. O projeto está dividido entre um **cliente Phaser 3 (Vite + TypeScript)** e um **backend Node.js com Express + Socket.IO**, permitindo criar/entrar em salas e sincronizar ações básicas de cartas.

---

## ✅ Status Atual do Projeto

### ✔️ Funcionalidades Concluídas
- Multiplayer 100% sincronizado via Socket.IO
- Sistema de salas com código de 4 dígitos
- Baralho oficial completo do Uno com 108 cartas gerado corretamente
- Sistema de turnos com validação no servidor
- Segurança: cada jogador recebe APENAS a sua própria mão, nunca dos adversários
- Distribuição automática de cartas no inicio da partida
- Sistema de host da sala, apenas host pode iniciar o jogo
- Lobby, entrada e saída de salas
- HUD com log de ações em tempo real

### 📋 Tarefas Pendentes Imediatas
- [ ] Comprar cartas não mostra a carta para os outros jogadores
- [ ] Validação de cartas jogáveis
- [ ] Seleção de carta com clique na mão
- [ ] Efeito das cartas especiais
- [ ] Mecanica de vitória
- [ ] Regra do UNO!

---

## Funcionalidades atuais

- Lobby em canvas para criar sala ou entrar via código.
- HUD in-game com log de ações, lista de jogadores e status do jogador local.
- Sistema de criação/entrada/saída de salas com códigos aleatórios de 4 caracteres.
- Eventos de compra e descarte propagados em tempo real via Socket.IO.
- Placeholder visual de carta e badge com nickname, com texto escalando para high-DPI.
- Botão de sair da sala que retorna ao lobby e sincroniza o estado do servidor.

## Arquitetura

```
uno-remake/
├── client/   # Phaser 3 + Vite (TypeScript)
└── server/   # Express + Socket.IO (TypeScript, ts-node)
```

Cada pasta possui um README próprio com detalhes específicos.

## Requisitos

- Node.js 20+
- npm 10+

## Passo a passo

1. **Instale dependências**

   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

2. **Suba o servidor**

   ```bash
   cd server
   npx ts-node src/server.ts
   ```

   O backend ficará em `http://localhost:3001` (ajuste a origem em `src/server.ts` se necessário).

3. **Rode o cliente**

   ```bash
   cd client
   npm run dev
   ```

   Acesse `http://localhost:5173` no navegador. Abra a URL em duas abas para testar o fluxo multiplayer.

## Controles de teste

- **Lobby**
  - Clique em “Criar Sala” → gera código e entra automaticamente.
  - Clique em “Entrar com Código” → informa código (ex.: `ABCD`) e nickname.
- **Mesa**
  - `P`: simula jogar carta (broadcast `card:play`).
  - `D`: simula comprar carta (broadcast `card:draw`).
  - Botão “Sair da sala”: confirma saída e retorna ao lobby.

## 🚀 Roadmap de Implementação (Ordem de Prioridade)

### 🔴 PRIORIDADE ALTA (Regras Oficiais)
1. **Validação de cartas jogáveis**
   - Não pode jogar carta que não tem mesma cor, mesmo valor ou é curinga
   - Não pode comprar carta se tem carta válida na mão

2. **Seleção de carta na mão**
   - Clicar na carta que quer jogar ao invés de sempre jogar a primeira
   - Visual destaque na carta selecionada
   - Animação quando joga a carta para mesa

3. **Implementar efeitos das cartas especiais**
   - `skip`: Pula o turno do próximo jogador
   - `reverse`: Inverte a ordem dos turnos
   - `+2`: Próximo jogador compra 2 cartas e perde a vez
   - `wild`: Curinga - jogador escolhe uma nova cor
   - `+4`: Curinga +4 - jogador escolhe cor, próximo compra 4 e perde vez

4. **Regra do UNO!**
   - Quando jogador ficar com APENAS 1 carta, precisa anunciar "UNO" em até 2 segundos
   - Se não anunciar, outros jogadores podem acusar e ele compra 2 cartas

5. **Condição de vitória**
   - Quando um jogador jogar a última carta ele ganha a partida
   - Tela de vitória/derrota
   - Opção de jogar novamente

---

### 🟠 PRIORIDADE MÉDIA
6. Embaralhar pilha de descarte quando baralho acabar
7. Mostrar quantidade de cartas de cada adversário
8. Visualização dos jogadores ao redor da mesa
9. Timer por turno (15 segundos)
10. Sistema de pontuação entre partidas

---

### 🟢 PRIORIDADE BAIXA / Polimento
11. Animações de cartas (aparecer, voar, virar)
12. Efeitos sonoros
13. Chat de texto na sala
14. Melhorar UI e assets das cartas
15. Jogar contra bots

---

## 💡 Ideias Avançadas para o Futuro
- Sistema de decks customizados
- Criação de cartas customizadas com imagens e efeitos próprios
- Modos de jogo alternativos
- Customização de regras por sala
- Ranking e estatísticas de jogadores

---

Para mais detalhes específicos consulte `client/README.md` e `server/README.md`.
