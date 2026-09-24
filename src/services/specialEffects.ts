import { randomUUID } from 'node:crypto';
import { grantFishingReward } from './fishing.js';
import { withLock } from './locks.js';
import { getCachedRows, clearStaticSheetCache } from './staticSheetCache.js';
import { getRows, replaceRows, type SheetRow } from './sheets.js';

export type SpecialEffectKey =
  | 'fishing_upgrade'
  | 'fishing_time'
  | 'fishing_double'
  | 'fishing_extra_target'
  | 'yellow_reward'
  | 'theft_insurance'
  | 'theft_attack_bonus'
  | 'theft_defense_bonus'
  | 'victory_bonus'
  | 'dice_bonus';

export interface ConsumedSpecialEffect {
  key: SpecialEffectKey;
  value: number;
  chance: number;
  sourceItemId: string;
}

interface SpecialDefinition extends ConsumedSpecialEffect {
  itemId: string;
}

const KEYS: SpecialEffectKey[] = [
  'fishing_upgrade',
  'fishing_time',
  'fishing_double',
  'fishing_extra_target',
  'yellow_reward',
  'theft_insurance',
  'theft_attack_bonus',
  'theft_defense_bonus',
  'victory_bonus',
  'dice_bonus'
];

function integer(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isKey(value: string): value is SpecialEffectKey {
  return KEYS.includes(value as SpecialEffectKey);
}

async function definitions(itemId: string): Promise<SpecialDefinition[]> {
  return (await getCachedRows('SpecialItemEffects'))
    .filter((row) => row.item_id === itemId && isKey(row.effect_key))
    .map((row) => ({
      itemId,
      sourceItemId: itemId,
      key: row.effect_key as SpecialEffectKey,
      value: integer(row.value, 0),
      chance: Math.min(100, Math.max(0, integer(row.chance, 100)))
    }));
}

export async function activateSpecialItemEffects(characterId: string, itemId: string, quantity: number): Promise<string[]> {
  const configured = await definitions(itemId);
  if (configured.length === 0) return [];
  const messages: string[] = [];

  for (const definition of configured.filter((entry) => entry.key === 'yellow_reward')) {
    const rewards = [];
    for (let index = 0; index < quantity; index += 1) {
      const reward = await grantFishingReward(characterId, 'YELLOW');
      rewards.push(`${reward.item.itemName} x${reward.quantity}`);
    }
    messages.push(`요술 주머니 보상: ${rewards.join(', ')}`);
  }

  const pending = configured.filter((entry) => entry.key !== 'yellow_reward');
  if (pending.length === 0) return messages;
  await withLock('active-special-effects', async () => {
    const rows = await getRows('ActiveSpecialEffects');
    const now = new Date().toISOString();
    for (const definition of pending) {
      const row = rows.find(
        (candidate) => candidate.character_id === characterId && candidate.effect_key === definition.key
      );
      if (row) {
        row.charges = String(Math.max(0, integer(row.charges, 0)) + quantity);
        row.value = String(definition.value);
        row.chance = String(definition.chance);
        row.source_item_id = itemId;
      } else {
        rows.push({
          effect_id: randomUUID(),
          character_id: characterId,
          source_item_id: itemId,
          effect_key: definition.key,
          value: String(definition.value),
          chance: String(definition.chance),
          charges: String(quantity),
          created_at: now
        } satisfies SheetRow);
      }
    }
    await replaceRows('ActiveSpecialEffects', rows);
    clearStaticSheetCache('ActiveSpecialEffects');
  });
  messages.push(...pending.map((entry) => `${entry.key} 효과 ${quantity}회 대기`));
  return messages;
}

export async function consumeSpecialEffects(
  characterId: string,
  keys: SpecialEffectKey[]
): Promise<Map<SpecialEffectKey, ConsumedSpecialEffect>> {
  return withLock('active-special-effects', async () => {
    const rows = await getRows('ActiveSpecialEffects');
    const consumed = new Map<SpecialEffectKey, ConsumedSpecialEffect>();
    for (const key of keys) {
      const row = rows.find(
        (candidate) => candidate.character_id === characterId && candidate.effect_key === key && integer(candidate.charges, 0) > 0
      );
      if (!row) continue;
      consumed.set(key, {
        key,
        value: integer(row.value, 0),
        chance: Math.min(100, Math.max(0, integer(row.chance, 100))),
        sourceItemId: row.source_item_id
      });
      row.charges = String(integer(row.charges, 0) - 1);
    }
    if (consumed.size > 0) {
      await replaceRows('ActiveSpecialEffects', rows.filter((row) => integer(row.charges, 0) > 0));
      clearStaticSheetCache('ActiveSpecialEffects');
    }
    return consumed;
  });
}
