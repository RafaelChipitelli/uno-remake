# UNO Remake

Protótipo de jogo multiplayer em tempo real inspirado em UNO, com **cliente Phaser 3 (Vite + TypeScript)** e **servidor Node.js + Express + Socket.IO**.

## Status atual

### ✅ Já implementado
- Criação e entrada em salas com código curto.
- Lobby e partida sincronizados em tempo real via Socket.IO.
- Distribuição de cartas no início da partida.
- Controle de turnos validado no servidor.
- Segurança de mão: cada jogador recebe apenas suas próprias cartas.
- Validação de jogada no cliente e no servidor (cor, valor e curingas).
- Curinga com seleção obrigatória de cor.
- Efeitos de cartas especiais:
  - `skip`: pula o próximo jogador.
  - `+2`: próximo jogador compra 2 cartas e perde a vez.
  - `+4`: próximo jogador compra 4 cartas e perde a vez.
  - `reverse`:
    - com **2 jogadores**: funciona como `skip`.
    - com **3+ jogadores**: inverte o sentido dos turnos.

### 🧩 Em andamento / próximos passos
- Condição de vitória (encerrar rodada quando alguém zera a mão).
- Regra de UNO (anúncio e penalidade).
- Reaproveitar descarte quando o baralho acabar.
- Polimento visual/animações e UX da mesa.

## Arquitetura

```text
uno-remake/
├── client/   # Phaser 3 + Vite + TypeScript
│   ├── src/config/        # Configuração central (Phaser e URL do backend)
│   ├── src/game/          # Regras/utilitários de domínio (cores, validação UNO)
│   └── src/scenes/game/   # Módulos auxiliares da GameScene (constantes, modal, sockets)
└── server/   # Express + Socket.IO + TypeScript
    ├── src/config/        # Variáveis de ambiente e defaults
    ├── src/core/          # Lógica de jogo (cartas, turnos, eventos, sala)
    └── src/state/         # Store em memória e emissão de estado seguro
```

> Cada pasta possui README próprio com detalhes específicos.

## Requisitos

- Node.js 20+
- npm 10+

## Como rodar o projeto

### 1) Instalar dependências

```bash
npm --prefix server install
npm --prefix client install
```

### 2) Subir o servidor

```bash
npx --prefix server ts-node server/src/server.ts
```

Servidor em: `http://localhost:3001`

### 3) Subir o cliente

```bash
npm --prefix client run dev
```

Cliente em: `http://localhost:5173`

Para testar multiplayer local, abra em duas abas (ou dois navegadores).

## Controles atuais

- Clique em uma carta da mão para jogar.
- `P`: joga uma carta válida (atalho).
- `D`: compra uma carta (somente na sua vez).
- Botão de sair da sala disponível no HUD.

## Validação rápida (build/tipos)

```bash
npx --prefix server tsc -p server/tsconfig.json --noEmit
npm --prefix client run build
```

## Roadmap sugerido

1. Condição de vitória + fluxo de fim de rodada.
2. Regra de UNO (botão/anúncio + janela de punição).
3. Reciclagem do descarte quando o baralho zerar.
4. Melhorias visuais (animações, layout de mesa, feedback de ações).
5. Recursos extras (timer de turno, pontuação, bots, etc.).
