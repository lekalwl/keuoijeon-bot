export type RpsChoice = 'scissors' | 'rock' | 'paper';

export interface RpsGame {
  id: string;
  challengerId: string;
  challengerName: string;
  challengerCharacterId: string;
  opponentId: string;
  opponentName: string;
  opponentCharacterId: string;
  bet: number;
  choices: Map<string, RpsChoice>;
  accepted: boolean;
  timeout: NodeJS.Timeout;
}

export const rpsGames = new Map<string, RpsGame>();

export function rpsLabel(choice: RpsChoice): string {
  return { scissors: '가위', rock: '바위', paper: '보' }[choice];
}

export function rpsWinner(a: RpsChoice, b: RpsChoice): 0 | 1 | 2 {
  if (a === b) return 0;
  if ((a === 'scissors' && b === 'paper') || (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock')) {
    return 1;
  }
  return 2;
}
