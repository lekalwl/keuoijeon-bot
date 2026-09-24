import { withLock } from './locks.js';
import { getRows, replaceRows } from './sheets.js';
import { clearStaticSheetCache } from './staticSheetCache.js';
import type { Character } from './characters.js';

function parsePoints(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export async function changePoints(characterId: string, delta: number): Promise<number> {
  return withLock('characters', async () => {
    const rows = await getRows('Characters');
    const row = rows.find((candidate) => candidate.character_id === characterId);
    if (!row) throw new Error('캐릭터를 찾을 수 없습니다.');
    const next = parsePoints(row.points) + delta;
    if (next < 0) throw new Error('포인트가 부족합니다.');
    row.points = String(next);
    await replaceRows('Characters', rows);
    clearStaticSheetCache('Characters');
    return next;
  });
}

export async function transferPoints(from: Character, to: Character, amount: number): Promise<void> {
  if (amount <= 0 || !Number.isInteger(amount)) throw new Error('금액은 양수 정수여야 합니다.');
  await withLock('characters', async () => {
    const rows = await getRows('Characters');
    const fromRow = rows.find((row) => row.character_id === from.characterId);
    const toRow = rows.find((row) => row.character_id === to.characterId);
    if (!fromRow || !toRow) throw new Error('캐릭터를 찾을 수 없습니다.');
    if (parsePoints(fromRow.points) < amount) throw new Error('포인트가 부족합니다.');
    fromRow.points = String(parsePoints(fromRow.points) - amount);
    toRow.points = String(parsePoints(toRow.points) + amount);
    await replaceRows('Characters', rows);
    clearStaticSheetCache('Characters');
  });
}
