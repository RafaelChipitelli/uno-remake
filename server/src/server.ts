import http from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import type {
  Card,
  CardActionEvent,
  CreateRoomPayload,
  DrawCardPayload,
  JoinRoomPayload,
  PlayCardPayload,
  Player,
  Room,
} from './types';

// Configura Express + Socket.IO
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

const players = new Map<string, Player>();
const rooms = new Map<string, Room>();
const serverDecks = new Map<string, Card[]>();
const COLORS: Card['color'][] = ['red', 'green', 'blue', 'yellow', 'wild'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', '+2'];
const ROOM_CODE_LENGTH = 4;
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  players.set(socket.id, {
    id: socket.id,
    nickname: `Player-${socket.id.slice(0, 4)}`,
    hand: [],
    isTurn: false,
  });

  const connectedPlayer = players.get(socket.id);

  // Notifica o cliente para desenhar a carta placeholder
  socket.emit('lobby:welcome', connectedPlayer);

  socket.on('room:create', (payload: CreateRoomPayload = {}) => {
    const player = players.get(socket.id);
    if (!player) {
      return;
    }

    if (player.roomId) {
      removePlayerFromRoom(player.roomId, player.id);
    }

    if (payload.nickname) {
      player.nickname = payload.nickname;
    }

    const roomId = generateRoomCode();
    const room: Room = {
      id: roomId,
      players: [],
      discardPile: [],
      drawPileCount: 0,
      currentColor: 'red',
      hostId: player.id,
    };

    player.roomId = roomId;
    player.isTurn = true;
    room.players.push(player);
    rooms.set(roomId, room);

    socket.join(roomId);
    socket.emit('room:created', { roomId });
    emitRoomState(roomId);
    console.log(`[room:create] ${player.nickname} criou sala ${roomId}`);
  });

  socket.on('room:join', (payload: JoinRoomPayload) => {
    const player = players.get(socket.id);
    if (!player) {
      return;
    }

    const code = normalizeRoomCode(payload.roomId);
    if (!code) {
      socket.emit('room:error', { message: 'Código de sala inválido.' });
      return;
    }

    const room = rooms.get(code);
    if (!room) {
      socket.emit('room:error', { message: `Sala ${code} não encontrada.` });
      return;
    }

    if (player.roomId) {
      removePlayerFromRoom(player.roomId, player.id);
    }

    if (payload.nickname) {
      player.nickname = payload.nickname;
    }

    player.roomId = code;
    player.isTurn = false;

    const alreadyInside = room.players.some((p) => p.id === player.id);
    if (!alreadyInside) {
      room.players.push(player);
    }

    socket.join(code);
    socket.emit('room:joined', { roomId: code });
    emitRoomState(code);
    console.log(`[room:join] ${player.nickname} entrou na sala ${code}`);
  });

  socket.on('room:leave', () => {
    const player = players.get(socket.id);
    if (!player?.roomId) {
      socket.emit('room:error', { message: 'Você não está em nenhuma sala.' });
      return;
    }

    const roomId = player.roomId;
    removePlayerFromRoom(roomId, socket.id);
    socket.emit('room:left', { roomId });
    console.log(`[room:leave] ${player.nickname} saiu da sala ${roomId}`);
  });

  socket.on('card:play', (payload: PlayCardPayload) => {
    const actor = players.get(socket.id);
    if (!actor) {
      return;
    }

    if (!actor.roomId) {
      socket.emit('room:error', { message: 'Entre em uma sala antes de jogar cartas.' });
      return;
    }

    const event = createActionEvent(actor, 'play', payload.card);
    console.log(
      `[card:play] ${actor.nickname} jogou ${payload.card.color} ${payload.card.value} na sala ${actor.roomId}`,
    );
    io.to(actor.roomId).emit('card:played', event);
  });

  socket.on('card:draw', (_payload: DrawCardPayload) => {
    const actor = players.get(socket.id);
    if (!actor) {
      return;
    }

    if (!actor.roomId) {
      socket.emit('room:error', { message: 'Entre em uma sala antes de comprar cartas.' });
      return;
    }

    const drawnCard = generateMockCard();
    const event = createActionEvent(actor, 'draw', drawnCard);
    console.log(
      `[card:draw] ${actor.nickname} comprou ${drawnCard.color} ${drawnCard.value} na sala ${actor.roomId}`,
    );
    io.to(actor.roomId).emit('card:drawn', event);
  });

  socket.on('disconnect', () => {
    const player = players.get(socket.id);

    if (player?.roomId) {
      removePlayerFromRoom(player.roomId, socket.id);
    }

    players.delete(socket.id);
    console.log(`Player disconnected: ${socket.id}`);
  });
});

// Endpoint simples para health-check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

server.listen(3001, () => {
  console.log('Server listening on http://localhost:3001');
});

function createActionEvent(player: Player, action: CardActionEvent['action'], card?: Card) {
  const event: CardActionEvent = {
    action,
    playerId: player.id,
    nickname: player.nickname,
    timestamp: Date.now(),
    ...(card ? { card } : {}),
  };

  return event;
}

function generateMockCard(): Card {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)] ?? 'red';
  const value = VALUES[Math.floor(Math.random() * VALUES.length)] ?? '0';

  return {
    id: `srv-${color}-${value}-${Date.now()}`,
    color,
    value,
  };
}

function generateRoomCode(): string {
  let code = '';
  do {
    code = Array.from({ length: ROOM_CODE_LENGTH }, () =>
      ROOM_CODE_ALPHABET.charAt(Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)),
    ).join('');
  } while (rooms.has(code));

  return code;
}

function normalizeRoomCode(roomId?: string) {
  if (!roomId) {
    return undefined;
  }

  const trimmed = roomId.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.toUpperCase();
}

function emitRoomState(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  io.to(roomId).emit('room:state', room);
}

function removePlayerFromRoom(roomId: string, playerId: string) {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  room.players = room.players.filter((p) => p.id !== playerId);

  if (room.players.length === 0) {
    rooms.delete(roomId);
  } else {
    if (room.hostId === playerId) {
      const newHost = room.players[0];
      if (newHost) {
        room.hostId = newHost.id;
      }
    }
    emitRoomState(roomId);
  }

  const player = players.get(playerId);
  if (player) {
    player.roomId = undefined;
    player.isTurn = false;
  }

  const socket = io.sockets.sockets.get(playerId);
  socket?.leave(roomId);
}

function createUnoDeck(): Card[] {
  const deck: Card[] = [];
  const standardColors: Card['color'][] = ['red', 'green', 'blue', 'yellow'];

  for (const color of standardColors) {
    // 1 carta '0' por cor
    deck.push({ id: `card-${color}-0-${Date.now()}-${Math.random()}`, color, value: '0' });

    // 2 cartas de 1 a 9, Pular, Inverter e +2 por cor
    const actionValues = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', '+2'];
    for (const value of actionValues) {
      deck.push({ id: `card-${color}-${value}-A-${Date.now()}-${Math.random()}`, color, value });
      deck.push({ id: `card-${color}-${value}-B-${Date.now()}-${Math.random()}`, color, value });
    }
  }

  // 4 Curingas e 4 Curingas +4
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `card-wild-color-${i}-${Date.now()}`, color: 'wild', value: 'wild' }); // *Veja o aviso abaixo
    deck.push({ id: `card-wild-+4-${i}-${Date.now()}`, color: 'wild', value: '+4' });
  }

  return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}