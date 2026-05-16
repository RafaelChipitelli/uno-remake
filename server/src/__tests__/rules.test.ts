import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createUnoDeck, isValidCardPlay, shuffleDeck } from '../core/cards';
import { createCustomCards } from '../core/customCards';
import { drawCardsForPlayer, refillDrawPileFromDiscard } from '../core/draw';
import { getNextPlayerIndex, passTurnToNextPlayer } from '../core/turns';
import { canDeclareUno, isUnoVulnerable, shouldClearUnoFlag, UNO_PENALTY_CARDS } from '../core/uno';
import {
  clampStartingHandSize,
  DEFAULT_STARTING_HAND_SIZE,
  MAX_STARTING_HAND_SIZE,
  MIN_STARTING_HAND_SIZE,
} from '../core/handSize';
import type { Card, Player, Room } from '../types';

let cardSeq = 0;
function makeCard(partial: Partial<Card> = {}): Card {
  cardSeq += 1;
  return { id: `c${cardSeq}`, color: 'red', value: '5', ...partial };
}

function makePlayer(id: string, isTurn = false): Player {
  return { id, nickname: id, hand: [], isTurn };
}

function makeRoom(playerIds: string[], partial: Partial<Room> = {}): Room {
  return {
    id: 'room',
    visibility: 'public',
    players: playerIds.map((id, index) => makePlayer(id, index === 0)),
    discardPile: [],
    drawPileCount: 0,
    currentColor: 'red',
    hostId: playerIds[0] ?? '',
    turnDirection: 1,
    gameStatus: 'in_progress',
    ...partial,
  };
}

test('createUnoDeck has exactly 8 wild cards and unique ids', () => {
  const deck = createUnoDeck();
  const wilds = deck.filter((card) => card.color === 'wild' && card.kind === 'wild');
  assert.equal(wilds.length, 8);
  assert.equal(new Set(deck.map((card) => card.id)).size, deck.length);
  for (const color of ['red', 'green', 'blue', 'yellow'] as const) {
    assert.equal(deck.filter((card) => card.color === color && card.value === '0').length, 1);
  }
});

test('isValidCardPlay: wild card is always playable', () => {
  const top = makeCard({ color: 'red', value: '5' });
  assert.equal(isValidCardPlay(makeCard({ color: 'wild', value: 'wild' }), top, 'red'), true);
});

test('isValidCardPlay: same active color is playable', () => {
  const top = makeCard({ color: 'blue', value: '2' });
  assert.equal(isValidCardPlay(makeCard({ color: 'blue', value: '9' }), top, 'blue'), true);
});

test('isValidCardPlay: same value with different color is playable', () => {
  const top = makeCard({ color: 'blue', value: '7' });
  assert.equal(isValidCardPlay(makeCard({ color: 'red', value: '7' }), top, 'blue'), true);
});

test('isValidCardPlay: different color and value is rejected', () => {
  const top = makeCard({ color: 'blue', value: '7' });
  assert.equal(isValidCardPlay(makeCard({ color: 'red', value: '3' }), top, 'blue'), false);
});

test('isValidCardPlay: custom power cards cannot be played as normal cards', () => {
  let i = 0;
  const customs = createCustomCards(() => `custom-${(i += 1)}`);
  const top = makeCard({ color: 'wild', value: 'wild' });
  for (const card of customs) {
    assert.equal(isValidCardPlay(card, top, 'red'), false);
  }
});

test('shuffleDeck preserves the multiset and does not mutate the input', () => {
  const deck = createUnoDeck();
  const original = [...deck];
  const shuffled = shuffleDeck(deck);
  assert.equal(shuffled.length, deck.length);
  assert.deepEqual([...deck], original);
  assert.deepEqual(
    shuffled.map((c) => c.id).sort(),
    original.map((c) => c.id).sort(),
  );
});

test('getNextPlayerIndex moves forward and wraps around', () => {
  const room = makeRoom(['a', 'b', 'c']);
  assert.equal(getNextPlayerIndex(room, 0, 1), 1);
  assert.equal(getNextPlayerIndex(room, 2, 1), 0);
  assert.equal(getNextPlayerIndex(room, 0, 2), 2);
});

test('getNextPlayerIndex respects reversed turn direction', () => {
  const room = makeRoom(['a', 'b', 'c'], { turnDirection: -1 });
  assert.equal(getNextPlayerIndex(room, 0, 1), 2);
});

