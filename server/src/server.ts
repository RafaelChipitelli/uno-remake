import http from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { CLIENT_ORIGIN, SERVER_PORT } from './config/env';
import { createUnoDeck, isValidCardPlay, shuffleDeck } from './core/cards';
import { isCustomDrawReactionCard, isDrawMultiplierCard, isDrawShieldCard } from './core/customCards';
import { drawCardsForPlayer, refillDrawPileFromDiscard } from './core/draw';
import { createActionEvent } from './core/events';
import { getNextPlayer } from './core/players';
import { canDeclareUno, isUnoVulnerable, shouldClearUnoFlag, UNO_PENALTY_CARDS } from './core/uno';
import { generateRoomCode, normalizeRoomCode } from './core/roomCode';
import { passTurnToNextPlayer } from './core/turns';
import { emitRoomState, removePlayerFromRoom } from './state/roomState';
import { createGameStore } from './state/store';
import type {
  Card,
  CreateRoomPayload,
  DrawDecisionPayload,
  DrawCardPayload,
  GameEndedPayload,
  JoinRoomPayload,
  PlayCardPayload,
  Player,
  QuickPlayPayload,
  Room,
  RoomVisibility,
} from './types';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

const store = createGameStore();
const STARTING_HAND_SIZE = 10;

function isStackDrawCardValue(value: string): value is '+2' | '+4' {
  return value === '+2' || value === '+4';
}

function isStackDrawCard(card: Card): boolean {
  return isStackDrawCardValue(card.value);
}

