# UNO Remake — Cliente

Interface construída com **Phaser 3**, **Vite** e **TypeScript** para o protótipo multiplayer estilo UNO.

## Pré-requisitos

- Node.js 20+ (recomendado)  
- npm 10+
- Servidor Socket.IO rodando em `http://localhost:3001` (veja `../server`)

## Instalação

```bash
cd client
npm install
```

## Scripts úteis

| Script           | Descrição                                                                 |
| ---------------- | ------------------------------------------------------------------------- |
| `npm run dev`    | Inicia Vite em modo desenvolvimento (porta 5173 por padrão).              |
| `npm run build`  | Executa `tsc` e gera o bundle de produção com o Vite.                     |
| `npm run preview`| Serve o build gerado para validação rápida.                               |

> Durante o desenvolvimento, abra `http://localhost:5173` e confirme que o backend está ativo para que o `socket.io-client` consiga conectar.

## Estrutura resumida

- `src/main.ts` – ponto de entrada do Phaser.
- `src/config/phaser.ts` – criação da configuração principal do jogo.
- `src/config/network.ts` – URL do backend (`VITE_SERVER_URL` com fallback local).
- `src/game/` – regras/utilitários de domínio (cores e validações de jogada).
- `src/scenes/TitleScene.ts` – lobby para criar/entrar em salas.
- `src/scenes/GameScene.ts` – orquestração da partida em tempo real.
- `src/scenes/game/` – módulos auxiliares da GameScene (constantes, handlers de socket, modal de curinga).
- `src/scenes/ui/` – componentes visuais reutilizáveis (HUD e mesa/cartas).
- `src/types.ts` – contratos compartilhados com o backend.

## Personalização

- Para apontar para outro backend, defina `VITE_SERVER_URL` (ex.: `.env.local`) ou altere `src/config/network.ts`.
- As cores de tema estão centralizadas em `src/theme/tokens.ts`.
- Padrão recomendado: **não adicionar novos hex/0x direto em cenas/componentes**; crie/ajuste token em `tokens.ts` e consuma via `theme` (strings) ou `phaserTheme` (numbers).

## Login com Google + Firestore (Firebase)

O cliente agora está preparado para autenticação com Google e persistência de perfil/estatísticas em Firestore.

### 1) Instale dependências (se ainda não instalou)

```bash
npm install
```

### 2) Configure suas credenciais de ambiente

Copie `client/.env.example` para `client/.env.local` e preencha os valores do seu projeto Firebase:

```bash
copy .env.example .env.local
```

Variáveis esperadas:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (opcional)

> Sem essas variáveis, o jogo continua rodando, mas login/estatísticas ficam desativados.

### 3) Ative recursos no Firebase Console

1. **Authentication > Sign-in method**: habilite **Google**.
2. **Authentication > Settings > Authorized domains**: confirme `localhost`.
3. **Firestore Database**: crie o banco (modo teste ou produção).

### 4) Estrutura de dados utilizada

Coleção: `users`  
Documento: `users/{uid}`

Campos principais:

- `uid`
- `nickname`
- `email`
- `photoURL`
- `stats.gamesPlayed`
- `stats.gamesWon`
- `stats.gamesLost`
- `createdAt`
- `updatedAt`
- `lastLoginAt`

### 5) Regras iniciais sugeridas (Firestore Rules)

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

### 6) O que já foi integrado no jogo

- Botão **Entrar com Google** na `TitleScene`.
- Botão de **logout** quando autenticado.
- Nickname carregado/salvo no Firestore.
- Estatísticas atualizadas no fim da partida (`jogos jogados`, `ganhos`, `perdidos`).