test('passTurnToNextPlayer moves the active flag to the next player', () => {
  const room = makeRoom(['a', 'b', 'c']);
  passTurnToNextPlayer(room);
  assert.equal(room.players[0]!.isTurn, false);
  assert.equal(room.players[1]!.isTurn, true);
});

test('refillDrawPileFromDiscard recycles all but the top discard card', () => {
  const room = makeRoom(['a']);
  const a = makeCard({ id: 'a', color: 'red', value: '1' });
  const b = makeCard({ id: 'b', color: 'blue', value: '2' });
  const top = makeCard({ id: 'top', color: 'green', value: '3' });
  room.discardPile = [a, b, top];
  const deck: Card[] = [];

  const result = refillDrawPileFromDiscard(deck, room);

  assert.equal(result, true);
  assert.equal(deck.length, 2);
  assert.deepEqual(room.discardPile, [top]);
  assert.deepEqual(deck.map((c) => c.id).sort(), ['a', 'b']);
  assert.equal(room.drawPileCount, 2);
});

test('refilled wild card keeps its wild color so it can be replayed', () => {
  const room = makeRoom(['a']);
  const wild = makeCard({ id: 'w', color: 'wild', value: 'wild', kind: 'wild' });
  const top = makeCard({ id: 'top', color: 'red', value: '4' });
  room.discardPile = [wild, top];
  const deck: Card[] = [];

  refillDrawPileFromDiscard(deck, room);

  assert.equal(deck[0]!.color, 'wild');
});

test('refillDrawPileFromDiscard does nothing when discard cannot be recycled', () => {
  const room = makeRoom(['a']);
  room.discardPile = [makeCard({ id: 'only' })];
  const deck: Card[] = [];

  const result = refillDrawPileFromDiscard(deck, room);

  assert.equal(result, false);
  assert.equal(deck.length, 0);
  assert.deepEqual(room.discardPile.map((c) => c.id), ['only']);
});

test('drawCardsForPlayer recycles the discard pile when the draw pile runs out', () => {
  const room = makeRoom(['a']);
  const player = room.players[0]!;
  const top = makeCard({ id: 'top', color: 'red', value: '4' });
  room.discardPile = [
    makeCard({ id: 'd1' }),
    makeCard({ id: 'd2' }),
    makeCard({ id: 'd3' }),
    top,
  ];
  const decks = new Map<string, Card[]>([['room', []]]);

  const drawn = drawCardsForPlayer(decks, 'room', room, player, 2);

  assert.equal(drawn.length, 2);
  assert.equal(player.hand.length, 2);
  assert.deepEqual(room.discardPile, [top]);
});

test('drawCardsForPlayer returns nothing when the room has no deck', () => {
  const room = makeRoom(['a']);
  const drawn = drawCardsForPlayer(new Map(), 'room', room, room.players[0]!, 3);
  assert.equal(drawn.length, 0);
});

test('canDeclareUno only allows declaring at one or two cards', () => {
  assert.equal(canDeclareUno(1), true);
  assert.equal(canDeclareUno(2), true);
  assert.equal(canDeclareUno(3), false);
});

test('isUnoVulnerable: one undeclared card can be challenged', () => {
  assert.equal(isUnoVulnerable(1, false), true);
});

test('isUnoVulnerable: a declared single card is safe', () => {
  assert.equal(isUnoVulnerable(1, true), false);
});

test('isUnoVulnerable: more than one card is never vulnerable', () => {
  assert.equal(isUnoVulnerable(3, false), false);
});

test('shouldClearUnoFlag resets the declaration unless still at one card', () => {
  assert.equal(shouldClearUnoFlag(1), false);
  assert.equal(shouldClearUnoFlag(2), true);
  assert.equal(shouldClearUnoFlag(0), true);
});

test('UNO penalty is two cards', () => {
  assert.equal(UNO_PENALTY_CARDS, 2);
});

test('clampStartingHandSize keeps values within 2..15', () => {
  assert.equal(clampStartingHandSize(7), 7);
  assert.equal(clampStartingHandSize(1), MIN_STARTING_HAND_SIZE);
  assert.equal(clampStartingHandSize(99), MAX_STARTING_HAND_SIZE);
  assert.equal(clampStartingHandSize(5.9), 5);
});

test('clampStartingHandSize falls back to the default for non-finite input', () => {
  assert.equal(clampStartingHandSize(Number.NaN), DEFAULT_STARTING_HAND_SIZE);
});
