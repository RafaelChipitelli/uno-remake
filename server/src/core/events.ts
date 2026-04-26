import type { Card, CardActionEvent, Player } from '../types';

export function createActionEvent(
  player: Player,
  action: CardActionEvent['action'],
  card?: Card,
  currentColor?: Card['color'],
  options?: {
    drawnCardPlayable?: boolean;
    drawDecisionPending?: boolean;
    drawCount?: number;
    drawReason?: 'normal' | 'stack_penalty';
  },
): CardActionEvent {
  return {
    action,
    playerId: player.id,
    nickname: player.nickname,
    timestamp: Date.now(),
    ...(card ? { card } : {}),
    ...(currentColor ? { currentColor } : {}),
    ...(typeof options?.drawnCardPlayable === 'boolean'
      ? { drawnCardPlayable: options.drawnCardPlayable }
      : {}),
    ...(typeof options?.drawDecisionPending === 'boolean'
      ? { drawDecisionPending: options.drawDecisionPending }
      : {}),
    ...(typeof options?.drawCount === 'number' ? { drawCount: options.drawCount } : {}),
    ...(options?.drawReason ? { drawReason: options.drawReason } : {}),
  };
}
