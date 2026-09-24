import { randomInt } from '../utils/random.js';

const DICE_RE = /^(\d+)d(\d+)(?:\s*([+\-*/])\s*(\d+))?$/i;

export interface DiceRoll {
  expression: string;
  count: number;
  sides: number;
  rolls: number[];
  sum: number;
  operator?: string;
  operand?: number;
  final: number;
}

export function rollDice(expression: string): DiceRoll {
  const trimmed = expression.trim().replace(/\s+/g, '');
  const match = DICE_RE.exec(trimmed);
  if (!match) {
    throw new Error('`1d100`, `3d6+10` 같은 형식만 사용할 수 있습니다.');
  }
  const count = Number.parseInt(match[1], 10);
  const sides = Number.parseInt(match[2], 10);
  const operator = match[3];
  const operand = match[4] ? Number.parseInt(match[4], 10) : undefined;
  if (count < 1 || count > 100) {
    throw new Error('주사위 개수는 1개 이상 100개 이하만 가능합니다.');
  }
  if (sides < 2 || sides > 1000) {
    throw new Error('주사위 면 수는 2면 이상 1000면 이하만 가능합니다.');
  }
  const rolls = Array.from({ length: count }, () => randomInt(1, sides));
  const sum = rolls.reduce((total, value) => total + value, 0);
  let final = sum;
  if (operator && operand !== undefined) {
    if (operator === '+') final += operand;
    if (operator === '-') final -= operand;
    if (operator === '*') final *= operand;
    if (operator === '/') {
      if (operand === 0) {
        throw new Error('0으로 나눌 수 없습니다.');
      }
      final = Math.floor(final / operand);
    }
  }
  return { expression: trimmed, count, sides, rolls, sum, operator, operand, final };
}
