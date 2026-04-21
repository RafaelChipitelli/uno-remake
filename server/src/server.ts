import http from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { CLIENT_ORIGIN, SERVER_PORT } from './config/env';
import { createUnoDeck, isValidCardPlay, shuffleDeck } from './core/cards';
import { drawCardsForPlayer } from './core/draw';
import { createActionEvent } from './core/events';
import { getNextPlayer } from './core/players';
import { generateRoomCode, normalizeRoomCode } from './core/roomCode';
import { passTurnToNextPlayer } from './core/turns';
import { emitRoomState, removePlayerFromRoom } from './state/roomState';
import { createGameStore } from './state/store';
import type {
  CreateRoomPayload,
  DrawCardPayload,
  GameEndedPayload,
  JoinRoomPayload,
  PlayCardPayload,
  Player,
  Room,
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

  socket.on('room:create', (payload: CreateRoomPayload = {}) => {
    const player = store.players.get(socket.id);
    if (!player) {
      return;
    }

    if (player.roomId) {
      removePlayerFromRoom(io, store, player.roomId, player.id);
    }

    if (payload.nickname) {
      player.nickname = payload.nickname;
    }

    const roomId = generateRoomCode(store.rooms);
    const room: Room = {
      id: roomId,
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

    console.log(`[room:create] ${player.nickname} criou sala ${roomId}`);
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

    const topCard = room.discardPile[room.discardPile.length - 1];
    if (topCard && !isValidCardPlay(payload.card, topCard, room.currentColor)) {
      socket.emit('room:error', { message: '❌ Jogada inválida! Essa carta não combina com a mesa.' });
      return;
    }

    if (payload.card.color === 'wild') {
      if (!payload.selectedColor || payload.selectedColor === 'wild') {
        socket.emit('room:error', { message: 'Escolha uma cor válida antes de jogar o curinga.' });
        return;
      }
    }

    room.discardPile.push(payload.card);
    room.currentColor =
      payload.card.color === 'wild' && payload.selectedColor
        ? payload.selectedColor
        : payload.card.color;

    const cardIndex = actor.hand.findIndex((card) => card.id === payload.card.id);
    if (cardIndex !== -1) {
      actor.hand.splice(cardIndex, 1);
    }

    if (actor.hand.length === 0) {
      room.gameStatus = 'finished';
      room.winnerId = actor.id;
      room.winnerNickname = actor.nickname;

      room.players.forEach((roomPlayer) => {
        roomPlayer.isTurn = false;
      });

      const event = createActionEvent(actor, 'play', payload.card, room.currentColor);
      io.to(actor.roomId).emit('card:played', event);

      const endedPayload: GameEndedPayload = {
        winnerId: actor.id,
        winnerNickname: actor.nickname,
        message: `🏆 O ${actor.nickname} ganhou o jogo!`,
      };

      io.to(actor.roomId).emit('game:ended', endedPayload);
      emitRoomState(io, store.rooms, actor.roomId);

      console.log(`[game:end] ${actor.nickname} venceu na sala ${actor.roomId}`);
      return;
    }

    const currentPlayerIndex = room.players.findIndex((roomPlayer) => roomPlayer.id === actor.id);
    let stepsToAdvance = 1;

    switch (payload.card.value) {
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
        if (targetPlayer) {
          drawCardsForPlayer(store.serverDecks, actor.roomId, room, targetPlayer, 2);
        }
        stepsToAdvance = 2;
        break;
      }
      case '+4': {
        const targetPlayer = getNextPlayer(room, currentPlayerIndex);
        if (targetPlayer) {
          drawCardsForPlayer(store.serverDecks, actor.roomId, room, targetPlayer, 4);
        }
        stepsToAdvance = 2;
        break;
      }
      default:
        break;
    }

    passTurnToNextPlayer(room, stepsToAdvance);

    const event = createActionEvent(actor, 'play', payload.card, room.currentColor);
    io.to(actor.roomId).emit('card:played', event);
    emitRoomState(io, store.rooms, actor.roomId);

    console.log(
      `[card:play] ${actor.nickname} jogou ${payload.card.color} ${payload.card.value} na sala ${actor.roomId}`,
    );
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

    const deck = store.serverDecks.get(actor.roomId);
    if (!room || !deck || deck.length === 0) {
      socket.emit('room:error', { message: 'O baralho está vazio ou não foi encontrado!' });
      return;
    }

    const drawnCard = deck.pop();
    if (!drawnCard) {
      socket.emit('room:error', { message: 'Não foi possível comprar carta no momento.' });
      return;
    }

    actor.hand.push(drawnCard);
    room.drawPileCount = deck.length;

    passTurnToNextPlayer(room);

    const privateEvent = createActionEvent(actor, 'draw', drawnCard);
    const publicEvent = createActionEvent(actor, 'draw');

    io.to(actor.id).emit('card:drawn', privateEvent);
    socket.to(actor.roomId).emit('card:drawn', publicEvent);
    emitRoomState(io, store.rooms, actor.roomId);

    console.log(
      `[card:draw] ${actor.nickname} comprou ${drawnCard.color} ${drawnCard.value} na sala ${actor.roomId}`,
    );
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





