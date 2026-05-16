# UNO Remake

Two npm packages, no workspaces: `client/` (Vite + TS) and `server/` (Express + Socket.IO + TS). Always run npm with `--prefix`.

## Commands

```bash
npm --prefix server run dev        # game server (ts-node, long-running)
npm --prefix client run dev        # client (Vite, long-running)
npm --prefix server test           # rule tests (node:test)
npm --prefix server run typecheck
npm --prefix client run typecheck
npm --prefix client run build      # tsc + vite build
```

## Architecture

- Lobby is plain DOM/CSS (`client/src/ui/titleScreen.ts`); Phaser is lazy-loaded only when a match starts (`client/src/game/boot.ts`). Don't add lobby UI to Phaser scenes.
- `ReturnToTitleScene` (registered under key `TitleScene`) tears the game down and remounts the DOM lobby on exit.
- Game rules are server-authoritative in `server/src/core/`; the client never decides outcomes.
- Server room state is in-memory only (lost on restart).

## Workflow

- Don't auto-start long-running commands (dev/watch); prefer build/test/typecheck that exit (see `AGENTS.md`).
- Branch → logical commits → `--no-ff` merge into `main` → push. Commit messages short, in Portuguese, no `Co-Authored-By` trailer.
