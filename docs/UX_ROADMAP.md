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

### 2.1 ✅ Dropdown de conta (avatar no canto superior direito) — RESOLVIDO
Avatar (foto Google ou iniciais) → menu: Seu perfil (placeholder), Configurações,
Entrar/Sair, seletor BR/US. Fora-clique + Esc fecham; acessível (aria, foco).

### 2.2 🟡 Barra superior persistente
Logo (volta ao lobby) + "amigos online" + Store + avatar. Aparece no lobby e,
de forma compacta, na tela de perfil/configurações.

### 2.3 🟢 Browser de salas ("All rooms")
Lista de salas públicas com nº de jogadores e status, entrar com 1 clique.
O servidor já tem salas públicas (quick-play); falta a listagem.

---

## 3. Perfil do jogador (ref.: print "Profile")

### 3.1 ✅ Página de perfil — RESOLVIDO
Overlay DOM: avatar (foto/iniciais compartilhado), nickname, "membro desde",
stats (jogados/vitórias/derrotas), **win rate**, e **últimos jogos**
(`users/{uid}/matches` no Firestore: data, resultado, adversários, duração,
turnos). Estados loading/empty/sem-login. Inventário/Amigos virão (§4/§5).

### 3.2 🟡 Editar perfil
Trocar nickname e foto de perfil. Nickname já existe; foto = upload/galeria de
avatares (cosmético, liga com inventário).

---

## 4. Social / amigos

> ⏸️ **Adiado para um lote dedicado (Lote F).** Amizade (pedido/aceite) +
> presença online exigem trabalho no servidor de socket (presença em tempo
> real) e um modelo de relações — design próprio, não cabe no autopilot dos
> lotes A–E sem um desenho específico.

### 4.1 🟡 Lista de amigos + presença online
"X amigos online" no topo; lista com status. Precisa modelo de amizade
(pedido/aceite) e presença (socket).

### 4.2 🟢 Bloquear usuário
Restringir interação (como no Settings do Richup). Depende de §4.1.

### 4.3 🟢 Convidar amigo para sala
Botão "convidar" na sala privada, gera link/code (code já existe).

---

## 5. Economia / progressão

### 5.1 ✅ Sistema de pontos/níveis ("Karma") — RESOLVIDO
`services/karma.ts` (puro): +2 por jogo, +5 por vitória; curva triangular de
nível (`levelForKarma`). Persistido em `stats.karma` (Firestore, increment +
otimista). Card de nível/progresso no perfil + "Nível N" no dropdown.

### 5.2 ✅ Inventário de cosméticos — RESOLVIDO
4 skins de verso de carta (`classic` nv1, `amethyst` nv2, `emerald` nv4,
`crimson` nv7). Equipável, persistido (Firestore p/ logado, localStorage p/
convidado), aplicado no verso/placeholder do CardStage (default byte-idêntico).

### 5.3 ✅ Store — RESOLVIDO
Overlay DOM (item "Loja" no dropdown): grid com preview, estados
Equipado/Equipar/🔒 Nível N (desbloqueio por nível do Karma).

---

## 6. Configurações / sistema

### 6.1 ✅ Página de Configurações — RESOLVIDO
Overlay DOM em cards: conta/nickname (editável; nuvem p/ logado, compartilhado
c/ o lobby p/ convidado), conta Google vinculada, áudio, "Voltar ao lobby".
Esc volta; acessível.

### 6.2 ✅ Áudio / volume — RESOLVIDO (UI + persistência + API)
`services/audio.ts`: volume/mute em `localStorage`, API
`get/setVolume/setMuted/toggleMuted/subscribeAudio/getEffectiveVolume`.
Slider+mute nas Configurações. **Falta só** ligar aos SFX (lote E).

### 6.3 🟢 Preferências de jogo
Idioma (já existe no lobby — mover/replicar aqui), reduzir animações
(`prefers-reduced-motion` já respeitado em parte), tema.

---

## 7. Polimento de jogo (mesa/HUD)

- ✅ Som (SFX sintetizado via Web Audio, sem assets) + feedback visual em
  eventos (carta jogada, +2/+4, skip, reverse, UNO!, vitória), respeitando
  volume/mute do Lote A — **RESOLVIDO (Lote E)**.
- ✅ Animação de carta saindo da mão → descarte (ghost cosmético) — **RESOLVIDO**.
- ✅ Indicador de direção (↻/↺ + rótulo) — **RESOLVIDO**.
- ⏸️ Chat de partida — adiado p/ Lote F (feature de rede própria).

---

## Ordem sugerida

1. ~~**1.1** (bug do HUD)~~ — ✅ feito.
2. ~~**2.1** + **6.1/6.2**~~ — ✅ feito (Lote A).
3. **3.1** — perfil com win rate + últimos jogos (precisa histórico no server).
4. **5.1** — pontos/níveis (alimenta store/inventário).
5. ~~**5.2 / 5.3**~~ — ✅ feito (Lote D). **4.x** adiado → Lote F (precisa server).
6. **7.x** — polimento contínuo.
