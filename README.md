# UNO Remake (Prototype)

## Arrumar:
   - quando vc joga uma carta atualiza para vc mas nao no servidor: done ✅
   - comprar cartas aparece para todos os jogadores a carta que alguem comprou
   - posicionamento das coisas no HUD
   - definir vez e so permitir ações na vez do jogador: done ✅ 
   - limitar comprar ou jogar cartas de acordo com as regras

Prototipo de jogo de cartas multiplayer em tempo real inspirado em UNO. O projeto está dividido entre um **cliente Phaser 3 (Vite + TypeScript)** e um **backend Node.js com Express + Socket.IO**, permitindo criar/entrar em salas e sincronizar ações básicas de cartas.

## Funcionalidades atuais

- Lobby em canvas para criar sala ou entrar via código.
- HUD in-game com log de ações, lista de jogadores e status do jogador local.
- Sistema de criação/entrada/saída de salas com códigos aleatórios de 4 caracteres.
- Eventos simulados de compra e descarte (`P` e `D`) propagados em tempo real via Socket.IO.
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

## Próximos Passos Sugeridos

- Implementar regras completas do UNO customizado (turnos, compra obrigatória, bloqueios, etc.).
- Melhorar o visual da tela inicial e do jogo
- Incorporar assets visuais das cartas e animações da mesa.

## Sugestões de Funcionalidades para o Futuro
- Implementação de decks customizados para partidas (Deck base uno + cartas criadas)
   - Criação de cartas customizadas com anexo de imagem e criação de efeito para adicionar nos decks

---

Para mais detalhes específicos consulte `client/README.md` e `server/README.md`.