function canStackOverPendingDraw(cardValue: string, pendingTopCardValue: '+2' | '+4'): boolean {
  if (cardValue === '+4') {
    return true;
  }

  return cardValue === '+2' && pendingTopCardValue === '+2';
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  store.players.set(socket.id, {
    id: socket.id,
    nickname: `Player-${socket.id.slice(0, 4)}`,
    hand: [],
    isTurn: false,
  });

  const connectedPlayer = store.players.get(socket.id);
  socket.emit('lobby:welcome', connectedPlayer);

  const resolvePlayedCard = (
    actor: Player,
    room: Room,
    playedCard: Card,
    selectedColor?: Card['color'],
  ): { gameEnded: boolean } => {
    room.discardPile.push(playedCard);
    room.currentColor = playedCard.color === 'wild' && selectedColor ? selectedColor : playedCard.color;

    const cardIndex = actor.hand.findIndex((card) => card.id === playedCard.id);
    if (cardIndex !== -1) {
      actor.hand.splice(cardIndex, 1);
    }

    if (actor.hand.length === 0) {
      room.gameStatus = 'finished';
      room.winnerId = actor.id;
      room.winnerNickname = actor.nickname;
      delete room.pendingDrawDecision;
      delete room.pendingStackDraw;

      room.players.forEach((roomPlayer) => {
        roomPlayer.isTurn = false;
      });

      const event = createActionEvent(actor, 'play', playedCard, room.currentColor);
      io.to(actor.roomId as string).emit('card:played', event);

      const endedPayload: GameEndedPayload = {
        winnerId: actor.id,
        winnerNickname: actor.nickname,
        message: `🏆 O ${actor.nickname} ganhou o jogo!`,
      };

      io.to(actor.roomId as string).emit('game:ended', endedPayload);
      emitRoomState(io, store.rooms, actor.roomId as string);

      console.log(`[game:end] ${actor.nickname} venceu na sala ${actor.roomId}`);
      return { gameEnded: true };
    }

    // No auto-penalty: a player left with one undeclared card stays
    // vulnerable until an opponent challenges (uno:challenge).
    if (shouldClearUnoFlag(actor.hand.length)) {
      actor.calledUno = false;
    }

    const currentPlayerIndex = room.players.findIndex((roomPlayer) => roomPlayer.id === actor.id);
    let stepsToAdvance = 1;

    switch (playedCard.value) {
      case 'skip':
        stepsToAdvance = 2;
        break;
      case 'reverse':
        if (room.players.length <= 2) {
          stepsToAdvance = 2;
        } else {
          room.turnDirection = room.turnDirection === 1 ? -1 : 1;
        }
        break;
      case '+2': {
        const targetPlayer = getNextPlayer(room, currentPlayerIndex);
        if (targetPlayer && actor.roomId) {
          room.pendingStackDraw = {
            amount: (room.pendingStackDraw?.amount ?? 0) + 2,
            topCardValue: '+2',
            targetPlayerId: targetPlayer.id,
          };
        }
        stepsToAdvance = 1;
        break;
      }
      case '+4': {
        const targetPlayer = getNextPlayer(room, currentPlayerIndex);
        if (targetPlayer && actor.roomId) {
          room.pendingStackDraw = {
            amount: (room.pendingStackDraw?.amount ?? 0) + 4,
            topCardValue: '+4',
            targetPlayerId: targetPlayer.id,
          };
        }
        stepsToAdvance = 1;
        break;
      }
      default:
        if (isDrawMultiplierCard(playedCard)) {
          if (room.pendingStackDraw) {
            room.pendingStackDraw.amount *= 2;
            room.pendingStackDraw.targetPlayerId = getNextPlayer(room, currentPlayerIndex)?.id ?? room.pendingStackDraw.targetPlayerId;
          }
          stepsToAdvance = 1;
        } else if (isDrawShieldCard(playedCard)) {
          delete room.pendingStackDraw;
          stepsToAdvance = 1;
        } else {
          delete room.pendingStackDraw;
        }
        break;
    }

    delete room.pendingDrawDecision;
    passTurnToNextPlayer(room, stepsToAdvance);

    const event = createActionEvent(actor, 'play', playedCard, room.currentColor);
    io.to(actor.roomId as string).emit('card:played', event);
    emitRoomState(io, store.rooms, actor.roomId as string);

    console.log(`[card:play] ${actor.nickname} jogou ${playedCard.color} ${playedCard.value} na sala ${actor.roomId}`);
    return { gameEnded: false };
  };

  socket.on('room:create', (payload: CreateRoomPayload = {}) => {
    const player = store.players.get(socket.id);
    if (!player) {
      return;
    }

    const roomVisibility: RoomVisibility = payload.visibility ?? 'public';

    if (payload.nickname) {
      player.nickname = payload.nickname;
    }

    if (player.roomId) {
      const currentRoom = store.rooms.get(player.roomId);
      const isDuplicateCreateRequest =
        Boolean(currentRoom) &&
        currentRoom?.hostId === player.id &&
        currentRoom?.visibility === roomVisibility &&
        currentRoom?.gameStatus === 'waiting' &&
        currentRoom?.players.length === 1;

      if (isDuplicateCreateRequest && currentRoom) {
        const alreadyInside = currentRoom.players.some((roomPlayer) => roomPlayer.id === player.id);
        if (!alreadyInside) {
          currentRoom.players.push(player);
        }

        socket.join(currentRoom.id);
        socket.emit('room:created', { roomId: currentRoom.id });
        emitRoomState(io, store.rooms, currentRoom.id);

        console.log(`[room:create] ${player.nickname} reutilizou sala ${currentRoom.id} (requisição duplicada).`);
        return;
      }

      removePlayerFromRoom(io, store, player.roomId, player.id);
    }

    const roomId = generateRoomCode(store.rooms);
    const room: Room = {
      id: roomId,
      visibility: roomVisibility,
      players: [],
      discardPile: [],
      drawPileCount: 0,
      currentColor: 'red',
      hostId: player.id,
      turnDirection: 1,
      gameStatus: 'waiting',
      winnerId: undefined,
      winnerNickname: undefined,
    };

    player.roomId = roomId;
    player.isTurn = true;

    room.players.push(player);
    store.rooms.set(roomId, room);
    store.serverDecks.set(roomId, shuffleDeck(createUnoDeck()));

    socket.join(roomId);
    socket.emit('room:created', { roomId });
    emitRoomState(io, store.rooms, roomId);

    console.log(`[room:create] ${player.nickname} criou sala ${roomId} (${roomVisibility})`);
  });

  socket.on('room:quick-play', (payload: QuickPlayPayload = {}) => {
    const player = store.players.get(socket.id);
    if (!player) {
      return;
    }

    if (payload.nickname) {
      player.nickname = payload.nickname;
    }

    if (player.roomId) {
      removePlayerFromRoom(io, store, player.roomId, player.id);
    }

    const waitingPublicRooms = [...store.rooms.values()]
      .filter((room) => room.visibility === 'public' && room.gameStatus === 'waiting')
      .sort((a, b) => b.players.length - a.players.length || a.id.localeCompare(b.id));

    const targetRoom = waitingPublicRooms[0];
    if (targetRoom) {
      player.roomId = targetRoom.id;
      player.isTurn = false;

      const alreadyInside = targetRoom.players.some((roomPlayer) => roomPlayer.id === player.id);
      if (!alreadyInside) {
        targetRoom.players.push(player);
      }

      socket.join(targetRoom.id);
      socket.emit('room:joined', { roomId: targetRoom.id });
      emitRoomState(io, store.rooms, targetRoom.id);

      console.log(`[room:quick-play] ${player.nickname} entrou na sala pública ${targetRoom.id}`);
      return;
    }

    const roomId = generateRoomCode(store.rooms);
    const room: Room = {
      id: roomId,
      visibility: 'public',
      players: [],
      discardPile: [],
      drawPileCount: 0,
      currentColor: 'red',
      hostId: player.id,
      turnDirection: 1,
      gameStatus: 'waiting',
      winnerId: undefined,
      winnerNickname: undefined,
    };

    player.roomId = roomId;
    player.isTurn = true;

    room.players.push(player);
    store.rooms.set(roomId, room);
    store.serverDecks.set(roomId, shuffleDeck(createUnoDeck()));

    socket.join(roomId);
    socket.emit('room:created', { roomId });
    emitRoomState(io, store.rooms, roomId);

    console.log(`[room:quick-play] ${player.nickname} criou sala pública ${roomId}`);
  });

  socket.on('room:join', (payload: JoinRoomPayload) => {
    const player = store.players.get(socket.id);
    if (!player) {
      return;
    }

    const roomCode = normalizeRoomCode(payload.roomId);
    if (!roomCode) {
      socket.emit('room:error', { message: 'Código de sala inválido.' });
      return;
    }

    const room = store.rooms.get(roomCode);
    if (!room) {
      socket.emit('room:error', { message: `Sala ${roomCode} não encontrada.` });
      return;
    }

    if (player.roomId) {
      removePlayerFromRoom(io, store, player.roomId, player.id);
    }

    if (payload.nickname) {
      player.nickname = payload.nickname;
    }

    player.roomId = roomCode;
    player.isTurn = false;

    const alreadyInside = room.players.some((roomPlayer) => roomPlayer.id === player.id);
    if (!alreadyInside) {
      room.players.push(player);
    }

    socket.join(roomCode);
    socket.emit('room:joined', { roomId: roomCode });
    emitRoomState(io, store.rooms, roomCode);

    console.log(`[room:join] ${player.nickname} entrou na sala ${roomCode}`);
  });

  socket.on('uno:declare', () => {
    const player = store.players.get(socket.id);
    if (!player?.roomId) {
      return;
    }
    const room = store.rooms.get(player.roomId);
    if (!room || room.gameStatus !== 'in_progress') {
      return;
    }
    if (!canDeclareUno(player.hand.length)) {
      socket.emit('room:error', { message: 'Você só pode chamar UNO com 1 ou 2 cartas na mão.' });
      return;
    }

    player.calledUno = true;
    io.to(player.roomId).emit('uno:called', {
      playerId: player.id,
      nickname: player.nickname,
    });
    console.log(`[uno:declare] ${player.nickname} chamou UNO na sala ${player.roomId}`);
  });

  socket.on('uno:challenge', () => {
    const challenger = store.players.get(socket.id);
    if (!challenger?.roomId) {
      return;
    }
    const room = store.rooms.get(challenger.roomId);
    if (!room || room.gameStatus !== 'in_progress') {
      return;
    }

    const target = room.players.find(
      (candidate) =>
        candidate.id !== challenger.id && isUnoVulnerable(candidate.hand.length, Boolean(candidate.calledUno)),
    );
    if (!target) {
      socket.emit('room:error', { message: 'Ninguém para desafiar: nenhum jogador esqueceu o UNO.' });
      return;
    }

    drawCardsForPlayer(store.serverDecks, challenger.roomId, room, target, UNO_PENALTY_CARDS);
    io.to(challenger.roomId).emit('uno:penalty', {
      playerId: target.id,
      nickname: target.nickname,
      cards: UNO_PENALTY_CARDS,
      byNickname: challenger.nickname,
    });
    emitRoomState(io, store.rooms, challenger.roomId);
    console.log(
      `[uno:challenge] ${challenger.nickname} pegou ${target.nickname} sem UNO (+${UNO_PENALTY_CARDS}) na sala ${challenger.roomId}`,
    );
  });

  socket.on('room:leave', () => {
    const player = store.players.get(socket.id);
    if (!player?.roomId) {
      socket.emit('room:error', { message: 'Você não está em nenhuma sala.' });
      return;
    }

    const roomId = player.roomId;
    removePlayerFromRoom(io, store, roomId, socket.id);
    socket.emit('room:left', { roomId });

    console.log(`[room:leave] ${player.nickname} saiu da sala ${roomId}`);
  });

  socket.on('card:play', (payload: PlayCardPayload) => {
    const actor = store.players.get(socket.id);
    if (!actor) {
      return;
    }

    if (!actor.roomId) {
      socket.emit('room:error', { message: 'Entre em uma sala antes de jogar cartas.' });
      return;
    }

    const room = store.rooms.get(actor.roomId);
    if (!room) {
      socket.emit('room:error', { message: 'Sala não encontrada.' });
      return;
    }

    if (room.gameStatus !== 'in_progress') {
      socket.emit('room:error', { message: 'A rodada não está em andamento. Aguarde o próximo jogo.' });
      return;
    }

    if (!actor.isTurn) {
      socket.emit('room:error', { message: 'Não é a sua vez de jogar!' });
      return;
    }

    if (room.pendingDrawDecision?.playerId === actor.id) {
      socket.emit('room:error', {
        message: 'Você comprou uma carta jogável. Escolha entre jogar a carta comprada ou passar a vez.',
      });
      return;
    }

    const pendingStackDraw = room.pendingStackDraw;
    if (pendingStackDraw) {
      if (pendingStackDraw.targetPlayerId !== actor.id) {
        socket.emit('room:error', {
          message: 'Aguarde a resolução da penalidade de compra acumulada.',
        });
        return;
      }

      if (!isStackDrawCard(payload.card) && !isCustomDrawReactionCard(payload.card)) {
        socket.emit('room:error', {
          message: `Você precisa jogar +2/+4, Compra x2, Escudo ou comprar ${pendingStackDraw.amount} cartas de penalidade.`,
        });
        return;
      }

      if (isStackDrawCard(payload.card) && !canStackOverPendingDraw(payload.card.value, pendingStackDraw.topCardValue)) {
        socket.emit('room:error', {
          message: 'Não é permitido jogar +2 em cima de +4 na pilha de compra.',
        });
        return;
      }
    }

    const topCard = room.discardPile[room.discardPile.length - 1];
    if (!pendingStackDraw && topCard && !isValidCardPlay(payload.card, topCard, room.currentColor)) {
      socket.emit('room:error', { message: '❌ Jogada inválida! Essa carta não combina com a mesa.' });
      return;
    }

    if (payload.card.color === 'wild') {
      if (!payload.selectedColor || payload.selectedColor === 'wild') {
        socket.emit('room:error', { message: 'Escolha uma cor válida antes de jogar o curinga.' });
        return;
      }
    }

    resolvePlayedCard(actor, room, payload.card, payload.selectedColor);
  });

  socket.on('card:draw', (_payload: DrawCardPayload) => {
    const actor = store.players.get(socket.id);
    if (!actor) {
      return;
    }

    if (!actor.roomId) {
      socket.emit('room:error', { message: 'Entre em uma sala antes de comprar cartas.' });
      return;
    }

    const room = store.rooms.get(actor.roomId);
    if (!room) {
      socket.emit('room:error', { message: 'Sala não encontrada.' });
      return;
    }

    if (room.gameStatus !== 'in_progress') {
      socket.emit('room:error', { message: 'A rodada não está em andamento. Aguarde o próximo jogo.' });
      return;
    }

    if (!actor.isTurn) {
      socket.emit('room:error', { message: 'Não é a sua vez de comprar carta!' });
      return;
    }

    if (room.pendingDrawDecision?.playerId === actor.id) {
      socket.emit('room:error', {
        message: 'Decida primeiro se quer jogar a carta comprada ou manter na mão.',
      });
      return;
    }

    if (room.pendingStackDraw) {
      socket.emit('room:error', {
        message: `Há uma penalidade acumulada de +${room.pendingStackDraw.amount}. Jogue +2/+4 ou compre a penalidade.`,
      });
      return;
    }

    const deck = store.serverDecks.get(actor.roomId);
    if (!deck) {
      socket.emit('room:error', { message: 'O baralho está vazio ou não foi encontrado!' });
      return;
    }

    if (!refillDrawPileFromDiscard(deck, room)) {
      socket.emit('room:error', { message: 'Não há cartas suficientes no descarte para formar um novo baralho.' });
      return;
    }

    const drawnCard = deck.pop();
    if (!drawnCard) {
      socket.emit('room:error', { message: 'Não foi possível comprar carta no momento.' });
      return;
    }

    actor.hand.push(drawnCard);
    actor.calledUno = false;
    room.drawPileCount = deck.length;

    const topCard = room.discardPile[room.discardPile.length - 1];
    const drawnCardPlayable = Boolean(topCard && isValidCardPlay(drawnCard, topCard, room.currentColor));

    if (drawnCardPlayable) {
      room.pendingDrawDecision = {
        playerId: actor.id,
        cardId: drawnCard.id,
      };
    } else {
      delete room.pendingDrawDecision;
      passTurnToNextPlayer(room);
    }

    const privateEvent = createActionEvent(actor, 'draw', drawnCard, undefined, {
      drawnCardPlayable,
      drawDecisionPending: drawnCardPlayable,
      drawCount: 1,
      drawReason: 'normal',
    });
    const publicEvent = createActionEvent(actor, 'draw', undefined, undefined, {
      drawCount: 1,
      drawReason: 'normal',
    });

    io.to(actor.id).emit('card:drawn', privateEvent);
    socket.to(actor.roomId).emit('card:drawn', publicEvent);
    emitRoomState(io, store.rooms, actor.roomId);

    console.log(
      `[card:draw] ${actor.nickname} comprou ${drawnCard.color} ${drawnCard.value} na sala ${actor.roomId}`,
    );
  });

  socket.on('card:draw-penalty', (_payload: DrawCardPayload) => {
    const actor = store.players.get(socket.id);
    if (!actor?.roomId) {
      return;
    }

    const room = store.rooms.get(actor.roomId);
    if (!room) {
      socket.emit('room:error', { message: 'Sala não encontrada.' });
      return;
    }

    if (room.gameStatus !== 'in_progress') {
      socket.emit('room:error', { message: 'A rodada não está em andamento. Aguarde o próximo jogo.' });
      return;
    }

    if (!actor.isTurn) {
      socket.emit('room:error', { message: 'Não é a sua vez de resolver a penalidade!' });
      return;
    }

    if (room.pendingDrawDecision?.playerId === actor.id) {
      socket.emit('room:error', {
        message: 'Decida primeiro se quer jogar a carta comprada ou manter na mão.',
      });
      return;
    }

    const pendingStackDraw = room.pendingStackDraw;
    if (!pendingStackDraw) {
      socket.emit('room:error', { message: 'Não há penalidade acumulada para comprar agora.' });
      return;
    }

    if (pendingStackDraw.targetPlayerId !== actor.id) {
      socket.emit('room:error', { message: 'A penalidade acumulada é de outro jogador.' });
      return;
    }

    const drawnCards = drawCardsForPlayer(store.serverDecks, actor.roomId, room, actor, pendingStackDraw.amount);
    delete room.pendingStackDraw;
    passTurnToNextPlayer(room);

    const event = createActionEvent(actor, 'draw', undefined, undefined, {
      drawCount: drawnCards.length,
      drawReason: 'stack_penalty',
    });

    io.to(actor.roomId).emit('card:drawn', event);
    emitRoomState(io, store.rooms, actor.roomId);

    console.log(
      `[card:draw-penalty] ${actor.nickname} comprou ${drawnCards.length} cartas de penalidade na sala ${actor.roomId}`,
    );
  });

  socket.on('card:draw-decision', (payload: DrawDecisionPayload) => {
    const actor = store.players.get(socket.id);
    if (!actor?.roomId) {
      return;
    }

    const room = store.rooms.get(actor.roomId);
    if (!room) {
      return;
    }

    if (room.gameStatus !== 'in_progress') {
      socket.emit('room:error', { message: 'A rodada não está em andamento.' });
      return;
    }

    const pending = room.pendingDrawDecision;
    if (!pending || pending.playerId !== actor.id) {
      socket.emit('room:error', { message: 'Nenhuma decisão de compra pendente para você.' });
      return;
    }

    const pendingCard = actor.hand.find((card) => card.id === pending.cardId);
    if (!pendingCard) {
      delete room.pendingDrawDecision;
      socket.emit('room:error', { message: 'A carta comprada pendente não foi encontrada na sua mão.' });
      emitRoomState(io, store.rooms, actor.roomId);
      return;
    }

    if (payload.choice === 'keep') {
      delete room.pendingDrawDecision;
      passTurnToNextPlayer(room);
      emitRoomState(io, store.rooms, actor.roomId);
      io.to(actor.roomId).emit(
        'card:drawn',
        createActionEvent(actor, 'draw', undefined, undefined, { drawnCardPlayable: true, drawDecisionPending: false }),
      );
      return;
    }

    if (pendingCard.color === 'wild') {
      if (!payload.selectedColor || payload.selectedColor === 'wild') {
        socket.emit('room:error', { message: 'Escolha uma cor válida para jogar o curinga comprado.' });
        return;
      }
    }

    resolvePlayedCard(actor, room, pendingCard, payload.selectedColor);
  });

  socket.on('game:start', () => {
    const actor = store.players.get(socket.id);
    if (!actor?.roomId) {
      return;
    }

    const room = store.rooms.get(actor.roomId);
    if (!room) {
      return;
    }

    if (room.hostId !== actor.id) {
      socket.emit('room:error', { message: 'Apenas o dono da sala pode iniciar o jogo.' });
      return;
    }

    const deck = shuffleDeck(createUnoDeck());
    const requiredCards = room.players.length * STARTING_HAND_SIZE + 1;
    if (deck.length < requiredCards) {
      const maxSupportedPlayers = Math.floor((deck.length - 1) / STARTING_HAND_SIZE);
      socket.emit('room:error', {
        message: `Não há cartas suficientes para distribuir ${STARTING_HAND_SIZE} cartas por jogador. Máximo suportado: ${maxSupportedPlayers} jogadores.`,
      });
      return;
    }

    store.serverDecks.set(actor.roomId, deck);

    room.gameStatus = 'in_progress';
    delete room.pendingDrawDecision;
    delete room.pendingStackDraw;
    room.winnerId = undefined;
    room.winnerNickname = undefined;
    room.discardPile = [];
    room.turnDirection = 1;

    room.players.forEach((roomPlayer) => {
      roomPlayer.isTurn = false;
    });
    if (room.players[0]) {
      room.players[0].isTurn = true;
    }

    for (const roomPlayer of room.players) {
      roomPlayer.hand = [];
      for (let index = 0; index < STARTING_HAND_SIZE; index += 1) {
        const card = deck.pop();
        if (!card) {
          break;
        }

        roomPlayer.hand.push(card);
      }
    }

    const firstCard = deck.pop();
    if (firstCard) {
      room.discardPile.push(firstCard);
      room.currentColor = firstCard.color === 'wild' ? 'red' : firstCard.color;
    }

    room.drawPileCount = deck.length;

    emitRoomState(io, store.rooms, room.id);
    io.to(room.id).emit('game:started', {
      message: '✅ Jogo iniciado!',
      firstCard: room.discardPile[0],
      currentColor: room.currentColor,
      currentPlayerTurn: room.players.find((roomPlayer) => roomPlayer.isTurn)?.nickname,
    });

    console.log(`[game:start] O jogo começou na sala ${room.id}!`);
  });

  socket.on('disconnect', () => {
    const player = store.players.get(socket.id);

    if (player?.roomId) {
      removePlayerFromRoom(io, store, player.roomId, socket.id);
    }

    store.players.delete(socket.id);
    console.log(`Player disconnected: ${socket.id}`);
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

server.listen(SERVER_PORT, () => {
  console.log(`Server listening on http://localhost:${SERVER_PORT}`);
});












