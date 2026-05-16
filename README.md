# UNO Remake

Protótipo multiplayer em tempo real inspirado em UNO, com foco em partidas rápidas entre amigos.

## 🟢 Fase atual do projeto

Estamos em uma fase de **alpha funcional**: o loop principal da partida já está implementado e jogável, com sincronização em tempo real entre clientes.

- **Cliente:** Phaser 3 + Vite + TypeScript
- **Servidor:** Node.js + Express + Socket.IO + TypeScript
- **Opcional (cliente):** Firebase Auth (Google) + Firestore para perfil/estatísticas

Em resumo: já dá para criar sala, jogar rodada completa e encerrar com vencedor; agora o foco está em completar regras restantes do UNO e polir a experiência.

---

## 📌 Status atual (o que já funciona)

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
- Reciclagem automática do descarte quando o monte de compra acaba (mantém o coringa jogável).
- Regra do **UNO!** por desafio: botão no HUD (ou tecla `U`) — quem está com 1 carta declara; adversários veem o botão riscado e podem desafiar quem esqueceu, forçando +2.
- Lobby em HTML/CSS (Phaser carregado sob demanda só ao iniciar a partida).
- Health-check REST: `GET /health`.
- Login com Google e persistência de perfil/estatísticas em Firestore (**opcional**, no cliente).

---

## 🧩 Em evolução (prioridades atuais)

- Polimento visual/animações, UX da mesa e refinamentos de responsividade.
- Modos extras (pontuação por rodada, timer, bots, matchmaking etc.).

---

## 🗂️ Estrutura do projeto

```text
uno-remake/
├── client/   # Vite + TypeScript (lobby em DOM, partida em Phaser 3)
│   ├── src/config/      # Network/Firebase config
│   ├── src/game/        # Boot lazy do Phaser + utilitários de domínio
│   ├── src/scenes/      # GameScene + BootScene/ReturnToTitleScene e UI
│   ├── src/ui/          # Lobby DOM (titleScreen) e modais
│   └── src/services/    # Integrações (conta/estatísticas do jogador)
└── server/   # Express + Socket.IO + TypeScript
    ├── src/config/      # Variáveis de ambiente (PORT, CLIENT_ORIGIN)
    ├── src/core/        # Regras de cartas/turno/UNO/código de sala
    ├── src/__tests__/   # Testes das regras (node:test)
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

> Dica: para detalhes específicos de cada app, consulte também `client/README.md` e `server/README.md`.

---

## 🎮 Controles básicos no jogo

- Clique em uma carta da mão para jogar.
- `P`: joga uma carta válida (atalho).
- `D`: compra uma carta (somente na sua vez).
- `U`: declara **UNO!** (faça isso com 1 ou 2 cartas, senão compra +2).
- Botão para sair da sala no HUD.

---

## 🧪 Validação rápida (tipagem/build)

```bash
npm --prefix server run typecheck
npm --prefix server test
npm --prefix client run typecheck
npm --prefix client run build
```

---

## 🌍 Deploy em produção (Vercel + backend realtime)

Como este projeto usa **Socket.IO** com conexões em tempo real persistentes, a estratégia recomendada é:

- **Frontend (Vite/Phaser):** Vercel
- **Backend (Express/Socket.IO):** provedor Node "always-on" (ex.: Render, Railway, Fly.io)

> A Vercel é excelente para o client, mas o backend de jogo em tempo real deve ficar em um serviço adequado para WebSocket contínuo.

### 1) Deploy do backend (Render/Railway/Fly)

No diretório `server`, os scripts de produção são:

- `npm run build`
- `npm run start`

Configure variáveis de ambiente no provedor do backend:

- `PORT` = porta fornecida pela plataforma
- `CLIENT_ORIGIN` = URL pública do frontend na Vercel (ex.: `https://seu-projeto.vercel.app`)

Valide o backend publicado em:

- `GET /health` deve retornar `{ "status": "ok" }`

### 2) Deploy do frontend na Vercel

1. Importe o repositório na Vercel.
2. Configure **Root Directory** = `client`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Adicione Environment Variables:
   - `VITE_SERVER_URL=https://URL_DO_BACKEND_PUBLICO`
   - `VITE_FIREBASE_*` (se usar autenticação/Firestore)
6. Faça o deploy e teste multiplayer em duas abas/dispositivos.

### 3) Checklist de cuidados em produção

- **CORS:** `CLIENT_ORIGIN` deve bater exatamente com a URL da Vercel.
- **Firebase Auth:** adicione o domínio `.vercel.app` em Authorized domains.
- **Segredos:** nunca commitar `.env`; usar apenas variáveis no painel de cada plataforma.
- **Latência:** escolha região do backend próxima dos jogadores.
- **Plano gratuito:** pode haver cold starts/hibernação, afetando a primeira conexão.
- **Observabilidade:** monitore logs de conexão Socket.IO e erros de CORS.

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

## 🛣️ Roadmap por fases

### Fase atual — Alpha jogável (concluída em grande parte)

- Salas multiplayer e partida em tempo real.
- Regras principais de turno, compra e cartas especiais.
- Encerramento de rodada com vencedor.
- Regra do UNO! (declaração + penalidade) e reaproveitamento do descarte.
- Suite de testes das regras (`npm --prefix server test`).

### Próxima fase — Regras completas + robustez

1. Ajustes adicionais de consistência de estado e UX de feedback.
2. Persistência de salas (hoje o estado é só em memória).

### Fase seguinte — Expansão de produto

1. Sistema de pontuação por rodada e histórico.
2. Modos de jogo (timer, variações de regras, ranked/casual).
3. Bots e/ou matchmaking expandido.
