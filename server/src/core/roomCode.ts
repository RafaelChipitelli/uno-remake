import type { Room } from '../types';

const ROOM_CODE_LENGTH = 4;
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(rooms: Map<string, Room>): string {
  let code = '';

  do {
    code = Array.from({ length: ROOM_CODE_LENGTH }, () =>
      ROOM_CODE_ALPHABET.charAt(Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)),
    ).join('');
  } while (rooms.has(code));

  return code;
}

export function normalizeRoomCode(roomId?: string): string | undefined {
  if (!roomId) {
    return undefined;
  }

  const trimmed = roomId.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.toUpperCase();
}
