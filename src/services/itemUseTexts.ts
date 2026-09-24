import { pickOne } from '../utils/random.js';
import { getCachedRows } from './staticSheetCache.js';

function chanceValue(value: string | undefined): number {
  const parsed = Number(value ?? '0');
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0;
}

export async function getRandomUseText(itemId: string): Promise<string | undefined> {
  const rows = await getCachedRows('ItemUseTexts');
  const passed = rows
    .filter((row) => row.item_id === itemId && row.use_text)
    .filter((row) => Math.random() <= chanceValue(row.chance))
    .map((row) => row.use_text.trim())
    .filter(Boolean);

  if (passed.length === 0) {
    return undefined;
  }
  return pickOne(passed);
}
