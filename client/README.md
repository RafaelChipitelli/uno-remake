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
- As fontes/cores principais estão centralizadas em módulos de `src/scenes/game` e `src/game` para facilitar manutenção.
