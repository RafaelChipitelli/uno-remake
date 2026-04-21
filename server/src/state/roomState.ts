import type { Server } from 'socket.io';
import type { Card, Player, Room } from '../types';

type StoreLike = {
  players: Map<string, Player>;
  rooms: Map<string, Room>;
  serverDecks: Map<string, Card[]>;
};

export function emitRoomState(io: Server, rooms: Map<string, Room>, roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  for (const player of room.players) {
    const safeRoomState: Room = {
      ...room,
      players: room.players.map((currentPlayer) => ({
        ...currentPlayer,
        hand: currentPlayer.id === player.id ? currentPlayer.hand : [],
      })),
    };

    io.to(player.id).emit('room:state', safeRoomState);
  }
}

export function removePlayerFromRoom(
  io: Server,
  store: StoreLike,
  roomId: string,
  playerId: string,
): void {
  const room = store.rooms.get(roomId);
  if (!room) {
    return;
  }

  room.players = room.players.filter((player) => player.id !== playerId);

  if (room.players.length === 0) {
    store.rooms.delete(roomId);
    store.serverDecks.delete(roomId);
  } else {
    if (room.hostId === playerId) {
      const newHost = room.players[0];
      if (newHost) {
        room.hostId = newHost.id;
      }
    }

    emitRoomState(io, store.rooms, roomId);
  }

  const player = store.players.get(playerId);
  if (player) {
    player.roomId = undefined;
    player.isTurn = false;
  }

  const socket = io.sockets.sockets.get(playerId);
  socket?.leave(roomId);
}
