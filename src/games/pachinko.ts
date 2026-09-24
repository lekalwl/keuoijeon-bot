import { pickOne } from '../utils/random.js';

export const PACHINKO_SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '7️⃣'];

export interface PachinkoResult {
  symbols: string[];
  net: number;
  label: string;
}

export function playPachinko(bet: number): PachinkoResult {
  const symbols = [pickOne(PACHINKO_SYMBOLS), pickOne(PACHINKO_SYMBOLS), pickOne(PACHINKO_SYMBOLS)];
  const counts = new Map<string, number>();
  symbols.forEach((symbol) => counts.set(symbol, (counts.get(symbol) ?? 0) + 1));
  const maxSame = Math.max(...counts.values());
  if (symbols.every((symbol) => symbol === '7️⃣')) {
    return { symbols, net: bet * 9, label: '잭팟! 7이 셋입니다.' };
  }
  if (maxSame === 3) {
    return { symbols, net: bet * 4, label: '대박! 같은 그림 셋입니다.' };
  }
  if (maxSame === 2) {
    return { symbols, net: bet, label: '성공! 같은 그림 둘입니다.' };
  }
  return { symbols, net: -bet, label: '아쉽다! 전부 다른 그림입니다.' };
}
