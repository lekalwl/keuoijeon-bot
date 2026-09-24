import { randomInt } from '../utils/random.js';

export interface Card {
  rank: string;
  suit: string;
}

export interface BlackjackGame {
  id: string;
  userId: string;
  userName: string;
  bet: number;
  deck: Card[];
  player: Card[];
  dealer: Card[];
  finished: boolean;
}

export const blackjackGames = new Map<string, BlackjackGame>();

export function createDeck(): Card[] {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit })));
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function draw(game: BlackjackGame): Card {
  const card = game.deck.pop();
  if (!card) {
    throw new Error('덱에 카드가 없습니다.');
  }
  return card;
}

export function handValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === 'A') {
      aces += 1;
      total += 11;
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      total += 10;
    } else {
      total += Number.parseInt(card.rank, 10);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

export function isNaturalBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards) === 21;
}

export function formatCards(cards: Card[], hideFirst = false): string {
  if (hideFirst && cards.length > 0) {
    return `??, ${cards.slice(1).map((card) => `${card.rank}${card.suit}`).join(', ')}`;
  }
  return cards.map((card) => `${card.rank}${card.suit}`).join(', ');
}

export function createBlackjackGame(id: string, userId: string, userName: string, bet: number): BlackjackGame {
  const game: BlackjackGame = { id, userId, userName, bet, deck: createDeck(), player: [], dealer: [], finished: false };
  game.player.push(draw(game), draw(game));
  game.dealer.push(draw(game), draw(game));
  blackjackGames.set(id, game);
  return game;
}

export function dealerPlay(game: BlackjackGame): void {
  while (handValue(game.dealer) < 17) {
    game.dealer.push(draw(game));
  }
}
