# UNO Remake

Protótipo de jogo multiplayer em tempo real inspirado em UNO, com:

- **Cliente:** Phaser 3 + Vite + TypeScript
- **Servidor:** Node.js + Express + Socket.IO + TypeScript
- **Opcional (cliente):** Firebase Auth (Google) + Firestore para perfil/estatísticas

Este README foi pensado para quem chegou agora no repositório e quer entender rápido **o que já existe** e **como rodar localmente**.

---

## 📌 O que já está funcionando

- Criação e entrada em salas com código curto.
- Lobby e partida sincronizados em tempo real via Socket.IO.
- Host da sala pode iniciar a partida.
- Distribuição inicial de cartas e controle de turnos no servidor.
- Compra de carta (`card:draw`) apenas na vez do jogador.
- Validação de jogada no cliente e no servidor (cor/valor/coringa).
- Curingas com seleção obrigatória de cor.
- Efeitos de cartas especiais:
  - `skip`: pula o próximo jogador
  - `reverse`:
    - com **2 jogadores**: atua como `skip`
    - com **3+ jogadores**: inverte direção do turno
  - `+2`: próximo jogador compra 2 e perde a vez
  - `+4`: próximo jogador compra 4 e perde a vez
- Condição de vitória: quando alguém zera a mão, a rodada termina e o vencedor é anunciado.
- Health-check REST: `GET /health`.

---

## 🧩 Em evolução (próximas melhorias)

- Regra de UNO (anúncio e penalidade).
- Reciclagem automática do descarte quando o baralho acabar.
- Polimento visual/animações e UX da mesa.
- Modos extras (pontuação por rodada, timer, bots etc.).

---

## 🗂️ Estrutura do projeto

```text
uno-remake/
├── client/   # Phaser 3 + Vite + TypeScript
│   ├── src/config/      # Network/Firebase/Phaser config
│   ├── src/game/        # Regras e utilitários de domínio
│   ├── src/scenes/      # Cenas (Title/Game) e UI
│   └── src/services/    # Integrações (conta/estatísticas do jogador)
└── server/   # Express + Socket.IO + TypeScript
    ├── src/config/      # Variáveis de ambiente (PORT, CLIENT_ORIGIN)
    ├── src/core/        # Regras de cartas/turno/código de sala
    └── src/state/       # Estado em memória e emissão de estado seguro
```

Readmes específicos:

- `client/README.md`
- `server/README.md`

---

## ✅ Pré-requisitos

- Node.js 20+
- npm 10+

---

## 🚀 Como rodar localmente

### 1) Instalar dependências

Na raiz do repositório:

```bash
npm --prefix server install
npm --prefix client install
```

### 2) Configurar variáveis de ambiente

#### Cliente

Copie o arquivo de exemplo:

```bash
copy client\.env.example client\.env.local
```

`client/.env.local`:

- `VITE_SERVER_URL` (default recomendado: `http://localhost:3001`)
- Variáveis do Firebase (opcionais; sem elas, login/estatísticas ficam desativados)

#### Servidor

Opcionalmente defina:

- `PORT` (default: `3001`)
- `CLIENT_ORIGIN` (default: `http://localhost:5173`)

### 3) Subir o servidor

```bash
npx --prefix server ts-node server/src/server.ts
```

Servidor: `http://localhost:3001`

### 4) Subir o cliente

Em outro terminal:

```bash
npm --prefix client run dev
```

Cliente: `http://localhost:5173`

Para testar multiplayer local, abra duas abas (ou dois navegadores) e entre na mesma sala.

---

## 🎮 Controles básicos no jogo

- Clique em uma carta da mão para jogar.
- `P`: joga uma carta válida (atalho).
- `D`: compra uma carta (somente na sua vez).
- Botão para sair da sala no HUD.

---

## 🧪 Validação rápida (tipagem/build)

```bash
npx --prefix server tsc -p server/tsconfig.json --noEmit
npm --prefix client run build
```

---

## 🔐 Firebase (opcional no cliente)

Se quiser habilitar login Google e persistência de perfil/estatísticas:

1. Preencha as variáveis `VITE_FIREBASE_*` em `client/.env.local`.
2. No Firebase Console:
   - habilite Google em **Authentication > Sign-in method**
   - confirme `localhost` em domínios autorizados
   - crie o Firestore
3. (Opcional) aplique regras iniciais para `users/{uid}` conforme `client/README.md`.

---

## 🛣️ Roadmap sugerido

1. Regra de UNO (chamada + punição).
2. Reaproveitamento do descarte quando o draw pile zerar.
3. Melhorias de UX/animações de jogada e turno.
4. Sistema de pontuação por rodada e histórico.
5. Bots e/ou matchmaking expandido.
