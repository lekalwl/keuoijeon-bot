export type DuelChoice = 'attack' | 'defense' | 'dodge' | 'ambush';

export interface DuelGame {
  id: string;
  challengerId: string;
  challengerName: string;
  challengerCharacterId: string;
  opponentId: string;
  opponentName: string;
  opponentCharacterId: string;
  bet: number;
  hp: Map<string, number>;
  choices: Map<string, DuelChoice>;
  accepted: boolean;
  timeout: NodeJS.Timeout;
}

export const duelGames = new Map<string, DuelGame>();

export function duelLabel(choice: DuelChoice): string {
  return { attack: '공격', defense: '방어', dodge: '회피', ambush: '기습' }[choice];
}

export function duelRoundWinner(a: DuelChoice, b: DuelChoice): 0 | 1 | 2 {
  if (a === b) return 0;
  if (
    (a === 'dodge' && b === 'attack') ||
    (a === 'ambush' && b === 'dodge') ||
    (a === 'defense' && b === 'ambush') ||
    (a === 'attack' && b === 'defense')
  ) {
    return 1;
  }
  return 2;
}
