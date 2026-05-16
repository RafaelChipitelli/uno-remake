# UX / Produto — Roadmap

Backlog de UI/UX inspirado no Richup.io, para evoluir o UNO Remake aos poucos.
Cada item: **o que é**, **por que**, **escopo inicial**. Prioridade: 🔴 alta · 🟡 média · 🟢 quando der.

> Estado hoje: lobby DOM (Richup-like), partida em Phaser, login Google opcional
> (perfil/estatísticas no Firestore), regra do UNO! por desafio, cartas iniciais
> configuráveis. Sem store/amigos/níveis/áudio/configurações.

---

## 1. Correções / dívida técnica

### 1.1 ✅ HUD re-renderiza inteiro a cada clique — RESOLVIDO
`GameHud.update()` reconstruía **todo** o HUD a cada flag de ação.
**Feito:** rebuild só em mudança *estrutural* (`roundInProgress`,
`canConfigureStart`); enable/disable, status, listas e o valor do stepper são
aplicados granularmente (`refreshDynamicContent` + `applyButtonState` +
`refreshStartingCardsStepper`). Sem flicker / sem perder hover por jogada.

### 1.2 🟡 Reconexão de socket
Hoje cair a conexão = sair da partida. Adicionar reconnect com re-sync de
estado da sala (o servidor já é autoritativo; falta o cliente reentrar).

### 1.3 🟡 Foco/teclado e acessibilidade no lobby DOM
Estados de foco visíveis, navegação por Tab, `aria-label` nos botões do lobby.

---

## 2. Menu / navegação (topo, estilo Richup)

### 2.1 🔴 Dropdown de conta (avatar no canto superior direito)
Avatar clicável → menu: **Seu perfil**, **Configurações**, **Sair**.
Hoje o lobby só tem "Sair do Google" como texto solto. Centralizar tudo num
dropdown com o avatar (ref.: print do menu Richup).
**Escopo:** componente DOM reaproveitável, abre/fecha, fora-clique fecha.

### 2.2 🟡 Barra superior persistente
Logo (volta ao lobby) + "amigos online" + Store + avatar. Aparece no lobby e,
de forma compacta, na tela de perfil/configurações.

### 2.3 🟢 Browser de salas ("All rooms")
Lista de salas públicas com nº de jogadores e status, entrar com 1 clique.
O servidor já tem salas públicas (quick-play); falta a listagem.

---

## 3. Perfil do jogador (ref.: print "Profile")

### 3.1 🔴 Página de perfil
Avatar + nickname (editável), e blocos:
- **Estatísticas:** jogos jogados, vitórias, "entrou há X", nº de amigos.
- **Win rate:** % de vitórias (já temos `gamesPlayed`/`gamesWon` no Firestore).
- **Últimos jogos:** data, com quem jogou (avatars), duração, resultado
  (vitória/derrota), nº de turnos. Precisa o servidor persistir histórico de
  partidas (hoje só agrega stats).
- **Inventário** (ver §5) e **Amigos** (ver §4).

### 3.2 🟡 Editar perfil
Trocar nickname e foto de perfil. Nickname já existe; foto = upload/galeria de
avatares (cosmético, liga com inventário).

---

## 4. Social / amigos

### 4.1 🟡 Lista de amigos + presença online
"X amigos online" no topo; lista com status. Precisa modelo de amizade
(pedido/aceite) e presença (socket).

### 4.2 🟢 Bloquear usuário
Restringir interação (como no Settings do Richup). Depende de §4.1.

### 4.3 🟢 Convidar amigo para sala
Botão "convidar" na sala privada, gera link/code (code já existe).

---

## 5. Economia / progressão

### 5.1 🟡 Sistema de pontos/níveis ("Karma")
Pontos por jogar/vencer (ref.: "20 Karma points", "20/22"). Define progressão
e talvez desbloqueios. Servidor precisa creditar pontos no fim da partida.

### 5.2 🟢 Inventário de cosméticos
Itens equipáveis (temas de carta, avatares — ref.: "Mr. Worldwide", "Lucky
Wheel"). Começa simples: 2–3 skins de verso de carta selecionáveis.

### 5.3 🟢 Store
Vitrine de itens (grátis/por pontos). Depende de §5.1 e §5.2. Pode começar só
com itens grátis equipáveis, sem moeda real.

---

## 6. Configurações / sistema

### 6.1 🟡 Página de Configurações
Conta (editar usuário), contas vinculadas (Google — já temos), bloqueados.
Layout em cards como o Settings do Richup; botão "Voltar ao lobby".

### 6.2 🔴 Áudio / volume
Controle de volume + mute (ícone de som no canto, como o Richup). Pré-requisito
para efeitos sonoros (jogar carta, comprar, UNO!, vitória). Persistir em
`localStorage`.

### 6.3 🟢 Preferências de jogo
Idioma (já existe no lobby — mover/replicar aqui), reduzir animações
(`prefers-reduced-motion` já respeitado em parte), tema.

---

## 7. Polimento de jogo (mesa/HUD)

- 🟡 Som + feedback visual em eventos (carta jogada, +2/+4, skip, reverse, UNO!).
- 🟡 Animação de carta saindo da mão → descarte (hoje é instantâneo).
- 🟢 Indicador de direção do jogo (horário/anti-horário) mais claro.
- 🟢 Chat de partida (mensagens rápidas/emotes, leve).

---

## Ordem sugerida

1. ~~**1.1** (bug do HUD)~~ — ✅ feito.
2. **2.1** + **6.1/6.2** — menu de conta, configurações e áudio (base do resto).
3. **3.1** — perfil com win rate + últimos jogos (precisa histórico no server).
4. **5.1** — pontos/níveis (alimenta store/inventário).
5. **4.x / 5.2 / 5.3** — social e economia.
6. **7.x** — polimento contínuo.
